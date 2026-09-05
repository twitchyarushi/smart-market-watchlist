// lib/tiering.ts

export type RawTier = "NORMAL" | "WATCH" | "HIGH";
export type DisplayTier = "NORMAL" | "WATCH" | "NEW_SPIKE" | "SUSTAINED" | "COOLING_OFF";

export interface TierThresholds {
  watchZScore: number;
  highZScore: number;
  highVolumeRatio: number;
}

// Starting thresholds — tune these once you see real data distributions.
// Defensible reasoning stated here: 2 std devs ≈ "unusual" in a roughly normal
// distribution of daily returns; volume ratio > 2x average flags real participation.
export const DEFAULT_THRESHOLDS: TierThresholds = {
  watchZScore: 1.0,
  highZScore: 2.0,
  highVolumeRatio: 2.0,
};

/**
 * Computes today's raw tier from a single day's stats.
 * No history/state involved — that's handled separately by computeStreak.
 */
export function computeRawTier(
  zScore: number,
  volumeRatio: number,
  thresholds: TierThresholds = DEFAULT_THRESHOLDS
): RawTier {
  const absZ = Math.abs(zScore);

  // HIGH requires both an unusual move AND volume backing it —
  // this is the "price move without volume might just be a thin/illiquid print" guard.
  if (absZ >= thresholds.highZScore && volumeRatio >= thresholds.highVolumeRatio) {
    return "HIGH";
  }

  if (absZ >= thresholds.watchZScore || volumeRatio >= thresholds.highVolumeRatio) {
    return "WATCH";
  }

  return "NORMAL";
}

export interface StreakResult {
  streakCount: number;
  displayTier: DisplayTier;
}

/**
 * Turns today's raw tier + yesterday's state into a display tier.
 * This is the "sequence, not snapshot" logic — the actual differentiator.
 */
export function computeStreak(
  todayRawTier: RawTier,
  yesterday: { rawTier: RawTier; streakCount: number } | null
): StreakResult {
  if (todayRawTier === "HIGH") {
    const streakCount =
      yesterday?.rawTier === "HIGH" ? yesterday.streakCount + 1 : 1;

    return {
      streakCount,
      displayTier: streakCount === 1 ? "NEW_SPIKE" : "SUSTAINED",
    };
  }

  // Not HIGH today — check if we're cooling off from a HIGH yesterday
  const wasHighYesterday = yesterday?.rawTier === "HIGH";

  return {
    streakCount: 0,
    displayTier: wasHighYesterday ? "COOLING_OFF" : todayRawTier,
  };
}