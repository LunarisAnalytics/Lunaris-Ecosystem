export interface SightCoreConfig {
  url: string
  protocols?: string[]
  reconnectIntervalMs?: number
  maxReconnectAttempts?: number
  heartbeatIntervalMs?: number
}

export type SightCoreMessage = {
  topic: string
  payload: any
  timestamp: number
}

export class SightCoreWebSocket {
  private socket?: WebSocket
  private url: string
  private protocols?: string[]
  private reconnectInterval: number
  private maxReconnectAttempts: number
  private reconnectAttempts = 0
  private heartbeatInterval?: number
  private heartbeatTimer?: ReturnType<typeof setInterval>

  constructor(config: SightCoreConfig) {
    this.url = config.url
    this.protocols = config.protocols
    this.reconnectInterval = config.reconnectIntervalMs ?? 5000
    this.maxReconnectAttempts = config.maxReconnectAttempts ?? Infinity
    this.heartbeatInterval = config.heartbeatIntervalMs
  }

  connect(
    onMessage: (msg: SightCoreMessage) => void,
    onOpen?: () => void,
    onClose?: () => void,
    onError?: (err: Event) => void
  ): void {
    this.socket = this.protocols
      ? new WebSocket(this.url, this.protocols)
      : new WebSocket(this.url)

    this.socket.onopen = () => {
      this.reconnectAttempts = 0
      if (this.heartbeatInterval) {
        this.startHeartbeat()
      }
      onOpen?.()
    }

    this.socket.onmessage = event => {
      try {
        const msg = JSON.parse(event.data) as SightCoreMessage
        if (msg && msg.topic && msg.timestamp) {
          onMessage(msg)
        }
      } catch {
        // ignore invalid messages
      }
    }

    this.socket.onclose = () => {
      this.stopHeartbeat()
      onClose?.()
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++
        setTimeout(() => this.connect(onMessage, onOpen, onClose, onError), this.reconnectInterval)
      }
    }

    this.socket.onerror = event => {
      onError?.(event)
      this.socket?.close()
    }
  }

  send(topic: string, payload: any): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      const msg = JSON.stringify({ topic, payload, timestamp: Date.now() })
      this.socket.send(msg)
    }
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN
  }

  disconnect(): void {
    this.stopHeartbeat()
    this.socket?.close()
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.send('heartbeat', { ts: Date.now() })
      }
    }, this.heartbeatInterval)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = undefined
    }
  }
}
