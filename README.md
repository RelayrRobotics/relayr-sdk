# @relayrrobotics/sdk

Connect your robot to Relayr, execute paid actions, and report proof back to the dashboard.

Default API: `https://api.relayr.tech`

## Install

```bash
npm i @relayrrobotics/sdk
```

Inside the Relayr monorepo you can import the source directly with Bun:

```bash
cd packages/sdk
bun install
```

## Quickstart (poll mode)

Rotate an API key in **Operator Console → Settings**, then:

```bash
cp .env.example .env   # add RELAYR_API_KEY
bun run demo
```

```ts
import { Relayr } from "@relayrrobotics/sdk";

const relayr = new Relayr({
  apiKey: process.env.RELAYR_API_KEY!,
  robotId: "rbt_your_robot", // optional filter
  // pollIntervalMs: 2000 — keep ≥1–2s; prefer webhooks in production to avoid API load
});

await relayr.verify();

const listener = relayr.listen(async (command) => {
  console.log(`Running ${command.robotId}.${command.action}()`);
  // command.txSignature is string | null — null until chain settlement (or under MOCK_PAY)
  await myRobot.run(command.action);
  return {
    outcome: "success",
    clipUrl: await myRobot.recordClip(),
    videoHash: await myRobot.hashClip(),
  };
});

process.on("SIGINT", () => listener.stop());
await listener.done;
```

## Webhook mode (push)

Relayr can POST `relayr.action_started` events to your server instead of polling.

Outbound requests include **`X-Relayr-Signature: sha256=<hex>`** (HMAC-SHA256 of the raw JSON body) signed with your per-operator webhook secret (`whsec_…`). Reveal or rotate it in **Operator Console → Settings**.

```bash
bun run demo:webhook
# Set Operator Console → Settings → Webhook URL to your public endpoint
# Set RELAYR_WEBHOOK_SECRET from Settings → reveal webhook secret
```

```ts
import { Relayr, createWebhookHandler } from "@relayrrobotics/sdk";

const relayr = new Relayr({
  apiKey: process.env.RELAYR_API_KEY!,
  webhookSecret: process.env.RELAYR_WEBHOOK_SECRET, // required in production
});

const handleWebhook = createWebhookHandler(relayr, async (command) => {
  await myRobot.run(command.action);
  return { outcome: "success", clipUrl: command.streamUrl };
});

Bun.serve({
  port: 8787,
  fetch(req) {
    if (new URL(req.url).pathname === "/relayr/webhook") {
      return handleWebhook(req);
    }
    return new Response("Not found", { status: 404 });
  },
});
```

When `webhookSecret` is set (constructor or handler options), missing/invalid signatures are rejected with **401**.

The `examples/webhook-server.ts` demo is **not** production-ready: add signature verification, rate limiting, and auth before exposing a public endpoint.

### Signature format

| Item | Value |
|------|--------|
| Header | `X-Relayr-Signature` |
| Format | `sha256=<64-char hex>` (HMAC-SHA256 over raw body UTF-8) |

## `txSignature` nullable

`command.txSignature` / webhook `txSignature` is `string | null`:

- **string** — payment has a chain signature (or a mock signature in some local setups)
- **null** — payment still pending settlement, or no real chain signature was recorded yet (e.g. early webhook / mock pay paths)

Do not assume a signature is always present when an action starts.

## API

| Method | Description |
|--------|-------------|
| `verify()` | Health check + API key validation |
| `listCommands()` | Fetch settling paid actions |
| `complete(id, input)` | Report outcome + proof (idempotent if already settled) |
| `listen(handler, options?)` | Poll loop with retries and graceful `stop()` |
| `createWebhookHandler(relayr, handler, options?)` | Verify signature (optional), run handler, complete |

### Listen options

- `signal` — external `AbortSignal`
- `onError(error, context)` — `poll` \| `handler` \| `complete`
- `maxRetries` — default `8`
- `retryBaseMs` — default `1000`

Returns `{ stop(), done }`.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RELAYR_API_KEY` | — | Operator API key (`rl_…`) |
| `RELAYR_API_URL` | `https://api.relayr.tech` | Relayr API base URL |
| `RELAYR_ROBOT_ID` | — | Optional robot filter |
| `RELAYR_POLL_MS` | `2000` | Poll interval for `listen()` |
| `RELAYR_WEBHOOK_SECRET` | — | HMAC secret (`whsec_…`) for webhook verification |

## Build & test

```bash
bun run build
bun test
```

## License

MIT
