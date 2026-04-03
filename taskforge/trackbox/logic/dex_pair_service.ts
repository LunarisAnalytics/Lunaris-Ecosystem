export interface PairInfo {
  exchange: string
  pairAddress: string
  baseSymbol: string
  quoteSymbol: string
  liquidityUsd: number
  volume24hUsd: number
  priceUsd: number
}

export interface DexSuiteConfig {
  apis: Array<{ name: string; baseUrl: string; apiKey?: string }>
  timeoutMs?: number
  userAgent?: string
}

type ApiConfig = DexSuiteConfig['apis'][number]

type PairApiResponse = {
  token0?: { symbol?: string }
  token1?: { symbol?: string }
  liquidityUsd?: number | string
  volume24hUsd?: number | string
  priceUsd?: number | string
}

export class DexSuite {
  constructor(private config: DexSuiteConfig) {}

  private normalizeBase(url: string): string {
    return url.replace(/\/+$/, '')
  }

  private buildHeaders(api?: ApiConfig): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (api?.apiKey) headers['Authorization'] = `Bearer ${api.apiKey}`
    if (this.config.userAgent) headers['User-Agent'] = this.config.userAgent
    return headers
  }

  private async safeJson<T>(res: Response): Promise<T> {
    try {
      return (await res.json()) as T
    } catch {
      // @ts-ignore
      return {} as T
    }
  }

  private async fetchFromApi<T>(api: ApiConfig, path: string): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 10000)
    try {
      const url = `${this.normalizeBase(api.baseUrl)}${path}`
      const res = await fetch(url, {
        headers: this.buildHeaders(api),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`${api.name} ${path} ${res.status}`)
      return await this.safeJson<T>(res)
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * Retrieve aggregated pair info across all configured DEX APIs.
   * @param pairAddress Blockchain address of the trading pair
   */
  async getPairInfo(pairAddress: string): Promise<PairInfo[]> {
    if (!pairAddress) return []
    const tasks = this.config.apis.map(async api => {
      try {
        const data = await this.fetchFromApi<PairApiResponse>(api, `/pair/${pairAddress}`)
        return {
          exchange: api.name,
          pairAddress,
          baseSymbol: data.token0?.symbol ?? '',
          quoteSymbol: data.token1?.symbol ?? '',
          liquidityUsd: Number(data.liquidityUsd ?? 0),
          volume24hUsd: Number(data.volume24hUsd ?? 0),
          priceUsd: Number(data.priceUsd ?? 0),
        } as PairInfo
      } catch {
        return undefined
      }
    })
    const results = await Promise.all(tasks)
    return results.filter((v): v is PairInfo => Boolean(v))
  }

  /**
   * Compute a summary across exchanges for a pair
   */
  async summarizePair(pairAddress: string): Promise<{
    pairAddress: string
    exchanges: number
    totalLiquidityUsd: number
    totalVolume24hUsd: number
    avgPriceUsd: number
    minPriceUsd: number
    maxPriceUsd: number
  }> {
    const infos = await this.getPairInfo(pairAddress)
    const prices = infos.map(i => i.priceUsd).filter(p => Number.isFinite(p))
    const totalLiquidityUsd = infos.reduce((a, b) => a + (b.liquidityUsd || 0), 0)
    const totalVolume24hUsd = infos.reduce((a, b) => a + (b.volume24hUsd || 0), 0)
    const avgPriceUsd = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0
    const minPriceUsd = prices.length ? Math.min(...prices) : 0
    const maxPriceUsd = prices.length ? Math.max(...prices) : 0

    return {
      pairAddress,
      exchanges: infos.length,
      totalLiquidityUsd: Number(totalLiquidityUsd.toFixed(2)),
      totalVolume24hUsd: Number(totalVolume24hUsd.toFixed(2)),
      avgPriceUsd: Number(avgPriceUsd.toFixed(6)),
      minPriceUsd: Number(minPriceUsd.toFixed(6)),
      maxPriceUsd: Number(maxPriceUsd.toFixed(6)),
    }
  }

  /**
   * Compare a list of pairs across exchanges, returning the best volume and liquidity.
   * Returns empty objects for pairs with no data.
   */
  async comparePairs(
    pairs: string[]
  ): Promise<Record<string, { bestVolume?: PairInfo; bestLiquidity?: PairInfo }>> {
    const entries = await Promise.all(
      pairs.map(async addr => {
        const infos = await this.getPairInfo(addr)
        if (!infos.length) return [addr, {}] as const
        const bestVolume = this.getBestBy(infos, i => i.volume24hUsd)
        const bestLiquidity = this.getBestBy(infos, i => i.liquidityUsd)
        return [addr, { bestVolume, bestLiquidity }] as const
      })
    )
    return Object.fromEntries(entries)
  }

  listExchanges(): string[] {
    return this.config.apis.map(a => a.name)
  }

  private getBestBy<T>(items: T[], metric: (x: T) => number): T {
    return items.reduce((a, b) => (metric(b) > metric(a) ? b : a))
  }
}
