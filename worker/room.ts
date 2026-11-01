import { DurableObject } from "cloudflare:workers";
import type { AdminRoomSummary, RoomRole, RoomSettings, RoomSnapshot, RoundRecord } from "../src/shared";
import { isAgreement, isInactiveRound, normalizeWord, wordLength } from "./rules";

const LOBBY_TTL_MS = 30 * 60 * 1000;
const FINISHED_ROOM_TTL_MS = 60 * 60 * 1000;
const PRESENCE_TTL_MS = 45 * 1000;
const REVEAL_MS = 4_000;
const TERMINATION_WARNING_MS = 5_000;

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
};

type InternalMember = AuthenticatedUser & {
  role: RoomRole;
  joinedAt: number;
  lastSeenAt: number;
};

type InternalRoomState = {
  code: string;
  status: RoomSnapshot["status"];
  phase: RoomSnapshot["phase"];
  settings: RoomSettings;
  hostId: string;
  members: InternalMember[];
  roundNumber: number;
  deadlineAt: number | null;
  transitionAt: number | null;
  submissions: Record<string, string>;
  rounds: RoundRecord[];
  winningWord: string | null;
  createdAt: number;
  completedAt?: number | null;
  inactiveRoundStreak?: number;
  terminationAt?: number | null;
};

type RoomStreamController = {
  enqueue(chunk: Uint8Array): void;
};

type RoomSubscriber = {
  userId: string;
  controller: RoomStreamController;
};

type RoomRpcError = {
  ok: false;
  status: number;
  code: string;
  message: string;
};

export type RoomRpcResult<T> = { ok: true; value: T } | RoomRpcError;

const failure = (status: number, code: string, message: string): RoomRpcError => ({
  ok: false,
  status,
  code,
  message,
});

export class RoomV2 extends DurableObject<Env> {
  private readonly subscribers = new Map<number, RoomSubscriber>();
  private nextSubscriberId = 0;

  async create(
    code: string,
    creator: AuthenticatedUser,
    settings: RoomSettings,
  ): Promise<RoomRpcResult<RoomSnapshot>> {
    if (this.readState()) {
      return failure(409, "room_exists", "房间码发生冲突，请重试。");
    }

    const now = Date.now();
    const state: InternalRoomState = {
      code,
      status: "lobby",
      phase: "input",
      settings,
      hostId: creator.id,
      members: [{ ...creator, role: "player", joinedAt: now, lastSeenAt: now }],
      roundNumber: 0,
      deadlineAt: null,
      transitionAt: null,
      submissions: {},
      rounds: [],
      winningWord: null,
      createdAt: now,
      completedAt: null,
      inactiveRoundStreak: 0,
      terminationAt: null,
    };

    this.writeState(state);
    await this.env.ROOMS.put(`room:${code}`, JSON.stringify({ code, createdAt: now }), {
      expirationTtl: 7 * 24 * 60 * 60,
    });
    await this.ctx.storage.setAlarm(now + LOBBY_TTL_MS);
    return { ok: true, value: this.toSnapshot(state, creator.id, now) };
  }

  async join(user: AuthenticatedUser, role: RoomRole): Promise<RoomRpcResult<RoomSnapshot>> {
    const state = this.readState();
    if (!state || state.status === "expired") {
      return failure(404, "room_not_found", "没有找到这个房间，请检查房间码。");
    }
    if (role === "player" && state.status !== "lobby") {
      return failure(409, "room_locked", "房间已经开局，不能再加入。");
    }

    const now = Date.now();
    const existing = state.members.find((member) => member.id === user.id);
    if (existing) {
      existing.lastSeenAt = now;
      existing.name = user.name;
    } else {
      const playerCount = this.players(state).length;
      if (role === "player" && playerCount >= 10) {
        return failure(409, "room_full", "房间已满，最多 10 人。");
      }
      state.members.push({ ...user, role, joinedAt: now, lastSeenAt: now });
    }

    this.writeState(state);
    this.broadcast(state, now);
    return { ok: true, value: this.toSnapshot(state, user.id, now) };
  }

  async snapshot(user: AuthenticatedUser): Promise<RoomRpcResult<RoomSnapshot>> {
    const state = this.readState();
    if (!state || state.status === "expired") {
      return failure(404, "room_not_found", "房间已解散或不存在。");
    }

    const member = state.members.find((candidate) => candidate.id === user.id);
    if (!member) {
      return failure(403, "not_a_member", "请先通过房间码或邀请链接加入。");
    }

    const now = Date.now();
    if (now - member.lastSeenAt >= 8_000) {
      member.lastSeenAt = now;
      this.writeState(state);
    }
    return { ok: true, value: this.toSnapshot(state, user.id, now) };
  }

