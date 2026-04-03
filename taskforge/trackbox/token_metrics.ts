export interface PricePoint {
  timestamp: number
  price: number
}

export interface TokenMetrics {
  averagePrice: number
  volatility: number // standard deviation
  maxPrice: number
  minPrice: number
  medianPrice: number
  priceChangePct: number
  sampleCount: number
}

export class TokenAnalysisCalculator {
  constructor(private data: PricePoint[]) {}

  getAveragePrice(): number {
    if (this.data.length === 0) return 0
    const sum = this.data.reduce((acc, p) => acc + p.price, 0)
    return sum / this.data.length
  }

  getVolatility(): number {
    if (this.data.length === 0) return 0
    const avg = this.getAveragePrice()
    const variance =
      this.data.reduce((acc, p) => acc + (p.price - avg) ** 2, 0) /
      (this.data.length || 1)
    return Math.sqrt(variance)
  }

  getMaxPrice(): number {
    if (this.data.length === 0) return 0
    return this.data.reduce((max, p) => (p.price > max ? p.price : max), -Infinity)
  }

  getMinPrice(): number {
    if (this.data.length === 0) return 0
    return this.data.reduce((min, p) => (p.price < min ? p.price : min), Infinity)
  }

  getMedianPrice(): number {
    if (this.data.length === 0) return 0
    const sorted = [...this.data].map(p => p.price).sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]
  }

  getPriceChangePct(): number {
    if (this.data.length < 2) return 0
    const first = this.data[0].price
    const last = this.data[this.data.length - 1].price
    return first !== 0 ? ((last - first) / first) * 100 : 0
  }

  computeMetrics(): TokenMetrics {
    return {
      averagePrice: this.getAveragePrice(),
      volatility: this.getVolatility(),
      maxPrice: this.getMaxPrice(),
      minPrice: this.getMinPrice(),
      medianPrice: this.getMedianPrice(),
      priceChangePct: this.getPriceChangePct(),
      sampleCount: this.data.length,
    }
  }
}
