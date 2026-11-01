# 默契词测试

一个受 Cloudflare Access 保护的多人同步词汇游戏。2–10 人先在房间中各自输入词汇，系统同时翻牌；当所有人的答案完全一致时结束，并展示每轮日志。

## 技术栈

- Cloudflare Workers + Static Assets
- Durable Objects（每个房间的强一致状态与计时）
- KV（房间码索引与已结束日志）
- Vite + React 19 + HeroUI v3 + Tailwind CSS v4
- Cloudflare Access + Turnstile
- pnpm

## 本地开发

需要 Node.js 22.23+ 和 pnpm。

```bash
pnpm install
TURNSTILE_SECRET=dev-placeholder pnpm dev
```

打开 `http://localhost:5173`。开发模式使用本地 Durable Objects/KV，并启用明确限定在开发配置中的 Access 与 Turnstile 旁路。需要模拟第二位用户时，可以给 API 请求添加 `x-dev-auth-email` 请求头；生产构建不会声明或接受这个旁路。

常用检查：

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Cloudflare 资源配置

部署前需要准备：

1. 一个 KV namespace，把它的 ID 写入本机未提交的环境配置 `CLOUDFLARE_KV_NAMESPACE_ID`。
2. 一个 Turnstile widget，把 site key 写入 `TURNSTILE_SITE_KEY`，把允许的生产主机名写入 `TURNSTILE_HOSTNAMES`。
3. 把 Turnstile secret 以 Workers secret `TURNSTILE_SECRET` 保存；不要写进 `.env` 或仓库。
4. 一个 Cloudflare Access Self-hosted application，覆盖 Worker 的生产域名，并配置允许登录的身份策略。
5. 把 Access team domain（例如 `https://team.cloudflareaccess.com`）写入 `ACCESS_TEAM_DOMAIN`，把应用的 AUD tag 写入 `ACCESS_AUD`。
6. 把允许管理所有房间的单个登录邮箱写入 `INSTANCE_ADMIN_EMAIL`。该用户登录后会直接进入 `/admin`，可查看所有房间、玩家在线状态并关闭房间。

### 清空当前 Durable Objects

当前配置会在下一次部署时删除旧的 `Room` Durable Object namespace，并启用新的 `RoomV2` namespace。因此，执行下面的部署会永久删除旧 namespace 内的全部实例和存储；仅在确认没有需要保留的房间时执行。

```bash
pnpm deploy
```

之后，管理员关闭房间或房间超时关闭时，应用会调用 `storage.deleteAll()` 清空该房间的 Durable Object 存储。不要移除 `cloudflare.config.ts` 中的 `Room` 删除标记，直到部署输出明确提示该 tombstone 已过期并可移除。

复制 [.env.example](./.env.example) 为未提交的 `.env` 后，`cloudflare.config.ts` 会在本地开发和部署时读取其中的非秘密变量；已经由终端或 CI 提供的环境变量保持优先。配置也会声明 KV、SQLite Durable Object、Static Assets 和可观测性。

应用 API 会验证 Access 签发的 `Cf-Access-Jwt-Assertion`，并验证 Turnstile token 的成功状态、action 与 hostname。即使入口层的 Access 规则被误改，API 也不会把缺少有效 Access 身份的请求当作已登录用户。

## 部署

先登录 Cloudflare，再执行生产构建与部署：

```bash
pnpm cf auth login
pnpm build
pnpm deploy
```

首次部署后，在 Workers 设置中确认 `TURNSTILE_SECRET` 已作为 secret 存在，并将实际 Worker 域名加入 Access application 与 Turnstile widget 的允许域名。不要在 Access 策略和 Turnstile hostname 完成前公开生产地址。

## 规则说明

- 房主设置最大词长（Unicode code point）与单轮秒数，默认 30 秒。
- 房间开始后立即锁定，不能再加入。
- 倒计时结束会强制结算；未输入者在日志中显示为“未提交”。
- 所有答案在同一轮完成后一起揭晓；NFC 规范化并去除首尾空白后，答案需要逐字相同。
- 未开局房间创建 30 分钟后解散；已完成房间保留 1 小时后自动关闭；完成日志保留 7 天。

产品与设计约束见 [PRODUCT.md](./PRODUCT.md)。
