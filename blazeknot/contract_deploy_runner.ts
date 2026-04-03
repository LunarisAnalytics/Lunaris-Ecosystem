export interface LaunchConfig {
  contractName: string
  parameters: Record<string, any>
  deployEndpoint: string
  apiKey?: string
  statusEndpoint?: string
  timeoutMs?: number
  idempotencyKey?: string
  extraHeaders?: Record<string, string>
}

export interface LaunchResult {
  success: boolean
  address?: string
  transactionHash?: string
  error?: string
}

export class LaunchNode {
  constructor(private config: LaunchConfig) {}

  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey
  }

  updateParameters(patch: Record<string, any>): void {
    this.config.parameters = { ...this.config.parameters, ...patch }
  }

  dryRun(): { endpoint: string; payload: Record<string, any>; headers: Record<string, string> } {
    const endpoint = this.normalizeEndpoint(this.config.deployEndpoint)
    return {
      endpoint,
      payload: this.buildPayload(),
      headers: this.buildHeaders()
    }
  }

  async deploy(signal?: AbortSignal): Promise<LaunchResult> {
    const validation = this.validateConfig()
    if (!validation.success) return validation

    const endpoint = this.normalizeEndpoint(this.config.deployEndpoint)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 30000)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(this.buildPayload()),
        signal: this.linkSignals(controller.signal, signal)
      })
      if (!res.ok) {
        const text = await this.safeText(res)
        return { success: false, error: `HTTP ${res.status}: ${text}` }
      }
      const json = await this.safeJson(res)
      const parsed = this.parseResponse(json)
      if (!parsed.success) return parsed
      return parsed
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { success: false, error: 'Request aborted by timeout or external signal' }
      }
      return { success: false, error: err?.message || 'Unknown error' }
    } finally {
      clearTimeout(timeout)
    }
  }

  async getStatus(jobId?: string): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.config.statusEndpoint) return { success: false, error: 'No statusEndpoint configured' }
    const url = this.normalizeEndpoint(this.config.statusEndpoint) + (jobId ? `?jobId=${encodeURIComponent(jobId)}` : '')
    try {
      const res = await fetch(url, { headers: this.buildHeaders(), method: 'GET' })
      if (!res.ok) {
        const text = await this.safeText(res)
        return { success: false, error: `HTTP ${res.status}: ${text}` }
      }
      const json = await this.safeJson(res)
      return { success: true, data: json }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unknown error' }
    }
  }

  private buildPayload(): Record<string, any> {
    const { contractName, parameters } = this.config
    return { contractName, parameters }
  }

  private buildHeaders(): Record<string, string> {
    const base: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.config.apiKey) base['Authorization'] = `Bearer ${this.config.apiKey}`
    if (this.config.idempotencyKey) base['Idempotency-Key'] = this.config.idempotencyKey
    return { ...base, ...(this.config.extraHeaders || {}) }
  }

  private validateConfig(): LaunchResult {
    const { contractName, parameters, deployEndpoint } = this.config
    if (!contractName || typeof contractName !== 'string') return { success: false, error: 'Invalid contractName' }
    if (!parameters || typeof parameters !== 'object') return { success: false, error: 'Invalid parameters' }
    if (!deployEndpoint || !this.isHttpUrl(deployEndpoint)) return { success: false, error: 'Invalid deployEndpoint' }
    return { success: true }
  }

  private parseResponse(json: any): LaunchResult {
    const address = json?.contractAddress ?? json?.address
    const tx = json?.txHash ?? json?.transactionHash
    if (typeof address === 'string' && address.length > 0) {
      return { success: true, address, transactionHash: typeof tx === 'string' ? tx : undefined }
    }
    return { success: false, error: 'Deployment response missing contract address' }
  }

  private isHttpUrl(url: string): boolean {
    try {
      const u = new URL(url)
      return u.protocol === 'http:' || u.protocol === 'https:'
    } catch {
      return false
    }
  }

  private normalizeEndpoint(url: string): string {
    // Ensure no trailing spaces and remove duplicate slashes except after protocol
    const trimmed = url.trim()
    return trimmed.replace(/([^:]\/)\/+/g, '$1')
  }

  private linkSignals(a: AbortSignal, b?: AbortSignal): AbortSignal {
    if (!b) return a
    if (b.aborted) return b
    const controller = new AbortController()
    const onAbort = () => controller.abort()
    a.addEventListener('abort', onAbort)
    b.addEventListener('abort', onAbort)
    return controller.signal
  }

  private async safeJson(res: Response): Promise<any> {
    try {
      return await res.json()
    } catch {
      const text = await this.safeText(res)
      return { raw: text }
    }
  }

  private async safeText(res: Response): Promisestring> {
    try {
      return await res.text()
    } catch {
      return 'No response body'
    }
  }
}
