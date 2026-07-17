# @relayrrobotics/sdk

Connect your robot to Relayr, execute paid actions, and report proof back to the dashboard.

Paid work arrives **after** a user settles USDG on Robinhood Chain mainnet via the **Settlement Splitter** (instant 88/5/4/3). Your robot must be **Activated** (`live`) in the Operator Console.

Default API: `https://api.relayr.tech`

## Install

```bash
npm i @relayrrobotics/sdk
```

## Quickstart (poll mode)

1. Operator Console → register robot → **Activate**
2. Settings → rotate API key (`rl_…`)
3. Run the bridge:

```bash
cp .env.example .env   # add RELAYR_API_KEY
bun run demo
```

```ts
import { Relayr } from "@relayrrobotics/sdk";

const relayr = new Relayr({
  apiKey: process.env.RELAYR_API_KEY!,
  robotId: "rbt_your_robot", // optional filter
  // pollIntervalMs: 2000 — keep ≥1–2s; prefer webhooks in production
});

await relayr.verify();

const listener = relayr.listen(async (command) => {
  console.log(`Running ${command.robotId}.${command.action}()`);
  // command.txSignature — Settlement Splitter pay tx on Robinhood mainnet
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

Users pay via `https://relayr.tech/pay?operatorId=…&actionId=…` or `@relayrrobotics/pay-widget`.

## Webhook mode (push)

Relayr POSTs lifecycle events to your server. **Run the robot on `relayr.action_started` only.**  
`action_completed` / `action_failed` / `action_settled` are acknowledged (200) and do not re-run your handler.

Outbound requests include **`X-Relayr-Signature: sha256=<hex>`** (HMAC-SHA256 of the raw JSON body) signed with your per-operator webhook secret (`whsec_…`). Reveal or rotate it in **Operator Console → Settings**.

```ts
import { Relayr, createWebhookHandler } from "@relayrrobotics/sdk";

const relayr = new Relayr({
  apiKey: process.env.RELAYR_API_KEY!,
  webhookSecret: process.env.RELAYR_WEBHOOK_SECRET, // required in production
});

const handleWebhook = createWebhookHandler(relayr, async (command) => {
  await myRobot.run(command.action);
  return { outcome: "success", clipUrl: command.streamUrl };
}, {
  onLifecycle: (event) => {
    // optional: log settled / failed — do not execute the robot again
    console.log(event.type, event.paidActionId);
  },
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

When `webhookSecret` is set, missing/invalid signatures are rejected with **401**.

### Webhook event types

| `type` | SDK behavior |
|--------|----------------|
| `relayr.action_started` | Run handler → `complete()` |
| `relayr.webhook_test` | Ack (`onTest`) |
| `relayr.action_completed` | Ack only (`onLifecycle`) |
| `relayr.action_failed` | Ack only (`onLifecycle`) |
| `relayr.action_settled` | Ack only (`onLifecycle`) |

### Signature format

| Item | Value |
|------|--------|
| Header | `X-Relayr-Signature` |
| Format | `sha256=<64-char hex>` (HMAC-SHA256 over raw body UTF-8) |

## `txSignature`

`command.txSignature` is the on-chain USDG pay transaction (Settlement Splitter) on Robinhood Chain. It is normally a hex hash when a command is delivered. Treat `null` as exceptional (do not assume payment failed solely from a null hash).

## API

| Method | Description |
|--------|-------------|
| `verify()` | Health check + API key validation |
| `listCommands()` | Fetch settling paid actions |
| `complete(id, input)` | Report outcome + proof (idempotent if already settled) |
| `listen(handler, options?)` | Poll loop with retries and graceful `stop()` |
| `createWebhookHandler(relayr, handler, options?)` | Verify signature, run on start, ack lifecycle |

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
