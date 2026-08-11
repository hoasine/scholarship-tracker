import { describe, expect, it } from "vitest";
import {
  isAllowedEvidenceUrl,
  parseUrlList,
  validateEvidenceUrls,
} from "@/lib/utils/urls";

describe("evidence URL helpers", () => {
  it("parses comma and newline lists", () => {
    expect(parseUrlList("https://a.com, https://b.com\nhttps://c.com")).toEqual([
      "https://a.com",
      "https://b.com",
      "https://c.com",
    ]);
  });

  it("accepts public http(s) URLs", () => {
    expect(isAllowedEvidenceUrl("https://example.com/report")).toBe(true);
    expect(validateEvidenceUrls("https://example.com/a, https://example.com/b")).toBe(
      "https://example.com/a,https://example.com/b"
    );
  });

  it("rejects non-http schemes and localhost", () => {
    expect(isAllowedEvidenceUrl("ftp://example.com")).toBe(false);
    expect(isAllowedEvidenceUrl("https://localhost/page")).toBe(false);
    expect(() => validateEvidenceUrls("http://127.0.0.1/x")).toThrow(/Private or local/);
    expect(() => validateEvidenceUrls("example.com")).toThrow(/http:\/\/ or https:\/\//);
  });

  it("allows empty input", () => {
    expect(validateEvidenceUrls("")).toBe("");
    expect(validateEvidenceUrls("   ")).toBe("");
  });
});
