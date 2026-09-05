import { describe, it, expect } from "vitest";
import { computeRawTier, computeStreak } from "../src/lib/tiering";
import { computeZScore, computeVolumeRatio } from "../src/lib/scoring";
describe("computeZScore", () => {
  it("returns 0 with insufficient history", () => {
    expect(computeZScore(5, [1])).toBe(0);
  });

  it("flags a big move for a calm stock", () => {
    const calmHistory = [0.1, -0.2, 0.3, -0.1, 0.2]; // low volatility
    const z = computeZScore(2.0, calmHistory);
    expect(Math.abs(z)).toBeGreaterThan(2);
  });

  it("does not flag the same move for a volatile stock", () => {
    const volatileHistory = [3, -4, 5, -3, 4]; // high volatility
    const z = computeZScore(2.0, volatileHistory);
    expect(Math.abs(z)).toBeLessThan(1);
  });
});

describe("computeRawTier", () => {
  it("is NORMAL for a small move with normal volume", () => {
    expect(computeRawTier(0.3, 1.0)).toBe("NORMAL");
  });

  it("is HIGH for a big z-score with high volume", () => {
    expect(computeRawTier(2.5, 3.0)).toBe("HIGH");
  });

  it("is WATCH for a big z-score but normal volume (no confirmation)", () => {
    expect(computeRawTier(2.5, 1.1)).toBe("WATCH");
  });
});

describe("computeStreak", () => {
  it("marks day 1 of a HIGH tier as NEW_SPIKE", () => {
    const result = computeStreak("HIGH", null);
    expect(result.displayTier).toBe("NEW_SPIKE");
    expect(result.streakCount).toBe(1);
  });

  it("marks day 2+ of consecutive HIGH as SUSTAINED", () => {
    const result = computeStreak("HIGH", { rawTier: "HIGH", streakCount: 1 });
    expect(result.displayTier).toBe("SUSTAINED");
    expect(result.streakCount).toBe(2);
  });

  it("marks a drop from HIGH as COOLING_OFF", () => {
    const result = computeStreak("NORMAL", { rawTier: "HIGH", streakCount: 3 });
    expect(result.displayTier).toBe("COOLING_OFF");
    expect(result.streakCount).toBe(0);
  });

  it("stays NORMAL if not coming off a HIGH streak", () => {
    const result = computeStreak("NORMAL", { rawTier: "NORMAL", streakCount: 0 });
    expect(result.displayTier).toBe("NORMAL");
  });
});