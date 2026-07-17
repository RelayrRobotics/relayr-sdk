import { createHmac, timingSafeEqual } from "node:crypto";

/** Header Relayr sets on outbound webhooks. Format: `sha256=<hex>`. */
export const RELAYR_SIGNATURE_HEADER = "X-Relayr-Signature";

/** HMAC-SHA256 hex digest of the raw request body. */
export function signWebhookBody(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

/**
 * Verify `X-Relayr-Signature` against the raw body.
 * Accepts `sha256=<hex>` (preferred) or bare hex.
 */
export function verifyWebhookSignature(
  body: string,
  signatureHeader: string | null | undefined,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;

  const provided = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length)
    : signatureHeader;

  const expected = signWebhookBody(secret, body);
  if (provided.length !== expected.length) return false;

  try {
    return timingSafeEqual(
      Buffer.from(provided, "utf8"),
      Buffer.from(expected, "utf8"),
    );
  } catch {
    return false;
  }
}
