import { describe, expect, it } from "vitest";

import { isOtpExpired, remainingCooldownSeconds } from "@/lib/otp-policy";

describe("otp policy", () => {
  it("detects expired OTP windows", () => {
    const now = new Date("2026-03-28T10:00:00.000Z");
    expect(isOtpExpired(new Date("2026-03-28T09:59:59.000Z"), now)).toBe(true);
    expect(isOtpExpired(new Date("2026-03-28T10:05:00.000Z"), now)).toBe(false);
  });

  it("returns cooldown remaining seconds", () => {
    const now = new Date("2026-03-28T10:00:30.000Z");
    const createdAt = new Date("2026-03-28T10:00:00.000Z");

    expect(remainingCooldownSeconds(createdAt, 45, now)).toBe(15);
    expect(remainingCooldownSeconds(createdAt, 10, now)).toBe(0);
  });
});