  async adminSnapshot(): Promise<RoomRpcResult<AdminRoomSummary>> {
    const state = this.readState();
    if (!state || state.status === "expired") {
      return failure(404, "room_not_found", "房间已解散或不存在。");
    }

    const now = Date.now();
    return {
      ok: true,
      value: {
        code: state.code,
        status: state.status,
        phase: state.phase,
        roundNumber: state.roundNumber,
        createdAt: state.createdAt,
        members: state.members.map((member) => ({
          id: member.id,
          name: member.name,
          isHost: member.id === state.hostId,
          isPresent: this.isPresent(member, now),
        })),
      },
    };
  }

  async closeByAdmin(): Promise<RoomRpcResult<{ code: string }>> {
    const state = this.readState();
    if (!state || state.status === "expired") {
      return failure(404, "room_not_found", "房间已解散或不存在。");
    }

    await this.terminate(state, Date.now());
    return { ok: true, value: { code: state.code } };
  }

  async events(user: AuthenticatedUser): Promise<RoomRpcResult<ReadableStream<Uint8Array>>> {
    const state = this.readState();
    if (!state || state.status === "expired") {
      return failure(404, "room_not_found", "房间已解散或不存在。");
    }

    const member = state.members.find((candidate) => candidate.id === user.id);
    if (!member) {
      return failure(403, "not_a_member", "请先通过房间码或邀请链接加入。");
    }

    const now = Date.now();
    member.lastSeenAt = now;
    this.writeState(state);

    const subscriberId = this.nextSubscriberId++;
    return { ok: true, value: new ReadableStream<Uint8Array>({
      type: "bytes",
      start: (controller) => {
        const streamController = controller as unknown as RoomStreamController;
        this.subscribers.set(subscriberId, { userId: user.id, controller: streamController });
        this.broadcast(state, now, subscriberId);
        this.sendSnapshot(streamController, state, user.id, now);
      },
      cancel: () => {
        this.subscribers.delete(subscriberId);
        if (this.hasSubscriber(user.id)) return;

        const current = this.readState();
        const currentMember = current?.members.find((candidate) => candidate.id === user.id);
        if (!current || !currentMember) return;
        currentMember.lastSeenAt = 0;
        this.writeState(current);
        this.broadcast(current, Date.now());
      },
    }) };
  }

  async start(user: AuthenticatedUser): Promise<RoomRpcResult<RoomSnapshot>> {
    const state = this.readState();
    if (!state || state.status === "expired") {
      return failure(404, "room_not_found", "房间已解散或不存在。");
    }
    if (state.hostId !== user.id) {
      return failure(403, "host_only", "只有房主可以开始游戏。");
    }
    if (state.status !== "lobby") {
      return failure(409, "already_started", "游戏已经开始。");
    }

    const now = Date.now();
    const presentCount = this.players(state).filter((member) => this.isPresent(member, now)).length;
    if (presentCount < 2) {
      return failure(409, "not_enough_players", "至少需要 2 位在线玩家才能开始。");
    }

    state.status = "playing";
    state.phase = "input";
    state.roundNumber = 1;
    state.deadlineAt = now + state.settings.roundSeconds * 1000;
    state.transitionAt = null;
    state.submissions = {};
    state.inactiveRoundStreak = 0;
    state.terminationAt = null;
    this.writeState(state);
    await this.ctx.storage.setAlarm(state.deadlineAt);
    this.broadcast(state, now);
    return { ok: true, value: this.toSnapshot(state, user.id, now) };
  }

