import nodemailer, { Transporter, SendMailOptions } from 'nodemailer'

export interface AlertConfig {
  email?: {
    host: string
    port: number
    user: string
    pass: string
    from: string
    to: string[]
    secure?: boolean
    pool?: boolean
  }
  console?: boolean
  prefix?: string
  /** Max emails per minute (simple token bucket). 0 or undefined = unlimited */
  rateLimitPerMinute?: number
  /** Retry attempts for transient send failures */
  maxRetries?: number
}

export interface AlertSignal {
  title: string
  message: string
  level: 'info' | 'warning' | 'critical'
  timestamp?: number
  /** Optional HTML body; falls back to text */
  html?: string
  /** Optional list of attachments (passes through to nodemailer) */
  attachments?: SendMailOptions['attachments']
  /** Optional additional recipients for this signal */
  extraTo?: string[]
}

export interface SendResult {
  success: boolean
  error?: string
  infoId?: string
}

export class AlertService {
  private transporter?: Transporter
  private tokens = 0
  private lastRefill = Date.now()

  constructor(private cfg: AlertConfig) {}

  /** Update config at runtime (e.g., rotate creds, adjust rate limit) */
  updateConfig(next: Partial<AlertConfig>) {
    this.cfg = { ...this.cfg, ...next }
    // Rebuild transporter if email settings changed
    this.transporter = undefined
  }

  /** Quick health check of SMTP transporter */
  async verify(): Promise<SendResult> {
    try {
      const t = await this.getTransporter()
      if (!t) return { success: true } // console-only mode
      await t.verify()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err?.message || 'verify failed' }
    }
  }

  /** Dispatch an array of alerts sequentially (preserves order, respects rate limit) */
  async dispatch(signals: AlertSignal[]): Promise<SendResult[]> {
    const results: SendResult[] = []
    for (const sig of signals) {
      results.push(await this.dispatchSingle(sig))
    }
    return results
  }

  /** Dispatch a single alert */
  async dispatchSingle(signal: AlertSignal): Promise<SendResult> {
    const emailRes = await this.sendEmailWithRetry(signal)
    this.logConsole(signal)
    return emailRes
  }

  /** ----- internals ----- */

  private async getTransporter(): Promise<Transporter | undefined> {
    if (!this.cfg.email) return undefined
    if (this.transporter) return this.transporter
    const { host, port, user, pass, secure, pool } = this.cfg.email
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: secure ?? port === 465,
      pool: pool ?? true,
      auth: { user, pass },
    })
    return this.transporter
  }

  private async sendEmailWithRetry(signal: AlertSignal): Promise<SendResult> {
    try {
      const t = await this.getTransporter()
      if (!t) return { success: true } // nothing to send via email

      await this.consumeToken()

      const subject = `${this.cfg.prefix ? `[${this.cfg.prefix}]` : ''}[${signal.level.toUpperCase()}] ${signal.title}`
      const toList = [...(this.cfg.email?.to ?? []), ...(signal.extraTo ?? [])]
      const mail: SendMailOptions = {
        from: this.cfg.email!.from,
        to: toList,
        subject,
        text: this.formatMessage(signal),
        html: signal.html,
        attachments: signal.attachments,
      }

      const maxRetries = Math.max(0, this.cfg.maxRetries ?? 1)
      let attempt = 0
      // retry on transient errors
      for (;;) {
        try {
          const info = await t.sendMail(mail)
          return { success: true, infoId: info.messageId }
        } catch (err: any) {
          attempt++
          if (attempt > maxRetries || !this.isTransient(err)) {
            return { success: false, error: err?.message || 'send failed' }
          }
          // simple backoff
          await this.sleep(250 * attempt)
        }
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'send failed' }
    }
  }

  private isTransient(err: any): boolean {
    const msg = String(err?.message || '').toLowerCase()
    return (
      msg.includes('timeout') ||
      msg.includes('ratelimit') ||
      msg.includes('rate limit') ||
      msg.includes('temporar') || // temporary
      msg.includes('retry') ||
      msg.includes('connection')
    )
  }

  private async consumeToken(): Promise<void> {
    const limit = this.cfg.rateLimitPerMinute
    if (!limit || limit <= 0) return
    const now = Date.now()
    // refill tokens
    const elapsed = now - this.lastRefill
    const perMs = limit / 60000
    this.tokens = Math.min(limit, this.tokens + elapsed * perMs)
    this.lastRefill = now

    if (this.tokens < 1) {
      const waitMs = Math.ceil((1 - this.tokens) / perMs)
      await this.sleep(waitMs)
      // after waiting, refill accounting
      this.tokens = Math.min(limit, this.tokens + waitMs * perMs)
    }
    // consume
    this.tokens = Math.max(0, this.tokens - 1)
  }

  private logConsole(signal: AlertSignal) {
    if (!this.cfg.console) return
    const line = this.formatMessage(signal)
    if (signal.level === 'critical') console.error(line)
    else if (signal.level === 'warning') console.warn(line)
    else console.log(line)
  }

  private formatMessage(signal: AlertSignal): string {
    const ts = new Date(signal.timestamp ?? Date.now()).toISOString()
    const prefix = this.cfg.prefix ? `[${this.cfg.prefix}]` : ''
    const icon = signal.level === 'critical' ? '⛔' : signal.level === 'warning' ? '⚠️' : 'ℹ️'
    return `${icon}${prefix}[${signal.level.toUpperCase()}] ${signal.title} @ ${ts}\n${signal.message}`
  }

  private sleep(ms: number) {
    return new Promise<void>(res => setTimeout(res, ms))
  }
}
