import { describe, expect, it } from "vitest";

import { normalizeHouseCode, normalizePhone } from "@/lib/phone";

describe("normalizePhone", () => {
  it("normalizes +7 and 8-prefixed local format into +7 E.164-like format", () => {
    expect(normalizePhone("+7 777 123 4561")).toBe("+77771234561");
    expect(normalizePhone("8 (777) 123-45-61")).toBe("+77771234561");
  });

  it("strips formatting symbols", () => {
    expect(normalizePhone("+1 (234) 567-8901")).toBe("+12345678901");
  });
});

describe("normalizeHouseCode", () => {
  it("trims whitespace and uppercases", () => {
    expect(normalizeHouseCode("  b-202  ")).toBe("B-202");
  });
});
