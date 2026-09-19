import { timingSafeEqual } from "node:crypto";

const BEARER_PREFIX = "Bearer ";

export function isValidBearerToken(
  authHeader: string | null | undefined,
  expectedToken: string,
): boolean {
  if (!authHeader?.startsWith(BEARER_PREFIX) || !expectedToken) {
    return false;
  }

  const received = Buffer.from(authHeader.slice(BEARER_PREFIX.length));
  const expected = Buffer.from(expectedToken);

  if (received.length !== expected.length) {
    timingSafeEqual(expected, expected);
    return false;
  }

  return timingSafeEqual(received, expected);
}
