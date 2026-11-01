import type { AdminRoomSummary, RoomRole, RoomSettings, RoomSnapshot } from "../src/shared";
import { RoomV2, type AuthenticatedUser, type RoomRpcResult } from "./room";
import { authenticate, HttpError, isInstanceAdmin, verifyTurnstile } from "./security";

export { RoomV2 };

const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_PATTERN = /^[2-9A-HJ-NP-Z]{6}$/;
const API_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};
const SSE_HEADERS = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-store",
  "x-content-type-options": "nosniff",
};

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      return new Response("Not found", { status: 404 });
    }

    try {
      if (request.method === "GET" && url.pathname === "/api/config") {
        return json({
          data: {
            turnstileSiteKey: env.TURNSTILE_SITE_KEY,
            turnstileBypass: env.DEV_TURNSTILE_BYPASS === "true",
          },
        });
      }

      const user = await authenticate(request, env);
      if (request.method === "GET" && url.pathname === "/api/me") {
        return json({ data: { id: user.id, name: user.name, email: user.email, isInstanceAdmin: isInstanceAdmin(user, env) } });
      }

      if (url.pathname === "/api/admin/rooms" && request.method === "GET") {
        requireInstanceAdmin(user, env);
        return json({ data: { rooms: await listAdminRooms(env, ctx.exports.RoomV2) } });
      }

      const adminRoomMatch = url.pathname.match(/^\/api\/admin\/rooms\/([^/]+)\/close$/);
      if (adminRoomMatch && request.method === "POST") {
        requireInstanceAdmin(user, env);
        const code = normalizeCode(adminRoomMatch[1]);
        return adminRpcResponse(await ctx.exports.RoomV2.getByName(code).closeByAdmin());
      }

      if (request.method === "POST" && url.pathname === "/api/rooms") {
        const body = await readJson(request);
        await verifyTurnstile(request, env, body.turnstileToken, "create_room");
        const settings = parseSettings(body);
        const code = await createRoomCode(env);
        const result = await ctx.exports.RoomV2.getByName(code).create(code, user, settings);
        return rpcResponse(result, request);
      }

      const match = url.pathname.match(/^\/api\/rooms\/([^/]+)(?:\/(events|join|start|submit|continue))?$/);
      if (!match) {
        throw new HttpError(404, "not_found", "没有找到这个接口。");
      }

      const code = normalizeCode(match[1]);
      const action = match[2];
      const room = ctx.exports.RoomV2.getByName(code);

      if (request.method === "GET" && !action) {
        return rpcResponse(await room.snapshot(user), request);
      }
      if (request.method === "GET" && action === "events") {
        const result = await room.events(user);
        if (!result.ok) {
          return json({ error: { code: result.code, message: result.message } }, result.status);
        }
        return new Response(result.value, { headers: SSE_HEADERS });
      }
      if (request.method === "POST" && action === "join") {
        const body = await readJson(request);
        await verifyTurnstile(request, env, body.turnstileToken, "join_room");
        return rpcResponse(await room.join(user, parseRoomRole(body.role)), request);
      }
      if (request.method === "POST" && action === "start") {
        return rpcResponse(await room.start(user), request);
      }
      if (request.method === "POST" && action === "submit") {
        const body = await readJson(request);
        if (typeof body.word !== "string") {
          throw new HttpError(400, "invalid_word", "请输入一个词。");
        }
        return rpcResponse(await room.submit(user, body.word), request);
      }
      if (request.method === "POST" && action === "continue") {
        return rpcResponse(await room.continueGame(user), request);
      }

      throw new HttpError(405, "method_not_allowed", "这个操作不支持当前请求方式。");
    } catch (error) {
      if (error instanceof HttpError) {
        return json({ error: { code: error.code, message: error.message } }, error.status);
      }
      console.error(
        JSON.stringify({
          event: "request_failed",
          path: url.pathname,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return json({ error: { code: "internal_error", message: "服务暂时出了点问题，请稍后重试。" } }, 500);
    }
  },
} satisfies ExportedHandler<Env>;

async function createRoomCode(env: Env): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    const code = Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
    if (!(await env.ROOMS.get(`room:${code}`))) return code;
  }
  throw new HttpError(503, "code_generation_failed", "暂时无法创建房间，请稍后重试。");
}

function normalizeCode(value: string): string {
  const code = decodeURIComponent(value).trim().toUpperCase();
  if (!CODE_PATTERN.test(code)) {
    throw new HttpError(400, "invalid_room_code", "房间码应为 6 位字母或数字。");
  }
  return code;
}

function parseSettings(body: Record<string, unknown>): RoomSettings {
  const maxWordLength = Number(body.maxWordLength ?? 8);
  const roundSeconds = Number(body.roundSeconds ?? 30);
  const ignoreCase = body.ignoreCase === true;
  if (!Number.isInteger(maxWordLength) || maxWordLength < 1 || maxWordLength > 20) {
    throw new HttpError(400, "invalid_word_length", "词语长度应在 1–20 之间。");
  }
  if (!Number.isInteger(roundSeconds) || roundSeconds < 5 || roundSeconds > 300) {
    throw new HttpError(400, "invalid_round_time", "单轮时长应在 5–300 秒之间。");
  }
  return { maxWordLength, roundSeconds, ignoreCase };
}

function parseRoomRole(value: unknown): RoomRole {
  if (value === undefined || value === "player") return "player";
  if (value === "spectator") return "spectator";
  throw new HttpError(400, "invalid_room_role", "加入身份无效。");
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 8_192) {
    throw new HttpError(413, "payload_too_large", "请求内容过大。");
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new HttpError(415, "json_required", "请求必须使用 JSON 格式。");
  }
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "invalid_json", "请求内容不是有效的 JSON。");
  }
}

function rpcResponse(result: RoomRpcResult<RoomSnapshot>, request: Request): Response {
  if (!result.ok) {
    return json({ error: { code: result.code, message: result.message } }, result.status);
  }
  const inviteUrl = new URL(`/room/${result.value.code}`, request.url).toString();
  return json({ data: { ...result.value, inviteUrl } });
}

function adminRpcResponse<T>(result: RoomRpcResult<T>): Response {
  if (!result.ok) {
    return json({ error: { code: result.code, message: result.message } }, result.status);
  }
  return json({ data: result.value });
}

function requireInstanceAdmin(user: AuthenticatedUser, env: Env): void {
  if (!isInstanceAdmin(user, env)) {
    throw new HttpError(403, "admin_required", "只有实例管理员可以管理房间。");
  }
}

type AdminRoomNamespace = {
  getByName(code: string): {
    adminSnapshot(): Promise<RoomRpcResult<AdminRoomSummary>>;
  };
};

async function listAdminRooms(env: Env, rooms: AdminRoomNamespace): Promise<AdminRoomSummary[]> {
  const codes: string[] = [];
  let cursor: string | undefined;

  do {
    const page = await env.ROOMS.list({ prefix: "room:", cursor });
    codes.push(...page.keys.map((key) => key.name.slice("room:".length)));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  const results = await Promise.all(
    codes.map((code) => rooms.getByName(code).adminSnapshot()),
  );
  return results
    .flatMap((result) => result.ok ? [result.value] : [])
    .sort((left, right) => right.createdAt - left.createdAt);
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: API_HEADERS });
}
