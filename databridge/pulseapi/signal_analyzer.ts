import type { Signal } from './SignalApiClient'

/**
 * Processes raw signals into actionable events and insights.
 */
export class SignalProcessor {
  /**
   * Filter signals by type and recency.
   * @param signals Array of Signal
   * @param type Desired signal type
   * @param sinceTimestamp Only include signals after this time
   */
  filter(signals: Signal[], type: string, sinceTimestamp: number): Signal[] {
    return signals.filter(s => s.type === type && s.timestamp > sinceTimestamp)
  }

  /**
   * Aggregate signals by type, counting occurrences.
   * @param signals Array of Signal
   */
  aggregateByType(signals: Signal[]): Record<string, number> {
    return signals.reduce((acc, s) => {
      acc[s.type] = (acc[s.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }

  /**
   * Group signals by type.
   */
  groupByType(signals: Signal[]): Record<string, Signal[]> {
    return signals.reduce((acc, s) => {
      if (!acc[s.type]) acc[s.type] = []
      acc[s.type].push(s)
      return acc
    }, {} as Record<string, Signal[]>)
  }

  /**
   * Transform a signal into a human-readable summary string.
   */
  summarize(signal: Signal): string {
    const time = new Date(signal.timestamp).toISOString()
    return `[${time}] ${signal.type.toUpperCase()}: ${JSON.stringify(signal.payload)}`
  }

  /**
   * Summarize multiple signals at once.
   */
  summarizeAll(signals: Signal[]): string[] {
    return signals.map(s => this.summarize(s))
  }

  /**
   * Find the most recent signal of a given type.
   */
  latestOfType(signals: Signal[], type: string): Signal | undefined {
    return signals
      .filter(s => s.type === type)
      .sort((a, b) => b.timestamp - a.timestamp)[0]
  }

  /**
   * Compute average payload size per signal type.
   */
  averagePayloadSize(signals: Signal[]): Record<string, number> {
    const groups = this.groupByType(signals)
    const result: Record<string, number> = {}
    for (const key of Object.keys(groups)) {
      const total = groups[key].reduce((acc, s) => acc + JSON.stringify(s.payload).length, 0)
      result[key] = total / groups[key].length
    }
    return result
  }
}
