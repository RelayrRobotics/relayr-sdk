import { describe, expect, test } from "bun:test";

import {
  createWebhookHandler,
  isLifecycleWebhookPayload,
  parseWebhookPayload,
} from "./webhook.js";
import { Relayr } from "./client.js";

describe("parseWebhookPayload lifecycle", () => {
  test("parses action_started", () => {
    const payload = parseWebhookPayload({
      type: "relayr.action_started",
      paidActionId: "pa_1",
      robotId: "rbt_1",
      action: "drive",
      streamUrl: "https://example.com/stream",
      price: 50,
      payMint: "USDG",
      userWallet: "0xabc",
      txSignature: "0xdead",
      status: "settling",
      ts: 1_700_000_000,
    });
    expect(payload.type).toBe("relayr.action_started");
  });

  test("parses action_completed / failed / settled", () => {
    for (const type of [
      "relayr.action_completed",
      "relayr.action_failed",
      "relayr.action_settled",
    ] as const) {
      const payload = parseWebhookPayload({
        type,
        paidActionId: "pa_1",
        status: "settled",
        outcome: "success",
        txSignature: "0xpay",
        clipUrl: null,
        videoHash: null,
        explorerUrl: "https://explorer.example/tx/0x",
        settlement: {
          gross: 100,
          operatorAmount: 88,
          stakersAmount: 5,
          treasuryAmount: 4,
          burnAmount: 3,
          paidOnChain: true,
        },
        ts: 1_700_000_001,
      });
      expect(isLifecycleWebhookPayload(payload)).toBe(true);
      expect(payload.type).toBe(type);
    }
  });

  test("rejects unknown types", () => {
    expect(() => parseWebhookPayload({ type: "relayr.unknown", ts: 1 })).toThrow(
      /Unsupported webhook type/,
    );
  });
});

describe("createWebhookHandler lifecycle ack", () => {
  test("acks lifecycle without calling complete", async () => {
    const relayr = new Relayr({ apiKey: "rl_test_key_xxxxxxxx" });
    let completeCalled = false;
    relayr.complete = (async () => {
      completeCalled = true;
      return {
        ok: true,
        paidActionId: "pa_1",
        status: "settled",
        clipUrl: null,
        videoHash: null,
      };
    }) as typeof relayr.complete;

    let lifecycleSeen = "";
    const handle = createWebhookHandler(
      relayr,
      async () => {
        throw new Error("robot handler should not run");
      },
      {
        onLifecycle: (p) => {
          lifecycleSeen = p.type;
        },
      },
    );

    const res = await handle(
      new Request("http://localhost/webhook", {
        method: "POST",
        body: JSON.stringify({
          type: "relayr.action_settled",
          paidActionId: "pa_1",
          status: "settled",
          outcome: "success",
          txSignature: "0xpay",
          clipUrl: null,
          videoHash: null,
          explorerUrl: null,
          settlement: null,
          ts: 1_700_000_002,
        }),
      }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; ignored?: boolean; type: string };
    expect(json.ok).toBe(true);
    expect(json.ignored).toBe(true);
    expect(json.type).toBe("relayr.action_settled");
    expect(lifecycleSeen).toBe("relayr.action_settled");
    expect(completeCalled).toBe(false);
  });
});
