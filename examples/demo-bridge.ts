/**
 * Demo robot bridge — polls Relayr for paid commands and auto-completes them.
 *
 * Usage (pick one):
 *   bun run demo -- --api-key rl_xxx
 *   cp .env.example .env   # edit RELAYR_API_KEY, then:
 *   bun run demo
 */

import { Relayr } from "../src/index";

function readArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

const apiKey = readArg("--api-key") ?? process.env.RELAYR_API_KEY;
const apiUrl = readArg("--api-url") ?? process.env.RELAYR_API_URL;

if (!apiKey) {
  console.error("Missing RELAYR_API_KEY.\n");
  console.error("Rotate a key in Operator Console → Settings, then run ONE of:");
  console.error("  bun run demo -- --api-key rl_xxx");
  console.error("  cp .env.example .env  # add key, then: bun run demo");
  process.exit(1);
}

const relayr = new Relayr({
  apiKey,
  apiUrl,
  robotId: process.env.RELAYR_ROBOT_ID,
  pollIntervalMs: Number(process.env.RELAYR_POLL_MS ?? 2_000),
});

await relayr.verify();
console.log(`[relayr-sdk] listening on ${relayr.apiUrl}`);

const listener = relayr.listen(
  async (command) => {
    console.log(
      `[relayr-sdk] running ${command.robotId}.${command.action}() — $${(command.price / 100).toFixed(2)}`,
    );
    console.log(`[relayr-sdk] stream: ${command.streamUrl}`);

    const durationMs = Number(process.env.RELAYR_SIM_DURATION_MS ?? 8_000);
    await new Promise((resolve) => setTimeout(resolve, durationMs));

    return {
      outcome: "success",
      clipUrl: command.streamUrl,
    };
  },
  {
    onError: (error, context) => {
      console.error(`[relayr-sdk] ${context} error:`, error);
    },
  },
);

const shutdown = () => {
  console.log("\n[relayr-sdk] shutting down...");
  listener.stop();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await listener.done;
console.log("[relayr-sdk] stopped");
