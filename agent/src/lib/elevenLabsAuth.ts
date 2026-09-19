import { createHmac, timingSafeEqual } from "node:crypto";

/** Maximum age of a valid webhook timestamp (seconds). Prevents replay attacks. */
const TIMESTAMP_TOLERANCE_SECS = 300; // 5 minutes

/**
 * Verify an ElevenLabs webhook signature.
 * Header format: ElevenLabs-Signature: t={unix_ts},v0={hmac_sha256_hex}
 * HMAC payload:  `${timestamp}.${raw_body}`
 *
 * Rejects if:
 *  - header is missing/malformed
 *  - HMAC does not match
 *  - timestamp is older than TIMESTAMP_TOLERANCE_SECS (replay attack)
 */
export function verifyElevenLabsSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  nowSecs: number = Math.floor(Date.now() / 1000),
): boolean {
  // Refuse to verify if the secret is not configured — prevents accepting
  // unauthenticated webhooks when the env var is accidentally empty.
  if (!secret) return false;

  const parts = Object.fromEntries(
    signatureHeader
      .split(",")
      .map((segment) => {
        const idx = segment.indexOf("=");
        return idx === -1
          ? [segment, ""]
          : [segment.slice(0, idx), segment.slice(idx + 1)];
      }),
  );

  const timestamp = parts["t"];
  const receivedSig = parts["v0"];
  if (!timestamp || !receivedSig) return false;

  // Reject stale webhooks to prevent replay attacks
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(nowSecs - ts) > TIMESTAMP_TOLERANCE_SECS) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(receivedSig, "hex"),
    );
  } catch {
    return false;
  }
}
