import { describe, expect, it } from "vitest";
import { anonymize, stripQuotedAndSignature } from "../src/training/privacy.js";

describe("training privacy", () => {
  it("redacts common direct identifiers", () => {
    expect(anonymize("Hi Sarah, email me at sarah@example.com or 303-555-0199.")).toBe("Hi [CLIENT], email me at [EMAIL] or [PHONE].");
  });
  it("removes quoted history", () => {
    expect(stripQuotedAndSignature("Current reply\nOn Monday Client wrote:\nOld content")).toBe("Current reply");
  });
});
