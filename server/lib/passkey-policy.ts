export const PASSKEY_CHALLENGE_TTL_MINUTES = 5;

export function createPasskeyChallengeExpiry(
  now: Date = new Date(),
  ttlMinutes: number = PASSKEY_CHALLENGE_TTL_MINUTES
): Date {
  return new Date(now.getTime() + ttlMinutes * 60 * 1000);
}

export function isPasskeyChallengeExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export function isPasskeyChallengeUsable(input: { expiresAt: Date; usedAt: Date | null }, now: Date = new Date()): boolean {
  if (input.usedAt) {
    return false;
  }

  return !isPasskeyChallengeExpired(input.expiresAt, now);
}
