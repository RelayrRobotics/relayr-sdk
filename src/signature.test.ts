import { describe, expect, test } from "bun:test";

import {
  RELAYR_SIGNATURE_HEADER,
  signWebhookBody,
  verifyWebhookSignature,
} from "./signature.js";

describe("webhook signature", () => {
  const secret = "whsec_test_secret";
  const body = JSON.stringify({ type: "relayr.webhook_test", operatorId: "op", ts: 1 });

  test("exports Stripe-like header name", () => {
    expect(RELAYR_SIGNATURE_HEADER).toBe("X-Relayr-Signature");
  });

  test("verifies sha256=<hex> signatures", () => {
    const hex = signWebhookBody(secret, body);
    expect(verifyWebhookSignature(body, `sha256=${hex}`, secret)).toBe(true);
  });

  test("accepts bare hex for compatibility", () => {
    const hex = signWebhookBody(secret, body);
    expect(verifyWebhookSignature(body, hex, secret)).toBe(true);
  });

  test("rejects missing, wrong, or tampered signatures", () => {
    expect(verifyWebhookSignature(body, null, secret)).toBe(false);
    expect(verifyWebhookSignature(body, "sha256=deadbeef", secret)).toBe(false);
    expect(verifyWebhookSignature(body + "x", `sha256=${signWebhookBody(secret, body)}`, secret)).toBe(
      false,
    );
  });
});
