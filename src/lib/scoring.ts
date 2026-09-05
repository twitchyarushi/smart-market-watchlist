// lib/scoring.ts

/**
 * Z-score of today's % change relative to the stock's own recent volatility.
 * A 2% move means something different for a calm stock vs a volatile one —
 * this is what makes the threshold "per-stock" instead of a fixed % cutoff.
 */
export function computeZScore(
  todayPctChange: number,
  historicalPctChanges: number[] // last N days, not including today
): number {
  const n = historicalPctChanges.length;
  if (n < 2) return 0; // not enough history — caller should treat this as "insufficient data"

  const mean = historicalPctChanges.reduce((a, b) => a + b, 0) / n;
  const variance =
    historicalPctChanges.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0; // avoid divide-by-zero on a dead-flat stock
  return (todayPctChange - mean) / stdDev;
}

export function computeVolumeRatio(
  todayVolume: number,
  historicalVolumes: number[]
): number {
  const n = historicalVolumes.length;
  if (n === 0) return 1; // neutral default when there's no history yet

  const avgVolume = historicalVolumes.reduce((a, b) => a + b, 0) / n;
  if (avgVolume === 0) return 1;
  return todayVolume / avgVolume;
}