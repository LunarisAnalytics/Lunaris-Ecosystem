export interface VolumePoint {
  timestamp: number
  volumeUsd: number
}

export interface SpikeEvent {
  timestamp: number
  volume: number
  spikeRatio: number
  avgWindowVolume: number
  windowSize: number
}

/**
 * Detects spikes in trading volume compared to a rolling average window.
 * Adds more context: average window volume, window size, and multi-threshold support.
 */
export function detectVolumeSpikes(
  points: VolumePoint[],
  windowSize: number = 10,
  spikeThreshold: number = 2.0,
  severeThreshold: number = 5.0
): SpikeEvent[] {
  const events: SpikeEvent[] = []
  if (points.length <= windowSize) return events

  const volumes = points.map(p => p.volumeUsd)

  for (let i = windowSize; i < volumes.length; i++) {
    const window = volumes.slice(i - windowSize, i)
    const avg = window.reduce((sum, v) => sum + v, 0) / window.length
    const curr = volumes[i]
    const ratio = avg > 0 ? curr / avg : Infinity

    if (ratio >= spikeThreshold) {
      events.push({
        timestamp: points[i].timestamp,
        volume: curr,
        spikeRatio: round2(ratio),
        avgWindowVolume: round2(avg),
        windowSize,
      })
    }
  }

  // optional: mark severe spikes for further categorization
  return events.map(e =>
    e.spikeRatio >= severeThreshold ? { ...e, severity: 'severe' } : { ...e, severity: 'normal' }
  ) as SpikeEvent[]
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Summarize spike events: count, average ratio, max ratio.
 */
export function summarizeSpikes(events: SpikeEvent[]): {
  count: number
  avgSpikeRatio: number
  maxSpikeRatio: number
} {
  if (!events.length) return { count: 0, avgSpikeRatio: 0, maxSpikeRatio: 0 }
  const ratios = events.map(e => e.spikeRatio)
  const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length
  return {
    count: events.length,
    avgSpikeRatio: round2(avg),
    maxSpikeRatio: Math.max(...ratios),
  }
}
