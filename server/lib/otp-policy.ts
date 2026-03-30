export function isOtpExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export function remainingCooldownSeconds(createdAt: Date, cooldownSeconds: number, now: Date = new Date()): number {
  const elapsed = Math.floor((now.getTime() - createdAt.getTime()) / 1000);
  return Math.max(0, cooldownSeconds - elapsed);
}