  async submit(user: AuthenticatedUser, rawWord: string): Promise<RoomRpcResult<RoomSnapshot>> {
    const state = this.readState();
    if (!state || state.status === "expired") {
      return failure(404, "room_not_found", "房间已解散或不存在。");
    }
    if (state.status !== "playing" || state.phase !== "input") {
      return failure(409, "not_accepting_words", "现在不是输入阶段。");
    }
    if (!this.players(state).some((member) => member.id === user.id)) {
      return failure(403, "not_a_member", "你不在这个房间中。");
    }

    const word = normalizeWord(rawWord);
    if (!word) {
      return failure(400, "empty_word", "请输入一个词。");
    }
    if (wordLength(word) > state.settings.maxWordLength) {
      return failure(400, "word_too_long", `词语不能超过 ${state.settings.maxWordLength} 个字。`);
    }
    if (state.submissions[user.id]) {
      return failure(409, "already_submitted", "这一轮已经提交，等待大家揭晓吧。");
    }

    state.submissions[user.id] = word;
    const now = Date.now();
    const everyoneSubmitted = this.players(state).every((member) => Boolean(state.submissions[member.id]));
    if (everyoneSubmitted) {
      await this.finishRound(state, now);
    } else {
      this.writeState(state);
      this.broadcast(state, now);
    }
    return { ok: true, value: this.toSnapshot(state, user.id, now) };
  }

  async continueGame(user: AuthenticatedUser): Promise<RoomRpcResult<RoomSnapshot>> {
    const state = this.readState();
    if (!state || state.status === "expired") {
      return failure(404, "room_not_found", "房间已解散或不存在。");
    }
    if (state.status !== "playing" || !state.terminationAt) {
      return failure(409, "not_terminating", "房间目前无需继续游戏。");
    }
    if (!this.players(state).some((member) => member.id === user.id)) {
      return failure(403, "not_a_member", "你不在这个房间中。");
    }

    const now = Date.now();
    if (now >= state.terminationAt) {
      await this.terminate(state, now);
      return failure(404, "room_not_found", "房间已解散或不存在。");
    }
    state.inactiveRoundStreak = 0;
    state.terminationAt = null;
    state.phase = "input";
    state.roundNumber += 1;
    state.submissions = {};
    state.transitionAt = null;
    state.deadlineAt = now + state.settings.roundSeconds * 1000;
    this.writeState(state);
    await this.ctx.storage.setAlarm(state.deadlineAt);
    this.broadcast(state, now);
    return { ok: true, value: this.toSnapshot(state, user.id, now) };
  }

  async alarm(): Promise<void> {
    const state = this.readState();
    if (!state || state.status === "expired") {
      return;
    }

    const now = Date.now();
    if (state.status === "finished") {
      const closeAt = (state.completedAt ?? state.createdAt) + FINISHED_ROOM_TTL_MS;
      if (now >= closeAt) {
        await this.terminate(state, now);
        return;
      }
      await this.ctx.storage.setAlarm(closeAt);
      return;
    }

    if (state.terminationAt) {
      if (now >= state.terminationAt) {
        await this.terminate(state, now);
        return;
      }
      await this.ctx.storage.setAlarm(state.terminationAt);
      return;
    }

    if (state.status === "lobby") {
      if (now >= state.createdAt + LOBBY_TTL_MS) {
        await this.terminate(state, now);
        return;
      }
      await this.schedule(state, now);
      return;
    }

    if (state.phase === "input") {
      await this.finishRound(state, now);
      return;
    }

    if (state.winningWord) {
      state.status = "finished";
      state.completedAt = now;
      state.transitionAt = null;
      this.writeState(state);
      await this.ctx.storage.setAlarm(now + FINISHED_ROOM_TTL_MS);
      await this.env.ROOMS.put(
        `log:${state.code}`,
        JSON.stringify({ code: state.code, winningWord: state.winningWord, rounds: state.rounds }),
        { expirationTtl: 7 * 24 * 60 * 60 },
      );
      this.broadcast(state, now);
      return;
    }

    state.phase = "input";
    state.roundNumber += 1;
    state.submissions = {};
    state.transitionAt = null;
    state.deadlineAt = now + state.settings.roundSeconds * 1000;
    this.writeState(state);
    await this.ctx.storage.setAlarm(state.deadlineAt);
    this.broadcast(state, now);
  }

  private async finishRound(state: InternalRoomState, now: number): Promise<void> {
    const round: RoundRecord = {
      round: state.roundNumber,
      entries: this.players(state).map((member) => ({
        memberId: member.id,
        memberName: member.name,
        word: state.submissions[member.id] ?? null,
      })),
      completedAt: now,
    };
    state.rounds.push(round);

    const words = round.entries.map((entry) => entry.word);
    const agreed = isAgreement(words, state.settings.ignoreCase);
    state.phase = "reveal";
    state.deadlineAt = null;

    if (agreed) {
      state.winningWord = words[0];
    }

    const noOnePresent = this.players(state).every((member) => !this.isPresent(member, now));
    state.inactiveRoundStreak = !agreed && isInactiveRound(words, noOnePresent) ? (state.inactiveRoundStreak ?? 0) + 1 : 0;
    if (state.inactiveRoundStreak >= 2) {
      state.terminationAt = now + TERMINATION_WARNING_MS;
      state.transitionAt = null;
      this.writeState(state);
      await this.ctx.storage.setAlarm(state.terminationAt);
      this.broadcast(state, now);
      return;
    }

    state.terminationAt = null;
    state.transitionAt = now + REVEAL_MS;
    this.writeState(state);
    await this.ctx.storage.setAlarm(state.transitionAt);
    this.broadcast(state, now);
  }

