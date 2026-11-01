import {
  Button,
  Description,
  FieldError,
  Input,
  Label,
  Modal,
  Spinner,
  TextField,
} from "@heroui/react";
import {
  ArrowRight,
  ArrowClockwise,
  Check,
  CrownSimple,
  HourglassMedium,
  LinkSimple,
  ShieldCheck,
  UsersThree,
  XCircle,
} from "@phosphor-icons/react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "./api";
import { TurnstileWidget } from "./components/TurnstileWidget";
import type { AdminRoomSummary, RoomSnapshot } from "./shared";
import { Spoiler } from "spoiled";

type RuntimeConfig = {
  turnstileSiteKey: string;
  turnstileBypass: boolean;
};

type UserProfile = {
  id: string;
  name: string;
  email: string;
  isInstanceAdmin: boolean;
};

type RoomPayload = RoomSnapshot & { inviteUrl: string };

function withInviteUrl(room: RoomSnapshot): RoomPayload {
  return { ...room, inviteUrl: new URL(`/room/${room.code}`, window.location.origin).toString() };
}

function wordLengthStyle(word: string): React.CSSProperties {
  return { "--word-length": Math.max([...word].length, 1) } as React.CSSProperties;
}

export default function App() {
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [route, setRoute] = useState(window.location.pathname);
  const [initialRoom, setInitialRoom] = useState<RoomPayload | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api<RuntimeConfig>("/api/config"), api<UserProfile>("/api/me")])
      .then(([nextConfig, nextProfile]) => {
        setConfig(nextConfig);
        setProfile(nextProfile);
      })
      .catch(() => setFatalError("无法确认登录状态或载入应用配置，请刷新页面。"));
    const onPopState = () => setRoute(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigateToRoom = useCallback((room: RoomPayload) => {
    window.history.pushState({}, "", `/room/${room.code}`);
    setInitialRoom(room);
    setRoute(`/room/${room.code}`);
  }, []);

  if (fatalError) return <FullPageMessage title="页面没有准备好" message={fatalError} />;
  if (!config || !profile) return <LoadingScreen />;

  const roomMatch = route.match(/^\/room\/([^/]+)$/);
  if (roomMatch) {
    return (
      <RoomPage
        code={decodeURIComponent(roomMatch[1]).toUpperCase()}
        config={config}
        initialRoom={initialRoom?.code === roomMatch[1].toUpperCase() ? initialRoom : null}
      />
    );
  }

  if (route === "/admin") {
    if (!profile.isInstanceAdmin) {
      return <FullPageMessage title="没有管理权限" message="请使用配置为实例管理员的邮箱登录。" />;
    }
    return <AdminPage profile={profile} />;
  }

  if (route === "/play") return <HomePage config={config} onEnterRoom={navigateToRoom} />;
  if (profile.isInstanceAdmin) return <AdminPage profile={profile} />;
  return <HomePage config={config} onEnterRoom={navigateToRoom} />;
}

