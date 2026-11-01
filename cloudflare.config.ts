import { bindings, defineConfig, exports } from "cf/config";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import * as entrypoint from "./worker/index.ts" with { type: "cf-worker" };

if (existsSync(".env")) {
  loadEnvFile(".env");
}

export default defineConfig(({ mode }) => {
  const isDevelopment = mode === "development";
  return {
    worker: {
      name: "tacitester",
      entrypoint,
      compatibilityDate: "2026-10-30",
      compatibilityFlags: ["nodejs_compat"],
      assets: {
        notFoundHandling: "single-page-application",
        runWorkerFirst: ["/api/*"],
      },
      env: {
        ROOMS: bindings.kv({
          id: process.env.CLOUDFLARE_KV_NAMESPACE_ID,
          dev: { remote: false },
        }),
        TURNSTILE_SECRET: bindings.secret(),
        ACCESS_TEAM_DOMAIN: bindings.text(process.env.ACCESS_TEAM_DOMAIN ?? ""),
        ACCESS_AUD: bindings.text(process.env.ACCESS_AUD ?? ""),
        TURNSTILE_SITE_KEY: bindings.text(process.env.TURNSTILE_SITE_KEY ?? "1x00000000000000000000AA"),
        TURNSTILE_HOSTNAMES: bindings.text(process.env.TURNSTILE_HOSTNAMES ?? "localhost,127.0.0.1"),
        INSTANCE_ADMIN_EMAIL: bindings.text(process.env.INSTANCE_ADMIN_EMAIL ?? (isDevelopment ? "developer@example.com" : "")),
        DEV_AUTH_EMAIL: isDevelopment ? bindings.text("developer@example.com") : undefined,
        DEV_TURNSTILE_BYPASS: isDevelopment ? bindings.text("true") : undefined,
      },
      exports: {
        Room: exports.durableObject({ state: "deleted" }),
        RoomV2: exports.durableObject({ storage: "sqlite" }),
      },
      observability: {
        enabled: true,
        redactQueryString: true,
        logs: { enabled: true, headSamplingRate: 1 },
        traces: { enabled: true, headSamplingRate: 0.05 },
      },
    },
  };
});