  private readState(): InternalRoomState | null {
    const table = this.ctx.storage.sql
      .exec<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'room_state'")
      .toArray()[0];
    if (!table) return null;
    const row = this.ctx.storage.sql
      .exec<{ data: string }>("SELECT data FROM room_state WHERE id = 1")
      .toArray()[0];
    return row ? (JSON.parse(row.data) as InternalRoomState) : null;
  }

  private writeState(state: InternalRoomState): void {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS room_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        data TEXT NOT NULL
      )
    `);
    this.ctx.storage.sql.exec(
      `INSERT INTO room_state (id, data) VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
      JSON.stringify(state),
    );
  }

  private isPresent(member: InternalMember, now: number): boolean {
    return this.hasSubscriber(member.id) || now - member.lastSeenAt <= PRESENCE_TTL_MS;
  }

  private players(state: InternalRoomState): InternalMember[] {
    return state.members.filter((member) => member.role !== "spectator");
  }

  private hasSubscriber(userId: string): boolean {
    return [...this.subscribers.values()].some((subscriber) => subscriber.userId === userId);
  }

  private broadcast(state: InternalRoomState, now: number, exceptSubscriberId?: number): void {
    for (const [subscriberId, subscriber] of this.subscribers) {
      if (subscriberId === exceptSubscriberId) continue;
      this.sendSnapshot(subscriber.controller, state, subscriber.userId, now, subscriberId);
    }
  }

  private sendSnapshot(
    controller: RoomStreamController,
    state: InternalRoomState,
    userId: string,
    now: number,
    subscriberId?: number,
  ): void {
    try {
      controller.enqueue(new TextEncoder().encode(`event: room\ndata: ${JSON.stringify(this.toSnapshot(state, userId, now))}\n\n`));
    } catch {
      if (subscriberId !== undefined) this.subscribers.delete(subscriberId);
    }
  }

  private async schedule(state: InternalRoomState, now: number): Promise<void> {
    if (state.status !== "lobby") return;
    await this.ctx.storage.setAlarm(Math.max(now + 1_000, state.createdAt + LOBBY_TTL_MS));
  }

  private async terminate(state: InternalRoomState, now: number): Promise<void> {
    state.status = "expired";
    state.deadlineAt = null;
    state.transitionAt = null;
    state.terminationAt = null;
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    await this.env.ROOMS.delete(`room:${state.code}`);
    this.broadcast(state, now);
  }

  private toSnapshot(state: InternalRoomState, userId: string, now: number): RoomSnapshot {
    const latestRound = state.rounds.at(-1) ?? null;
    const viewerRole = state.members.find((member) => member.id === userId)?.role ?? "player";
    return {
      code: state.code,
      status: state.status,
      phase: state.phase,
      settings: state.settings,
      hostId: state.hostId,
      currentUserId: userId,
      viewerRole,
      members: state.members.map((member) => ({
        id: member.id,
        name: member.name,
        isHost: member.id === state.hostId,
        role: member.role ?? "player",
        isPresent: this.isPresent(member, now),
        hasSubmitted: Boolean(state.submissions[member.id]),
      })),
      roundNumber: state.roundNumber,
      deadlineAt: state.deadlineAt,
      transitionAt: state.transitionAt,
      terminationAt: state.terminationAt ?? null,
      latestRound: state.phase === "reveal" || state.status === "finished" ? latestRound : null,
      previousRound: latestRound,
      liveEntries: viewerRole === "spectator" ? this.players(state).map((member) => ({
        memberId: member.id,
        memberName: member.name,
        word: state.submissions[member.id] ?? null,
      })) : [],
      rounds: state.status === "finished" || viewerRole === "spectator" ? state.rounds : [],
      winningWord: state.winningWord,
      createdAt: state.createdAt,
    };
  }
}
