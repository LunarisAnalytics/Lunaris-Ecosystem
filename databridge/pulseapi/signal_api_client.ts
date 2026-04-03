export interface Signal {
  id: string
  type: string
  timestamp: number
  payload: Record<string, any>
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  statusCode?: number
}

/**
 * Extended HTTP client for fetching and managing signals
 */
export class SignalApiClient {
  constructor(private baseUrl: string, private apiKey?: string) {}

  private getHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`
    return { ...headers, ...(extra || {}) }
  }

  async fetchAllSignals(limit?: number, since?: number): Promise<ApiResponse<Signal[]>> {
    try {
      const params: string[] = []
      if (limit) params.push(`limit=${encodeURIComponent(limit)}`)
      if (since) params.push(`since=${encodeURIComponent(since)}`)
      const query = params.length > 0 ? `?${params.join('&')}` : ''
      const res = await fetch(this.normalizeUrl(`/signals${query}`), {
        method: 'GET',
        headers: this.getHeaders(),
      })
      if (!res.ok) return { success: false, error: `HTTP ${res.status}`, statusCode: res.status }
      const data = (await res.json()) as Signal[]
      return { success: true, data, statusCode: res.status }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unknown error' }
    }
  }

  async fetchSignalById(id: string): Promise<ApiResponse<Signal>> {
    try {
      const res = await fetch(this.normalizeUrl(`/signals/${encodeURIComponent(id)}`), {
        method: 'GET',
        headers: this.getHeaders(),
      })
      if (!res.ok) return { success: false, error: `HTTP ${res.status}`, statusCode: res.status }
      const data = (await res.json()) as Signal
      return { success: true, data, statusCode: res.status }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unknown error' }
    }
  }

  async createSignal(signal: Omit<Signal, 'timestamp'>): Promise<ApiResponse<Signal>> {
    try {
      const payload = { ...signal, timestamp: Date.now() }
      const res = await fetch(this.normalizeUrl('/signals'), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      })
      if (!res.ok) return { success: false, error: `HTTP ${res.status}`, statusCode: res.status }
      const data = (await res.json()) as Signal
      return { success: true, data, statusCode: res.status }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unknown error' }
    }
  }

  async deleteSignal(id: string): Promise<ApiResponse<null>> {
    try {
      const res = await fetch(this.normalizeUrl(`/signals/${encodeURIComponent(id)}`), {
        method: 'DELETE',
        headers: this.getHeaders(),
      })
      if (!res.ok) return { success: false, error: `HTTP ${res.status}`, statusCode: res.status }
      return { success: true, statusCode: res.status }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unknown error' }
    }
  }

  async healthCheck(): Promise<ApiResponse<{ status: string }>> {
    try {
      const res = await fetch(this.normalizeUrl('/health'), {
        method: 'GET',
        headers: this.getHeaders(),
      })
      if (!res.ok) return { success: false, error: `HTTP ${res.status}`, statusCode: res.status }
      const data = (await res.json()) as { status: string }
      return { success: true, data, statusCode: res.status }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unknown error' }
    }
  }

  private normalizeUrl(path: string): string {
    return `${this.baseUrl.replace(/\/+$/, '')}${path}`
  }
}
