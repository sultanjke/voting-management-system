export function isDuplicateHouseVote(alreadyExists: boolean): boolean {
  return alreadyExists;
}

export function calculateParticipation(responded: number, totalEligible: number): number {
  if (totalEligible <= 0) {
    return 0;
  }

  return Math.round((responded / totalEligible) * 100);
}
