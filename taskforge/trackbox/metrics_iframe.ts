import type { TokenMetrics } from './tokenAnalysisCalculator'

export interface IframeConfig {
  containerId: string
  srcUrl: string
  metrics: TokenMetrics
  refreshIntervalMs?: number
  messageType?: string
  debug?: boolean
}

export class TokenAnalysisIframe {
  private iframeEl: HTMLIFrameElement | null = null
  private refreshTimer?: number

  constructor(private config: IframeConfig) {}

  init(): void {
    const container = document.getElementById(this.config.containerId)
    if (!container) throw new Error('Container not found: ' + this.config.containerId)

    const iframe = document.createElement('iframe')
    iframe.src = this.config.srcUrl
    iframe.width = '100%'
    iframe.height = '100%'
    iframe.style.border = 'none'
    iframe.onload = () => this.postMetrics()
    container.appendChild(iframe)
    this.iframeEl = iframe

    if (this.config.refreshIntervalMs) {
      this.refreshTimer = window.setInterval(
        () => this.postMetrics(),
        this.config.refreshIntervalMs
      )
    }
  }

  private postMetrics(): void {
    if (!this.iframeEl?.contentWindow) return
    try {
      this.iframeEl.contentWindow.postMessage(
        {
          type: this.config.messageType ?? 'TOKEN_ANALYSIS_METRICS',
          payload: this.config.metrics,
          timestamp: Date.now(),
        },
        '*'
      )
      if (this.config.debug) {
        console.log('Posted metrics to iframe:', this.config.metrics)
      }
    } catch (err) {
      if (this.config.debug) {
        console.error('Failed to post metrics to iframe:', err)
      }
    }
  }

  updateMetrics(metrics: TokenMetrics): void {
    this.config.metrics = metrics
    this.postMetrics()
  }

  dispose(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = undefined
    }
    this.iframeEl?.remove()
    this.iframeEl = null
  }
}
