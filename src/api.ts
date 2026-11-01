import type { ApiResult } from "./shared";

export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json()) as ApiResult<T>;
  if (!response.ok || "error" in payload) {
    const error = "error" in payload ? payload.error : { code: "request_failed", message: "请求失败。" };
    throw new ApiClientError(error.code, error.message, response.status);
  }
  return payload.data;
}
