const DEFAULT_NEXT_PATH = "/dashboard";
const MAX_NEXT_PATH_LENGTH = 2048;

/**
 * Allow only in-app relative paths. Rejects protocol-relative URLs, schemes,
 * backslashes, and common percent-encoding tricks used for open redirects.
 */
export function safeNextPath(
  value: string | null | undefined,
  fallback: string = DEFAULT_NEXT_PATH,
): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_NEXT_PATH_LENGTH) {
    return fallback;
  }

  const decoded = fullyDecodeUri(value);
  if (decoded === null) {
    return fallback;
  }

  if (!decoded.startsWith("/") || decoded.startsWith("//")) {
    return fallback;
  }

  const lower = decoded.toLowerCase();
  if (
    lower.includes("javascript:") ||
    lower.includes("vbscript:") ||
    lower.includes("data:") ||
    lower.includes("://") ||
    decoded.includes("\\") ||
    decoded.includes("?") ||
    decoded.includes("#") ||
    /[\u0000-\u001f\u007f\s<>'"]/.test(decoded)
  ) {
    return fallback;
  }

  return decoded;
}

function fullyDecodeUri(value: string): string | null {
  let current = value;
  for (let i = 0; i < 5; i += 1) {
    try {
      const next = decodeURIComponent(current);
      if (next === current) {
        return current;
      }
      current = next;
    } catch {
      return null;
    }
  }
  return null;
}
