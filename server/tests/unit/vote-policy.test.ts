import { describe, expect, it } from "vitest";

import { calculateParticipation, isDuplicateHouseVote } from "@/lib/vote-policy";

describe("vote policy", () => {
  it("identifies duplicate house submissions", () => {
    expect(isDuplicateHouseVote(true)).toBe(true);
    expect(isDuplicateHouseVote(false)).toBe(false);
  });

  it("calculates participation percentage", () => {
    expect(calculateParticipation(20, 80)).toBe(25);
    expect(calculateParticipation(0, 0)).toBe(0);
  });
});