function AdminPage({ profile }: { profile: UserProfile }) {
  const [rooms, setRooms] = useState<AdminRoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [closingCode, setClosingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const data = await api<{ rooms: AdminRoomSummary[] }>("/api/admin/rooms");
      setRooms(data.rooms);
      setError(null);
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  async function closeRoom(room: AdminRoomSummary) {
    if (!window.confirm(`确定关闭房间 ${room.code} 吗？在线玩家会立刻看到房间已关闭。`)) return;
    setClosingCode(room.code);
    setError(null);
    try {
      await api<{ code: string }>(`/api/admin/rooms/${encodeURIComponent(room.code)}/close`, { method: "POST" });
      setRooms((current) => current.filter((candidate) => candidate.code !== room.code));
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setClosingCode(null);
    }
  }

  return (
    <main className="admin-shell">
      <header className="site-header admin-header">
        <a href="/admin" className="brand" aria-label="Tecitest 房间管理"><span>Tecitest</span></a>
        <div className="admin-identity"><ShieldCheck weight="fill" /><span>{profile.email}</span></div>
      </header>

      <section className="admin-layout" aria-labelledby="admin-title">
        <div className="admin-heading">
          <div>
            <h1 id="admin-title">房间管理</h1>
            <p>查看所有仍可访问的房间、成员与在线状态。状态每 15 秒自动更新。</p>
          </div>
          <div className="admin-actions">
            <Button variant="outline" onPress={() => void refresh(true)} isPending={refreshing} isDisabled={refreshing}>
              <ArrowClockwise weight="bold" /> 刷新列表
            </Button>
            <Button variant="outline" onPress={() => { window.location.href = "/play"; }}>
              <UsersThree weight="bold" /> 进入游戏首页
            </Button>
          </div>
        </div>

        {loading ? <AdminRoomSkeletons /> : rooms.length === 0 ? (
          <div className="admin-empty"><h2>现在没有可管理的房间</h2><p>新创建的房间会自动出现在这里。</p></div>
        ) : (
          <div className="admin-room-list">
            {rooms.map((room) => (
              <article className="admin-room" key={room.code}>
                <div className="admin-room-meta">
                  <div><span className="admin-room-code">{room.code}</span><strong>{roomStatusLabel(room)}</strong></div>
                  <span>{room.members.filter((member) => member.isPresent).length} / {room.members.length} 在线</span>
                </div>
                <div className="admin-members" aria-label={`房间 ${room.code} 的玩家`}>
                  {room.members.map((member) => (
                    <div className={`admin-member ${member.isPresent ? "is-present" : ""}`} key={member.id}>
                      <span aria-hidden="true" />
                      <strong>{member.name}</strong>
                      <small>{member.isHost ? "房主 · " : ""}{member.isPresent ? "在线" : "离线"}</small>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="admin-close-button" onPress={() => void closeRoom(room)} isPending={closingCode === room.code} isDisabled={closingCode !== null}>
                  <XCircle weight="bold" /> 关闭房间
                </Button>
              </article>
            ))}
          </div>
        )}
        <div className="status-region" role="alert">{error}</div>
      </section>
    </main>
  );
}

function AdminRoomSkeletons() {
  return (
    <div className="admin-room-list" aria-busy="true" aria-label="正在载入房间列表">
      {[0, 1, 2].map((index) => <div className="admin-room-skeleton" key={index} />)}
    </div>
  );
}

function roomStatusLabel(room: AdminRoomSummary): string {
  if (room.status === "lobby") return "等待开始";
  if (room.status === "finished") return "已完成";
  return room.phase === "reveal" ? `第 ${room.roundNumber} 轮揭晓中` : `第 ${room.roundNumber} 轮进行中`;
}

function HomePage({ config, onEnterRoom }: { config: RuntimeConfig; onEnterRoom: (room: RoomPayload) => void }) {
  const [maxWordLength, setMaxWordLength] = useState("8");
  const [roundSeconds, setRoundSeconds] = useState("30");
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [joinRole, setJoinRole] = useState<"player" | "spectator">("player");
  const [createToken, setCreateToken] = useState<string | null>(config.turnstileBypass ? "dev-bypass" : null);
  const [joinToken, setJoinToken] = useState<string | null>(config.turnstileBypass ? "dev-bypass" : null);
  const [captchaEpoch, setCaptchaEpoch] = useState(0);
  const [pending, setPending] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createRoom(event: FormEvent) {
    event.preventDefault();
    setPending("create");
    setError(null);
    try {
      const room = await api<RoomPayload>("/api/rooms", {
        method: "POST",
        body: JSON.stringify({
          maxWordLength: Number(maxWordLength),
          roundSeconds: Number(roundSeconds),
          ignoreCase,
          turnstileToken: createToken,
        }),
      });
      onEnterRoom(room);
    } catch (caught) {
      setError(messageFrom(caught));
      setCreateToken(config.turnstileBypass ? "dev-bypass" : null);
      setCaptchaEpoch((value) => value + 1);
    } finally {
      setPending(null);
    }
  }

  async function joinRoom(event: FormEvent) {
    event.preventDefault();
    const code = roomCode.trim().toUpperCase();
    setPending("join");
    setError(null);
    try {
      const room = await api<RoomPayload>(`/api/rooms/${encodeURIComponent(code)}/join`, {
        method: "POST",
        body: JSON.stringify({ turnstileToken: joinToken, role: joinRole }),
      });
      onEnterRoom(room);
    } catch (caught) {
      setError(messageFrom(caught));
      setJoinToken(config.turnstileBypass ? "dev-bypass" : null);
      setCaptchaEpoch((value) => value + 1);
    } finally {
      setPending(null);
    }
  }

  return (
    <main className="home-shell">
      <header className="site-header">
        <a href="/" className="brand" aria-label="Tecitest 首页">
          <span>Tecitest</span>
        </a>
        <span className="access-note"><Check weight="bold" /> 私密作答</span>
      </header>

      <section className="home-hero">
        <div className="hero-copy">
          <h1>一起写下一个词</h1>
          <p>同时写下，再一起翻开。</p>
          <div className="ritual-line" aria-label="游戏流程">
            <span>各自写下</span><ArrowRight aria-hidden="true" /><span>同时翻牌</span><ArrowRight aria-hidden="true" /><span>找到同词</span>
          </div>
        </div>

        <div className="answer-desk">
          <form className="entry-board create-board" onSubmit={createRoom}>
            <div className="board-pin" aria-hidden="true" />
            <h2>拿一块新答题板</h2>
            <p>创建房间，再把房间码交给朋友。</p>
            <div className="field-row">
              <TextField fullWidth isRequired name="maxWordLength" type="number" value={maxWordLength} onChange={setMaxWordLength}>
                <Label>最多几个字</Label>
                <Input min="1" max="20" inputMode="numeric" />
                <Description>1–20 个字</Description>
              </TextField>
              <TextField fullWidth isRequired name="roundSeconds" type="number" value={roundSeconds} onChange={setRoundSeconds}>
                <Label>每轮时长</Label>
                <Input min="5" max="300" inputMode="numeric" />
                <Description>默认 30 秒</Description>
              </TextField>
            </div>
            <label className="case-setting">
              <input type="checkbox" checked={ignoreCase} onChange={(event) => setIgnoreCase(event.target.checked)} />
              <span className="case-setting-track" aria-hidden="true"><span /></span>
              <span><strong>忽略英文大小写</strong><small>例如 Apple 与 apple 会视为相同词</small></span>
            </label>
            {!config.turnstileBypass && (
              <TurnstileWidget key={`create-${captchaEpoch}`} action="create_room" siteKey={config.turnstileSiteKey} onToken={setCreateToken} />
            )}
            <Button fullWidth size="lg" type="submit" isPending={pending === "create"} isDisabled={!createToken || pending !== null}>
              {pending === "create" ? <Spinner color="current" size="sm" /> : <ArrowRight weight="bold" />}
              创建房间
            </Button>
          </form>

          <form className="entry-board join-board" onSubmit={joinRoom}>
            <div className="board-pin" aria-hidden="true" />
            <h2>加入朋友的房间</h2>
            <p>输入 6 位房间码，或直接打开邀请链接。</p>
            <TextField fullWidth isRequired name="roomCode" value={roomCode} onChange={(value) => setRoomCode(value.toUpperCase().slice(0, 6))}>
              <Label>房间码</Label>
              <Input className="room-code-input" placeholder="" autoComplete="off" />
              <Description>不区分大小写</Description>
              {roomCode && roomCode.length !== 6 ? <FieldError>请输入 6 位房间码</FieldError> : null}
            </TextField>
            <fieldset className="join-role">
              <legend>加入方式</legend>
              <label><input type="radio" name="joinRole" checked={joinRole === "player"} onChange={() => setJoinRole("player")} /> 参与作答</label>
              <label><input type="radio" name="joinRole" checked={joinRole === "spectator"} onChange={() => setJoinRole("spectator")} /> 观战（可看实时答案和全部记录）</label>
            </fieldset>
            {!config.turnstileBypass && (
              <TurnstileWidget key={`join-${captchaEpoch}`} action="join_room" siteKey={config.turnstileSiteKey} onToken={setJoinToken} />
            )}
            <Button fullWidth size="lg" variant="secondary" type="submit" isPending={pending === "join"} isDisabled={!joinToken || roomCode.length !== 6 || pending !== null}>
              {pending === "join" ? <Spinner color="current" size="sm" /> : <UsersThree weight="bold" />}
              {joinRole === "spectator" ? "进入观战" : "加入房间"}
            </Button>
          </form>
        </div>
      </section>
      <div className="status-region" role="status" aria-live="polite">{error}</div>
    </main>
  );
}

function RoomPage({ code, config, initialRoom }: { code: string; config: RuntimeConfig; initialRoom: RoomPayload | null }) {
  const [room, setRoom] = useState<RoomPayload | null>(initialRoom);
  const [joinRequired, setJoinRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialRoom);

  const refresh = useCallback(async () => {
    try {
      const next = await api<RoomPayload>(`/api/rooms/${encodeURIComponent(code)}`);
      setRoom(next);
      setJoinRequired(false);
      setError(null);
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.code === "not_a_member") {
        setJoinRequired(true);
      } else {
        setError(messageFrom(caught));
      }
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    if (!initialRoom) void refresh();
  }, [initialRoom, refresh]);

  const streamActive = room !== null && room.status !== "finished" && room.status !== "expired";
  useEffect(() => {
    if (!streamActive) return;

    const events = new EventSource(`/api/rooms/${encodeURIComponent(code)}/events`);
    const onRoom = (event: Event) => {
      try {
        const next = JSON.parse((event as MessageEvent<string>).data) as RoomSnapshot;
        setRoom(withInviteUrl(next));
        setJoinRequired(false);
        setError(null);
        setLoading(false);
      } catch {
        setError("实时同步数据无效，请刷新页面。");
      }
    };
    events.addEventListener("room", onRoom);

    return () => {
      events.close();
    };
  }, [code, streamActive]);

  if (loading) return <LoadingScreen />;
  if (joinRequired) return <InviteJoin code={code} config={config} onJoined={setRoom} />;
  if (!room) return <FullPageMessage title="进不了这个房间" message={error ?? "请检查邀请链接或房间码。"} />;
  if (room.status === "expired") return <FullPageMessage title="这个房间已关闭" message="房间因长时间无人继续游戏，已自动终止。" />;

  return (
    <main className="room-shell">
      <RoomHeader room={room} />
      {room.status === "lobby" && <Lobby room={room} onChange={setRoom} />}
      {room.status === "playing" && <Game room={room} onChange={setRoom} />}
      {room.status === "finished" && <Results room={room} />}
      {room.terminationAt && room.viewerRole === "player" && <TerminationWarning room={room} onChange={setRoom} />}
      <div className="status-region" role="status" aria-live="polite">{error}</div>
    </main>
  );
}

function TerminationWarning({ room, onChange }: { room: RoomPayload; onChange: (room: RoomPayload) => void }) {
  const now = useNow();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remaining = Math.max(0, Math.ceil(((room.terminationAt ?? now) - now) / 1000));

  async function continueGame() {
    setPending(true);
    setError(null);
    try {
      onChange(await api<RoomPayload>(`/api/rooms/${room.code}/continue`, { method: "POST" }));
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal isOpen>
      <Modal.Backdrop isDismissable={false}>
        <Modal.Container>
          <Modal.Dialog className="termination-dialog">
            <Modal.Header><Modal.Heading>房间即将终止</Modal.Heading></Modal.Header>
            <Modal.Body>
              <p>连续两轮无人提交或房间无人在线。{remaining} 秒内继续游戏即可保留房间。</p>
              {error && <p className="termination-error" role="alert">{error}</p>}
            </Modal.Body>
            <Modal.Footer><Button size="lg" onPress={continueGame} isPending={pending} isDisabled={pending}>继续游戏</Button></Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function InviteJoin({ code, config, onJoined }: { code: string; config: RuntimeConfig; onJoined: (room: RoomPayload) => void }) {
  const [token, setToken] = useState<string | null>(config.turnstileBypass ? "dev-bypass" : null);
  const [epoch, setEpoch] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"player" | "spectator">("player");

  async function join(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      onJoined(
        await api<RoomPayload>(`/api/rooms/${encodeURIComponent(code)}/join`, {
          method: "POST",
          body: JSON.stringify({ turnstileToken: token, role }),
        }),
      );
    } catch (caught) {
      setError(messageFrom(caught));
      setToken(config.turnstileBypass ? "dev-bypass" : null);
      setEpoch((value) => value + 1);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="centered-shell">
      <form className="invite-sheet" onSubmit={join}>
        <span className="invite-code">{code}</span>
        <h1>朋友邀请你加入房间</h1>
        <p>参与作答只能在开局前加入；选择观战可随时查看实时答案与全部记录。</p>
        <fieldset className="join-role">
          <legend>加入方式</legend>
          <label><input type="radio" name="inviteRole" checked={role === "player"} onChange={() => setRole("player")} /> 参与作答</label>
          <label><input type="radio" name="inviteRole" checked={role === "spectator"} onChange={() => setRole("spectator")} /> 观战</label>
        </fieldset>
        {!config.turnstileBypass && <TurnstileWidget key={epoch} action="join_room" siteKey={config.turnstileSiteKey} onToken={setToken} />}
        <Button fullWidth size="lg" type="submit" isPending={pending} isDisabled={!token || pending}>{role === "spectator" ? "进入观战" : "加入房间"}</Button>
        <div className="status-region" role="alert">{error}</div>
      </form>
    </main>
  );
}

function RoomHeader({ room }: { room: RoomPayload }) {
  return (
    <header className="room-header">
      <a href="/" className="brand" aria-label="Tecitest 首页"><span>Tecitest</span></a>
      <div className="room-identity">
        <span>房间</span>
        <strong>{room.code}</strong>
      </div>
    </header>
  );
}

function Lobby({ room, onChange }: { room: RoomPayload; onChange: (room: RoomPayload) => void }) {
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const players = room.members.filter((member) => member.role === "player");
  const presentCount = players.filter((member) => member.isPresent).length;
  const spectatorCount = room.members.filter((member) => member.role === "spectator").length;
  const isHost = room.currentUserId === room.hostId;

  async function copyInvite() {
    await navigator.clipboard.writeText(room.inviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_800);
  }

  async function start() {
    setPending(true);
    setError(null);
    try {
      onChange(await api<RoomPayload>(`/api/rooms/${room.code}/start`, { method: "POST" }));
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="lobby-layout">
      <div className="lobby-copy">
        <h1>等朋友加入</h1>
        <p>分享房间码，准备好就开局。</p>
        <div className="room-code-display" aria-label={`房间码 ${room.code}`}>
          {room.code.split("").map((letter, index) => <span key={`${letter}-${index}`}>{letter}</span>)}
        </div>
        <Button variant="outline" onPress={copyInvite}>{copied ? <Check weight="bold" /> : <LinkSimple weight="bold" />}{copied ? "邀请链接已复制" : "复制邀请链接"}</Button>
      </div>

      <div className="player-notes">
        <div className="notes-heading">
          <UsersThree weight="duotone" />
          <strong>{presentCount} / {players.length}</strong>
          <span>在线玩家 / 已加入{spectatorCount ? ` · ${spectatorCount} 位观战` : ""}</span>
        </div>
        <div className="player-notes-grid">
          {room.members.map((member, index) => (
            <div
              className={`player-note ${member.isPresent ? "is-present" : ""}`}
              style={{ "--note-tilt": `${[-1.5, 1.25, -0.75, 1.5][index % 4]}deg` } as React.CSSProperties}
              key={member.id}
            >
              <span>{member.name.slice(0, 1).toUpperCase()}</span>
              <strong>{member.name}</strong>
              <small>{member.isHost ? <><CrownSimple weight="fill" />房主</> : member.role === "spectator" ? "观战中" : member.isPresent ? "准备中" : "暂时离线"}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="lobby-action">
        <div><strong>词长 ≤ {room.settings.maxWordLength}</strong><span>每轮 {room.settings.roundSeconds} 秒{room.settings.ignoreCase ? " · 忽略英文大小写" : ""}</span></div>
        {isHost ? (
          <Button size="lg" onPress={start} isPending={pending} isDisabled={presentCount < 2 || pending}>开始第一轮 <ArrowRight weight="bold" /></Button>
        ) : (
          <p><HourglassMedium weight="duotone" /> {room.viewerRole === "spectator" ? "观战中，等房主开始" : "等房主开始"}</p>
        )}
        <div className="status-region" role="alert">{error}</div>
      </div>
    </section>
  );
}

function Game({ room, onChange }: { room: RoomPayload; onChange: (room: RoomPayload) => void }) {
  const [word, setWord] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = useNow();
  const me = room.members.find((member) => member.id === room.currentUserId);
  const remaining = room.deadlineAt ? Math.max(0, Math.ceil((room.deadlineAt - now) / 1000)) : 0;

  useEffect(() => {
    if (room.phase === "input" && !me?.hasSubmitted) {
      setWord("");
    }
  }, [me?.hasSubmitted, room.phase, room.roundNumber]);

  useEffect(() => {
    const confirmLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", confirmLeave);
    return () => window.removeEventListener("beforeunload", confirmLeave);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const next = await api<RoomPayload>(`/api/rooms/${room.code}/submit`, {
        method: "POST",
        body: JSON.stringify({ word }),
      });
      onChange(next);
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setPending(false);
    }
  }

  if (room.viewerRole === "spectator") return <SpectatorGame room={room} />;

  if (room.phase === "reveal" && room.latestRound) {
    return <RevealTransition room={room} />;
  }

  return (
    <section className="game-layout">
      <div className="round-heading">
        <div><span>第 {room.roundNumber} 轮</span><h1>{me?.hasSubmitted ? "等大家写好" : "写下此刻想到的词"}</h1></div>
        <div className={`countdown ${remaining <= 5 ? "is-urgent" : ""}`} aria-label={`剩余 ${remaining} 秒`}>
          <strong>{remaining}</strong><span>秒</span>
        </div>
      </div>

      <SubmissionRail room={room} />

      {!me?.hasSubmitted && (
        <form className="answer-sheet" onSubmit={submit}>
          {room.previousRound && (
            <div className="previous-round" aria-label={`第 ${room.previousRound.round} 轮答案回顾`}>
              <span className="previous-round-label">上一轮的词</span>
              <div className="previous-round-entries">
                {room.previousRound.entries.map((entry) => (
                  <span className="previous-round-entry" key={entry.memberId}>
                    <small>{entry.memberName}</small>
                    <strong>{entry.word ?? "未提交"}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
          <TextField fullWidth isRequired value={word} onChange={setWord} isInvalid={[...word].length > room.settings.maxWordLength}>
            <Label>你的词</Label>
            <Input autoFocus maxLength={room.settings.maxWordLength * 2} placeholder="先相信第一反应" autoComplete="off" />
            <Description>{[...word].length} / {room.settings.maxWordLength} 个字</Description>
            <FieldError>这个词太长了</FieldError>
          </TextField>
          <Button size="lg" type="submit" isPending={pending} isDisabled={!word.trim() || [...word.trim()].length > room.settings.maxWordLength || pending}>放进答案列</Button>
        </form>
      )}
      <div className="status-region" role="alert">{error}</div>
    </section>
  );
}

function SpectatorGame({ room }: { room: RoomPayload }) {
  const now = useNow();
  const players = room.members.filter((member) => member.role === "player");
  const remaining = room.deadlineAt ? Math.max(0, Math.ceil((room.deadlineAt - now) / 1000)) : 0;
  const liveEntries = room.phase === "reveal" && room.latestRound ? room.latestRound.entries : room.liveEntries;

  return (
    <section className="spectator-layout">
      <div className="round-heading">
        <div><span>观战模式 · 第 {room.roundNumber} 轮</span><h1>{room.phase === "reveal" ? "本轮答案" : "实时答案"}</h1></div>
        {room.deadlineAt && <div className={`countdown ${remaining <= 5 ? "is-urgent" : ""}`} aria-label={`剩余 ${remaining} 秒`}><strong>{remaining}</strong><span>秒</span></div>}
      </div>
      <p className="spectator-note">观战不参与作答或计分；已提交的词会立刻显示。</p>
      <div className="spectator-words" aria-label="本轮玩家答案">
        {liveEntries.map((entry) => (
          <article className="spectator-word" key={entry.memberId}><span>{entry.memberName}</span><strong>{entry.word ?? "未提交"}</strong></article>
        ))}
      </div>
      <WordHistory rounds={room.rounds} players={players} />
    </section>
  );
}

function WordHistory({ rounds, players }: { rounds: RoomPayload["rounds"]; players: RoomPayload["members"] }) {
  return (
    <div className="log-sheet spectator-history">
      <div className="log-heading"><div><h2>全部历史词</h2><p>从第一轮开始的完整记录。</p></div><span>{rounds.length} 轮</span></div>
      {rounds.length === 0 ? <p className="history-empty">本轮结束后，答案会保留在这里。</p> : (
        <div className="table-scroll"><table><thead><tr><th>轮次</th>{players.map((member) => <th key={member.id}>{member.name}</th>)}</tr></thead><tbody>
          {rounds.map((round) => <tr key={round.round}><th>第 {round.round} 轮</th>{players.map((member) => <td key={member.id}>{round.entries.find((entry) => entry.memberId === member.id)?.word ?? "未提交"}</td>)}</tr>)}
        </tbody></table></div>
      )}
    </div>
  );
}

function SubmissionRail({ room }: { room: RoomPayload }) {
  return (
    <div className="submission-rail" aria-label="答案提交进度">
      {room.members.filter((member) => member.role === "player").map((member) => (
        <div className={`submission-card ${member.hasSubmitted ? "is-submitted" : "is-waiting"}`} key={member.id}>
          <span>{member.name}</span>
          {member.hasSubmitted ? (
            <Spoiler hidden revealOn={false} className="invisible-ink" aria-label={`${member.name} 已提交答案`} theme="light" accentColor="#182328" density={0.2} fps={16} mimicWords={false}>同步封存</Spoiler>
          ) : <i className="submission-card-placeholder" aria-hidden="true" />}
        </div>
      ))}
    </div>
  );
}

function RevealTransition({ room }: { room: RoomPayload }) {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setHidden(false), 60);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section className="game-layout reveal-transition" aria-live="polite">
      <div className="round-heading"><div><span>第 {room.latestRound?.round} 轮</span><h1>一起翻开。</h1></div></div>
      <div className="submission-rail is-revealing">
        {room.latestRound?.entries.map((entry) => (
          <div className="submission-card is-submitted" key={entry.memberId}>
            <span>{entry.memberName}</span>
            <div className="reveal-word" style={wordLengthStyle(entry.word ?? "未提交")}><Spoiler hidden={hidden} revealOn={false} className="invisible-ink" aria-label={hidden ? `${entry.memberName} 已提交答案` : `${entry.memberName}：${entry.word ?? "未提交"}`} theme="light" accentColor="#182328" density={0.2} fps={16} mimicWords={false} noiseFadeDuration={620}>{entry.word ?? "未提交"}</Spoiler></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Results({ room }: { room: RoomPayload }) {
  const players = room.members.filter((member) => member.role === "player");
  const memberIds = players.map((member) => member.id);
  return (
    <section className="results-layout">
      <div className="winning-word"><span>第 {room.roundNumber} 轮，终于想到一起</span><h1 style={wordLengthStyle(room.winningWord ?? "")}>{room.winningWord}</h1><p>这一次，不需要解释。</p></div>
      <div className="log-sheet">
        <div className="log-heading"><div><h2>每一轮的答案</h2><p>从分歧到同词，完整记录都在这里。</p></div><span>{room.rounds.length} 轮</span></div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>轮次</th>{players.map((member) => <th key={member.id}>{member.name}</th>)}</tr></thead>
            <tbody>
              {room.rounds.map((round) => (
                <tr key={round.round} className={round.round === room.roundNumber ? "winning-row" : ""}>
                  <th>第 {round.round} 轮</th>
                  {memberIds.map((memberId) => <td key={memberId}>{round.entries.find((entry) => entry.memberId === memberId)?.word ?? "未提交"}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Button variant="outline" onPress={() => { window.location.href = "/"; }}>再开一个房间</Button>
    </section>
  );
}

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);
  return now;
}

function LoadingScreen() {
  return <main className="centered-shell"><div className="loading-mark"><Spinner size="lg" /><span>正在摆好答题板…</span></div></main>;
}

function FullPageMessage({ title, message }: { title: string; message: string }) {
  return <main className="centered-shell"><div className="message-sheet"><h1>{title}</h1><p>{message}</p><Button onPress={() => { window.location.href = "/"; }}>回到首页</Button></div></main>;
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "操作没有完成，请稍后重试。";
}
