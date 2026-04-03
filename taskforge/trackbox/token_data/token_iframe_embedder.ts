import type { TokenDataPoint } from './tokenDataFetcher'

export interface DataIframeConfig {
  containerId: string
  iframeUrl: string
  token: string
  refreshMs?: number
  apiBase?: string
  messageType?: string
}

export class TokenDataIframeEmbedder {
  private iframe?: HTMLIFrameElement
  private refreshTimer?: number

  constructor(private cfg: DataIframeConfig) {}

  async init() {
    const container = document.getElementById(this.cfg.containerId)
    if (!container) throw new Error(`Container not found: ${this.cfg.containerId}`)

    this.iframe = document.createElement('iframe')
    this.iframe.src = this.cfg.iframeUrl
    this.iframe.style.border = 'none'
    this.iframe.width = '100%'
    this.iframe.height = '100%'
    this.iframe.onload = () => this.postTokenData()
    container.appendChild(this.iframe)

    if (this.cfg.refreshMs) {
      this.refreshTimer = window.setInterval(() => this.postTokenData(), this.cfg.refreshMs)
    }
  }

  private async postTokenData() {
    if (!this.iframe?.contentWindow) return
    try {
      // fetch latest data
      const fetcherModule = await import('./tokenDataFetcher')
      const apiBase = this.cfg.apiBase ?? this.cfg.iframeUrl
      const fetcher = new fetcherModule.TokenDataFetcher(apiBase)
      const data: TokenDataPoint[] = await fetcher.fetchHistory(this.cfg.token, { limit: 50 })

      this.iframe.contentWindow.postMessage(
        {
          type: this.cfg.messageType ?? 'TOKEN_DATA',
          token: this.cfg.token,
          data,
          ts: Date.now(),
        },
        '*'
      )
    } catch (err) {
      console.error('Failed to post token data to iframe:', err)
    }
  }

  dispose() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = undefined
    }
    this.iframe?.remove()
    this.iframe = undefined
  }
}
