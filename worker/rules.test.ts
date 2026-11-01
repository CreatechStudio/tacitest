import { describe, expect, it } from "vitest";
import { isAgreement, isInactiveRound, normalizeWord, wordLength } from "./rules";
import { isInstanceAdmin } from "./security";

describe("word rules", () => {
  it("trims and NFC-normalizes submitted words", () => {
    expect(normalizeWord("  e\u0301  ")).toBe("é");
  });

  it("counts Unicode code points instead of UTF-16 code units", () => {
    expect(wordLength("海🌊")).toBe(2);
  });

  it("ends only when at least two complete answers match exactly", () => {
    expect(isAgreement(["海边", "海边"])).toBe(true);
    expect(isAgreement(["海边", "海邊"])).toBe(false);
    expect(isAgreement(["海边", null])).toBe(false);
    expect(isAgreement(["海边"])).toBe(false);
  });

  it("can ignore English letter case when the room enables it", () => {
    expect(isAgreement(["Apple", "apple"], true)).toBe(true);
    expect(isAgreement(["Apple", "apple"])).toBe(false);
    expect(isAgreement(["海边", "海邊"], true)).toBe(false);
  });

  it("marks a round inactive when nobody submits or nobody is online", () => {
    expect(isInactiveRound([null, null], false)).toBe(true);
    expect(isInactiveRound(["海边", "山顶"], true)).toBe(true);
    expect(isInactiveRound(["海边", null], false)).toBe(false);
  });
});

describe("instance administrator", () => {
  it("matches the configured email without regard to case or surrounding whitespace", () => {
    expect(isInstanceAdmin(
      { id: "user-1", name: "管理员", email: "Admin@Example.com" },
      { INSTANCE_ADMIN_EMAIL: " admin@example.com " } as Env,
    )).toBe(true);
  });

  it("does not grant access when no administrator email is configured", () => {
    expect(isInstanceAdmin(
      { id: "user-1", name: "管理员", email: "admin@example.com" },
      { INSTANCE_ADMIN_EMAIL: "" } as Env,
    )).toBe(false);
  });
});
