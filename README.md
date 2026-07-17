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
});

await relayr.verify();

const listener = relayr.listen(async (command) => {
  console.log(`Running ${command.robotId}.${command.action}()`);
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

```bash
bun run demo:webhook
# Set Operator Console → Settings → Webhook URL to your public endpoint
```

```ts
import { Relayr, createWebhookHandler } from "@relayrrobotics/sdk";

const relayr = new Relayr({ apiKey: process.env.RELAYR_API_KEY! });

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

## API

| Method | Description |
|--------|-------------|
| `verify()` | Health check + API key validation |
| `listCommands()` | Fetch settling paid actions |
| `complete(id, input)` | Report outcome + proof |
| `listen(handler, options?)` | Poll loop with retries and graceful `stop()` |

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

## Build & test

```bash
bun run build
bun test

# Live integration test (optional)
RELAYR_API_KEY=rl_xxx bun test
```

## Publish

Published to npm as `@relayrrobotics/sdk` under the [relayrrobotics](https://www.npmjs.com/org/relayrrobotics) org.

```bash
npm publish --access public
```

## License

MIT
