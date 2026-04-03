export interface MetricEntry {
  key: string
  value: number
  updatedAt: number
  tags?: Record<string, string>
}

export class MetricsCache {
  private cache = new Map<string, MetricEntry>()

  get(key: string): MetricEntry | undefined {
    return this.cache.get(key)
  }

  set(key: string, value: number, tags?: Record<string, string>): void {
    this.cache.set(key, { key, value, updatedAt: Date.now(), tags })
  }

  hasRecent(key: string, maxAgeMs: number): boolean {
    const entry = this.cache.get(key)
    return !!entry && Date.now() - entry.updatedAt < maxAgeMs
  }

  invalidate(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  entries(): MetricEntry[] {
    return Array.from(this.cache.values())
  }

  keys(): string[] {
    return Array.from(this.cache.keys())
  }

  size(): number {
    return this.cache.size
  }

  /**
   * Get metrics filtered by tag.
   */
  filterByTag(tagKey: string, tagValue: string): MetricEntry[] {
    return this.entries().filter(e => e.tags?.[tagKey] === tagValue)
  }

  /**
   * Get the most recent entry in the cache.
   */
  latest(): MetricEntry | undefined {
    return this.entries().sort((a, b) => b.updatedAt - a.updatedAt)[0]
  }

  /**
   * Export all metrics as plain object.
   */
  toObject(): Record<string, MetricEntry> {
    return Object.fromEntries(this.cache.entries())
  }
}
