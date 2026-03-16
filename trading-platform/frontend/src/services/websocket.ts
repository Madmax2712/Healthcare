import { useMarketStore, useAutoTraderStore } from '../store'

type MessageHandler = (msg: Record<string, unknown>) => void

class WebSocketService {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnects = 10
  private baseDelay = 1500
  private handlers: MessageHandler[] = []
  private pingInterval: number | null = null

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname
    // Dev: backend runs on :8000; prod: same host via nginx proxy
    const port = (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) ? ':8000' : ''
    const url = `${protocol}//${host}${port}/ws`

    try {
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        console.log('[WS] Connected — live feed active (1-second ticks)')
        this.reconnectAttempts = 0
        this.send({ type: 'subscribe', symbols: ['*'] })
        // Keepalive ping every 20s
        this.pingInterval = window.setInterval(() => {
          this.send({ type: 'ping' })
        }, 20_000)
      }

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          this.handleMessage(msg)
          this.handlers.forEach((h) => h(msg))
        } catch (e) {
          console.error('[WS] Parse error:', e)
        }
      }

      this.ws.onclose = () => {
        console.log('[WS] Disconnected')
        if (this.pingInterval) clearInterval(this.pingInterval)
        this.scheduleReconnect()
      }

      this.ws.onerror = (err) => {
        console.error('[WS] Error:', err)
      }
    } catch (e) {
      console.error('[WS] Connection failed:', e)
      this.scheduleReconnect()
    }
  }

  private handleMessage(msg: Record<string, unknown>) {
    const type = msg.type as string
    const market = useMarketStore.getState()
    const autoTrader = useAutoTraderStore.getState()

    switch (type) {
      case 'snapshot': {
        // Full price snapshot on connect
        const data = msg.data as Record<string, unknown>
        if (data) market.updateTickData(data as any)
        break
      }

      case 'price_tick': {
        // 1-second tick — update all prices
        const data = msg.data as Record<string, unknown>
        if (data) {
          market.updateTickData(data as any)
          // Append to sparkline history for selected symbol
          const sel = market.selectedSymbol
          const tick = data[sel] as any
          if (tick?.price) market.appendPrice(sel, tick.price)
        }
        break
      }

      case 'price_update': {
        // Legacy format support
        const data = msg.data
        if (Array.isArray(data)) market.updateQuotes(data as any[])
        break
      }

      case 'agent_log': {
        const log = msg.log as any
        if (log) autoTrader.addLog(log)
        break
      }

      case 'agent_trade': {
        const trade = msg.trade as any
        if (trade) autoTrader.addTrade(trade)
        break
      }

      case 'goal_progress': {
        const progress = msg.progress as any
        if (progress) autoTrader.setGoalProgress(progress)
        break
      }

      case 'opportunities': {
        const opps = msg.data as any[]
        if (opps) autoTrader.setOpportunities(opps)
        break
      }

      case 'autotrader_started':
        autoTrader.setActive(true)
        break

      case 'autotrader_stopped':
        autoTrader.setActive(false)
        break

      case 'position_exit': {
        // Show exit notification
        const exit = msg as any
        console.info(`[Monitor] Exit: ${exit.symbol} — ${exit.reason} @ $${exit.price} (${exit.pnl_pct}%)`)
        break
      }
    }
  }

  addHandler(fn: MessageHandler) {
    this.handlers.push(fn)
    return () => { this.handlers = this.handlers.filter((h) => h !== fn) }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnects) {
      this.reconnectAttempts++
      const delay = this.baseDelay * Math.min(this.reconnectAttempts, 6)
      setTimeout(() => this.connect(), delay)
    }
  }

  send(data: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  requestOpportunities() {
    this.send({ type: 'get_opportunities' })
  }

  disconnect() {
    if (this.pingInterval) clearInterval(this.pingInterval)
    this.ws?.close()
    this.ws = null
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

export const wsService = new WebSocketService()
