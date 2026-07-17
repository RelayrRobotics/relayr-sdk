/**
 * Webhook robot bridge — Relayr pushes action_started events to your server.
 *
 * Usage:
 *   bun run demo:webhook -- --api-key rl_xxx --port 8787
 *   # Then set Operator Console → Settings → Webhook URL to your public URL
 */

import { Relayr, createWebhookHandler } from "../src/index";

function readArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

const apiKey = readArg("--api-key") ?? process.env.RELAYR_API_KEY;
const apiUrl = readArg("--api-url") ?? process.env.RELAYR_API_URL;
const port = Number(readArg("--port") ?? process.env.RELAYR_WEBHOOK_PORT ?? 8787);

if (!apiKey) {
  console.error("Missing RELAYR_API_KEY");
  process.exit(1);
}

const relayr = new Relayr({ apiKey, apiUrl });
await relayr.verify();

const handleWebhook = createWebhookHandler(
  relayr,
  async (command) => {
    console.log(
      `[relayr-webhook] running ${command.robotId}.${command.action}() — $${(command.price / 100).toFixed(2)}`,
    );

    const durationMs = Number(process.env.RELAYR_SIM_DURATION_MS ?? 4_000);
    await new Promise((resolve) => setTimeout(resolve, durationMs));

    return {
      outcome: "success",
      clipUrl: command.streamUrl,
    };
  },
  {
    onTest: async (payload) => {
      console.log(`[relayr-webhook] test ping from operator ${payload.operatorId}`);
    },
    onInvalid: async (error) => {
      console.error("[relayr-webhook] invalid payload:", error);
    },
  },
);

const server = Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/relayr/webhook") {
      return handleWebhook(req);
    }
    if (url.pathname === "/health") {
      return Response.json({ ok: true });
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log(`[relayr-webhook] listening on http://localhost:${server.port}/relayr/webhook`);
console.log("[relayr-webhook] paste that URL into Operator Console → Settings → Webhook");

process.on("SIGINT", () => {
  server.stop();
  process.exit(0);
});
