export interface TokenDataPoint {
  timestamp: number
  priceUsd: number
  volumeUsd: number
  marketCapUsd: number
}

export interface FetchOptions {
  limit?: number
  from?: number
  to?: number
  signal?: AbortSignal
}

export class TokenDataFetcher {
  constructor(private apiBase: string, private timeoutMs: number = 10000) {}

  private async safeJson(res: Response): Promise<any> {
    try {
      return await res.json()
    } catch {
      return []
    }
  }

  private async fetchWithTimeout(url: string, opts: RequestInit = {}): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      return await fetch(url, { ...opts, signal: controller.signal })
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * Fetches an array of TokenDataPoint for the given token symbol.
   * Expects endpoint: `${apiBase}/tokens/${symbol}/history`
   */
  async fetchHistory(symbol: string, options: FetchOptions = {}): Promise<TokenDataPoint[]> {
    const params: string[] = []
    if (options.limit) params.push(`limit=${options.limit}`)
    if (options.from) params.push(`from=${options.from}`)
    if (options.to) params.push(`to=${options.to}`)
    const query = params.length ? `?${params.join('&')}` : ''

    const url = `${this.apiBase.replace(/\/+$/, '')}/tokens/${encodeURIComponent(symbol)}/history${query}`
    const res = await this.fetchWithTimeout(url, { signal: options.signal })
    if (!res.ok) throw new Error(`Failed to fetch history for ${symbol}: ${res.status}`)

    const raw = (await this.safeJson(res)) as any[]
    return raw.map(r => ({
      timestamp: (r.time ?? r.timestamp) * 1000,
      priceUsd: Number(r.priceUsd ?? r.price),
      volumeUsd: Number(r.volumeUsd ?? r.volume),
      marketCapUsd: Number(r.marketCapUsd ?? r.marketCap),
    }))
  }

  /**
   * Fetch the most recent data point for a token.
   */
  async fetchLatest(symbol: string): Promise<TokenDataPoint | null> {
    const history = await this.fetchHistory(symbol, { limit: 1 })
    return history.length > 0 ? history[0] : null
  }

  /**
   * Fetch data for multiple tokens concurrently.
   */
  async fetchBatch(symbols: string[], options: FetchOptions = {}): Promise<Record<string, TokenDataPoint[]>> {
    const entries = await Promise.all(
      symbols.map(async s => {
        try {
          const data = await this.fetchHistory(s, options)
          return [s, data] as const
        } catch {
          return [s, []] as const
        }
      })
    )
    return Object.fromEntries(entries)
  }
}
