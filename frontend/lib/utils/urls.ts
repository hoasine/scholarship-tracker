/**
 * Client-side evidence URL validation (mirrors contract `_clean_urls` rules).
 * Rejects non-http(s) schemes and localhost / private hosts.
 */

const BLOCKED_HOST_TOKENS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "10.",
  "192.168.",
  "169.254.",
] as const;

export function parseUrlList(input: string): string[] {
  return String(input || "")
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 5);
}

export function isAllowedEvidenceUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return false;
  }
  const lower = trimmed.toLowerCase();
  return !BLOCKED_HOST_TOKENS.some((token) => lower.includes(token));
}

/** Validate and normalize a comma/newline-separated URL list. Empty input → "". */
export function validateEvidenceUrls(input: string): string {
  const parts = parseUrlList(input);
  if (parts.length === 0) return "";

  const cleaned: string[] = [];
  for (const part of parts) {
    if (!part.startsWith("http://") && !part.startsWith("https://")) {
      throw new Error("Evidence URLs must start with http:// or https://");
    }
    const lower = part.toLowerCase();
    for (const token of BLOCKED_HOST_TOKENS) {
      if (lower.includes(token)) {
        throw new Error("Private or local URLs are not allowed");
      }
    }
    cleaned.push(part.slice(0, 500));
  }
  return cleaned.join(",");
}
