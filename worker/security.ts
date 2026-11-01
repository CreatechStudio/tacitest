import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AuthenticatedUser } from "./room";

type TurnstileResponse = {
  success: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

const jwksByDomain = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export async function authenticate(request: Request, env: Env): Promise<AuthenticatedUser> {
  if (env.DEV_AUTH_EMAIL) {
    const email = request.headers.get("x-dev-auth-email") ?? env.DEV_AUTH_EMAIL;
    const name = email === env.DEV_AUTH_EMAIL ? "本地玩家" : email.split("@")[0] || "测试玩家";
    return { id: `dev:${email}`, email, name };
  }

  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    throw new HttpError(401, "access_required", "请先通过 Cloudflare Access 登录。");
  }

  const issuer = env.ACCESS_TEAM_DOMAIN.replace(/\/$/, "");
  let jwks = jwksByDomain.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    jwksByDomain.set(issuer, jwks);
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      audience: env.ACCESS_AUD,
      issuer,
    });
    const email = typeof payload.email === "string" ? payload.email : "";
    const id = typeof payload.sub === "string" ? payload.sub : email;
    if (!email || !id) throw new Error("Missing identity claims");
    const preferredName = typeof payload.name === "string" ? payload.name.trim() : "";
    return {
      id,
      email,
      name: preferredName || email.split("@")[0] || "玩家",
    };
  } catch {
    throw new HttpError(401, "invalid_access_token", "登录状态无效，请刷新页面重新登录。");
  }
}

export function isInstanceAdmin(user: AuthenticatedUser, env: Env): boolean {
  const configuredEmail = env.INSTANCE_ADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(configuredEmail) && user.email.trim().toLowerCase() === configuredEmail;
}

export async function verifyTurnstile(
  request: Request,
  env: Env,
  token: unknown,
  expectedAction: "create_room" | "join_room",
): Promise<void> {
  if (env.DEV_TURNSTILE_BYPASS === "true") return;
  if (typeof token !== "string" || !token || token.length > 2048) {
    throw new HttpError(400, "turnstile_required", "请完成人机验证后再继续。");
  }

  const body = new FormData();
  body.set("secret", env.TURNSTILE_SECRET);
  body.set("response", token);
  body.set("idempotency_key", crypto.randomUUID());
  const remoteIp = request.headers.get("cf-connecting-ip");
  if (remoteIp) body.set("remoteip", remoteIp);

  let result: TurnstileResponse;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8_000),
    });
    result = (await response.json()) as TurnstileResponse;
  } catch {
    throw new HttpError(503, "turnstile_unavailable", "人机验证暂时不可用，请稍后重试。");
  }

  const allowedHostnames = env.TURNSTILE_HOSTNAMES.split(",")
    .map((hostname) => hostname.trim())
    .filter(Boolean);
  if (
    !result.success ||
    result.action !== expectedAction ||
    !result.hostname ||
    !allowedHostnames.includes(result.hostname)
  ) {
    console.warn(
      JSON.stringify({
        event: "turnstile_rejected",
        action: expectedAction,
        hostname: result.hostname,
        errors: result["error-codes"],
      }),
    );
    throw new HttpError(403, "turnstile_failed", "验证没有通过，请重新验证后再试。");
  }
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
