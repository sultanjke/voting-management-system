import { describe, expect, it } from "vitest";

import {
  createPasskeyChallengeExpiry,
  isPasskeyChallengeExpired,
  isPasskeyChallengeUsable,
  PASSKEY_CHALLENGE_TTL_MINUTES
} from "@/lib/passkey-policy";

describe("passkey policy", () => {
  it("creates challenge expiry with default ttl", () => {
    const now = new Date("2026-04-04T10:00:00.000Z");
    const expiry = createPasskeyChallengeExpiry(now);
    expect(expiry.toISOString()).toBe("2026-04-04T10:05:00.000Z");
  });

  it("detects challenge expiry", () => {
    const expiresAt = new Date("2026-04-04T10:05:00.000Z");
    expect(isPasskeyChallengeExpired(expiresAt, new Date("2026-04-04T10:04:59.000Z"))).toBe(false);
    expect(isPasskeyChallengeExpired(expiresAt, new Date("2026-04-04T10:05:00.000Z"))).toBe(true);
  });

  it("marks challenge unusable when used or expired", () => {
    const now = new Date("2026-04-04T10:00:00.000Z");
    const expiresAt = createPasskeyChallengeExpiry(now, PASSKEY_CHALLENGE_TTL_MINUTES);

    expect(isPasskeyChallengeUsable({ expiresAt, usedAt: null }, now)).toBe(true);
    expect(isPasskeyChallengeUsable({ expiresAt, usedAt: new Date("2026-04-04T10:00:01.000Z") }, now)).toBe(false);
    expect(isPasskeyChallengeUsable({ expiresAt, usedAt: null }, new Date("2026-04-04T10:06:00.000Z"))).toBe(false);
  });
});
