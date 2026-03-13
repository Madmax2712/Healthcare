import { useMarketStore } from '../store'

class WebSocketService {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnects = 5
  private reconnectDelay = 2000

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const url = `${protocol}//${host}/ws`

    try {
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        console.log('WebSocket connected')
        this.reconnectAttempts = 0
        // Subscribe to live price updates
        this.send({ type: 'subscribe', symbols: ['*'] })
      }

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          this.handleMessage(msg)
        } catch (e) {
          console.error('WS parse error:', e)
        }
      }

      this.ws.onclose = () => {
        console.log('WebSocket closed')
        this.scheduleReconnect()
      }

      this.ws.onerror = (err) => {
        console.error('WebSocket error:', err)
      }
    } catch (e) {
      console.error('WS connection failed:', e)
      this.scheduleReconnect()
    }
  }

  private handleMessage(msg: Record<string, unknown>) {
    const { type, data } = msg as { type: string; data: unknown }

    if (type === 'price_update' && Array.isArray(data)) {
      useMarketStore.getState().updateQuotes(data as any[])
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnects) {
      this.reconnectAttempts++
      const delay = this.reconnectDelay * this.reconnectAttempts
      setTimeout(() => this.connect(), delay)
    }
  }

  send(data: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  disconnect() {
    this.ws?.close()
    this.ws = null
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

export const wsService = new WebSocketService()
