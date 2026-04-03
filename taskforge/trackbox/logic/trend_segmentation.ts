export interface PricePoint {
  timestamp: number
  priceUsd: number
}

export interface TrendResult {
  startTime: number
  endTime: number
  trend: 'upward' | 'downward' | 'neutral'
  changePct: number
  points: number
  avgSlopePctPerStep: number
  maxDrawdownPct: number
  maxRunupPct: number
}

export interface TrendOptions {
  /** minimum number of points in a segment */
  minSegmentLength?: number
  /** small % threshold to ignore micro flips between consecutive points (e.g., 0.1 = 0.1%) */
  pctTolerance?: number
  /** minimal absolute % change for a segment to be considered non-neutral */
  minChangePct?: number
  /** SMA window for optional smoothing before analysis (>=1 means no smoothing) */
  smoothWindow?: number
}

/**
 * Analyze a series of price points to determine overall trend segments.
 * Enhancements:
 *  - optional SMA smoothing
 *  - tolerance to ignore micro changes
 *  - neutral classification if absolute change below minChangePct
 *  - additional metrics per segment (points, avg slope, max drawdown/runup)
 */
export function analyzePriceTrends(
  points: PricePoint[],
  options: TrendOptions = {}
): TrendResult[] {
  const {
    minSegmentLength = 5,
    pctTolerance = 0.0,
    minChangePct = 0.0,
    smoothWindow = 1,
  } = options

  const data = smoothWindow > 1 ? smoothPoints(points, smoothWindow) : points.slice()
  const results: TrendResult[] = []
  if (data.length < minSegmentLength) return results

  const dirAt = (i: number): number => {
    const prev = data[i - 1].priceUsd
    const curr = data[i].priceUsd
    if (prev === 0) return 0
    const pct = ((curr - prev) / prev) * 100
    if (Math.abs(pct) <= pctTolerance) return 0
    return pct > 0 ? 1 : -1
  }

  let segStart = 0

  for (let i = 1; i < data.length; i++) {
    const currDir = dirAt(i)
    const nextDir = i + 1 < data.length ? dirAt(i + 1) : 0

    const reachedMin = i - segStart + 1 >= minSegmentLength
    const changeSoon =
      i === data.length - 1 || // last point closes a segment if long enough
      (currDir !== 0 && nextDir !== 0 && nextDir !== currDir) || // flip
      (currDir !== 0 && nextDir === 0 && i + 1 === data.length - 1) // near end w/ neutral

    if (reachedMin && changeSoon) {
      const start = data[segStart]
      const end = data[i]
      const changePct = pctChange(start.priceUsd, end.priceUsd)
      const trend: TrendResult['trend'] =
        Math.abs(changePct) < minChangePct ? 'neutral' : changePct > 0 ? 'upward' : 'downward'

      const slice = data.slice(segStart, i + 1)
      const metrics = segmentMetrics(slice)

      results.push({
        startTime: start.timestamp,
        endTime: end.timestamp,
        trend,
        changePct: round2(changePct),
        points: slice.length,
        avgSlopePctPerStep: round4(metrics.avgSlopePct),
        maxDrawdownPct: round2(metrics.maxDrawdownPct),
        maxRunupPct: round2(metrics.maxRunupPct),
      })

      segStart = i
    }
  }

  return mergeAdjacentNeutrals(results)
}

/** ---------- helpers ---------- */

function pctChange(a: number, b: number): number {
  if (a === 0) return 0
  return ((b - a) / a) * 100
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

/** Simple moving average smoothing (window >= 1) */
function smoothPoints(points: PricePoint[], window: number): PricePoint[] {
  if (window <= 1 || window > points.length) return points.slice()
  const half = Math.floor(window / 2)
  const out: PricePoint[] = new Array(points.length)
  const prefix: number[] = new Array(points.length + 1).fill(0)
  for (let i = 0; i < points.length; i++) prefix[i + 1] = prefix[i] + points[i].priceUsd

  for (let i = 0; i < points.length; i++) {
    const l = Math.max(0, i - half)
    const r = Math.min(points.length - 1, i + half)
    const len = r - l + 1
    const sum = prefix[r + 1] - prefix[l]
    out[i] = { timestamp: points[i].timestamp, priceUsd: sum / len }
  }
  return out
}

function segmentMetrics(slice: PricePoint[]): {
  avgSlopePct: number
  maxDrawdownPct: number
  maxRunupPct: number
} {
  // average slope per step in %
  let slopeSum = 0
  for (let i = 1; i < slice.length; i++) {
    slopeSum += pctChange(slice[i - 1].priceUsd, slice[i].priceUsd)
  }
  const avgSlopePct = slice.length > 1 ? slopeSum / (slice.length - 1) : 0

  // max drawdown / runup within the segment
  let peak = slice[0].priceUsd
  let trough = slice[0].priceUsd
  let maxDrawdownPct = 0
  let maxRunupPct = 0

  for (let i = 1; i < slice.length; i++) {
    const p = slice[i].priceUsd
    peak = Math.max(peak, p)
    trough = Math.min(trough, p)
    maxDrawdownPct = Math.min(maxDrawdownPct, pctChange(peak, p)) // negative or 0
    maxRunupPct = Math.max(maxRunupPct, pctChange(trough, p)) // positive or 0
  }

  return { avgSlopePct, maxDrawdownPct, maxRunupPct }
}

/** Merge consecutive neutral segments into one */
function mergeAdjacentNeutrals(segments: TrendResult[]): TrendResult[] {
  if (segments.length <= 1) return segments
  const merged: TrendResult[] = []
  let acc = segments[0]

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i]
    if (acc.trend === 'neutral' && seg.trend === 'neutral') {
      // merge ranges and recompute aggregates
      const points = acc.points + seg.points
      const changePct = pctChangeFromTimes(acc.changePct, seg.changePct) // approximate
      acc = {
        startTime: acc.startTime,
        endTime: seg.endTime,
        trend: 'neutral',
        changePct: round2(changePct),
        points,
        avgSlopePctPerStep: round4(
          (acc.avgSlopePctPerStep * acc.points + seg.avgSlopePctPerStep * seg.points) / points
        ),
        maxDrawdownPct: Math.min(acc.maxDrawdownPct, seg.maxDrawdownPct),
        maxRunupPct: Math.max(acc.maxRunupPct, seg.maxRunupPct),
      }
    } else {
      merged.push(acc)
      acc = seg
    }
  }
  merged.push(acc)
  return merged
}

/**
 * Approximate combined % change of two consecutive segments with small overlap logic.
 * (Assumes the end of A is the start of B; for neutral merges this is sufficient.)
 */
function pctChangeFromTimes(aPct: number, bPct: number): number {
  // convert to multipliers and multiply
  const aMul = 1 + aPct / 100
  const bMul = 1 + bPct / 100
  return (aMul * bMul - 1) * 100
}
