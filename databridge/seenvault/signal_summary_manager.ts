import type { SightCoreMessage } from './WebSocketClient'

export interface AggregatedSignal {
  topic: string
  count: number
  lastPayload: any
  lastTimestamp: number
  firstTimestamp?: number
  uniquePayloads?: Set<string>
}

export class SignalAggregator {
  private counts: Record<string, AggregatedSignal> = {}

  processMessage(msg: SightCoreMessage): AggregatedSignal {
    const { topic, payload, timestamp } = msg
    let entry = this.counts[topic]

    if (!entry) {
      entry = {
        topic,
        count: 0,
        lastPayload: null,
        lastTimestamp: 0,
        firstTimestamp: timestamp,
        uniquePayloads: new Set<string>(),
      }
    }

    entry.count += 1
    entry.lastPayload = payload
    entry.lastTimestamp = timestamp
    entry.uniquePayloads?.add(JSON.stringify(payload))

    this.counts[topic] = entry
    return entry
  }

  getAggregated(topic: string): AggregatedSignal | undefined {
    return this.counts[topic]
  }

  getAllAggregated(): AggregatedSignal[] {
    return Object.values(this.counts)
  }

  getMostActiveTopic(): AggregatedSignal | undefined {
    const all = this.getAllAggregated()
    if (all.length === 0) return undefined
    return all.reduce((max, curr) => (curr.count > max.count ? curr : max))
  }

  getTopicsSince(timestamp: number): AggregatedSignal[] {
    return this.getAllAggregated().filter(a => a.lastTimestamp > timestamp)
  }

  getUniqueCount(topic: string): number {
    return this.counts[topic]?.uniquePayloads?.size ?? 0
  }

  removeTopic(topic: string): boolean {
    if (this.counts[topic]) {
      delete this.counts[topic]
      return true
    }
    return false
  }

  reset(): void {
    this.counts = {}
  }
}
