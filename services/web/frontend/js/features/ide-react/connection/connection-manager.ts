import { ConnectionError, ConnectionState } from './types/connection-state'
import SocketIoShim from '../../../ide/connection/SocketIoShim'
import getMeta from '../../../utils/meta'
import { Socket } from '@/features/ide-react/connection/types/socket'
import { debugConsole } from '@/utils/debugging'

const ONE_HOUR_IN_MS = 1000 * 60 * 60
const TWO_MINUTES_IN_MS = 2 * 60 * 1000
const DISCONNECT_AFTER_MS = ONE_HOUR_IN_MS * 24

const CONNECTION_ERROR_RECONNECT_DELAY = 1000
const USER_ACTIVITY_RECONNECT_NOW_DELAY = 1000
const USER_ACTIVITY_RECONNECT_DELAY = 5000
const JOIN_PROJECT_RATE_LIMITED_DELAY = 15 * 1000

const RECONNECT_GRACEFULLY_RETRY_INTERVAL_MS = 5000
const MAX_RECONNECT_GRACEFULLY_INTERVAL_MS = 45 * 1000

const MAX_RETRY_CONNECT = 5

const initialState: ConnectionState = {
  readyState: WebSocket.CLOSED,
  forceDisconnected: false,
  inactiveDisconnect: false,
  lastConnectionAttempt: 0,
  reconnectAt: null,
  forcedDisconnectDelay: 0,
  error: '',
}

export class StateChangeEvent extends CustomEvent<{
  state: ConnectionState
  previousState: ConnectionState
}> {}

export class ConnectionManager extends EventTarget {
  state: ConnectionState = initialState
  private connectionAttempt: number | null = null
  private gracefullyReconnectUntil = 0
  private lastUserActivity: number
  private protocolVersion = -1
  private readonly idleDisconnectInterval: number
  private reconnectCountdownInterval = 0
  readonly socket: Socket
  private userIsLeavingPage = false

  constructor() {
    super()

    this.lastUserActivity = performance.now()
    this.idleDisconnectInterval = window.setInterval(() => {
      this.disconnectIfIdleSince(DISCONNECT_AFTER_MS)
    }, ONE_HOUR_IN_MS)

    window.addEventListener('online', () => this.onOnline())
    window.addEventListener('beforeunload', () => {
      this.userIsLeavingPage = true
    })

    const parsedURL = new URL(
      getMeta('ol-wsUrl') || '/socket.io',
      window.origin
    )
    const socket = SocketIoShim.connect(parsedURL.origin, {
      resource: parsedURL.pathname.slice(1),
      'auto connect': false,
      'connect timeout': 30 * 1000,
      'force new connection': true,
      query: new URLSearchParams({
        projectId: getMeta('ol-project_id'),
      }).toString(),
      reconnect: false,
    }) as unknown as Socket
    this.socket = socket

    // bail out if socket.io failed to load (e.g. the real-time server is down)
    if (typeof window.io !== 'object') {
      this.switchToWsFallbackIfPossible()
      debugConsole.error(
        'Socket.io javascript not loaded. Please check that the real-time service is running and accessible.'
      )
      this.changeState({
        ...this.state,
        error: 'io-not-loaded',
      })
      return
    }

    socket.on('disconnect', () => this.onDisconnect())
    socket.on('error', () => this.onConnectError())
    socket.on('connect_failed', () => this.onConnectError())
    socket.on('joinProjectResponse', body => this.onJoinProjectResponse(body))
    socket.on('connectionRejected', err => this.onConnectionRejected(err))
    socket.on('reconnectGracefully', () => this.onReconnectGracefully())
    socket.on('forceDisconnect', (_, delay) => this.onForceDisconnect(delay))

    this.tryReconnect()
  }

  close(error: ConnectionError) {
    this.onForceDisconnect(0, error)
  }

  tryReconnectNow() {
    this.tryReconnectWithBackoff(USER_ACTIVITY_RECONNECT_NOW_DELAY)
  }

  // Called when document is clicked or the editor cursor changes
  registerUserActivity() {
    this.lastUserActivity = performance.now()
    this.userIsLeavingPage = false
    this.ensureIsConnected()
  }

  private changeState(state: ConnectionState) {
    const previousState = this.state
    this.state = state
    debugConsole.log('[ConnectionManager] changed state', {
      previousState,
      state,
    })
    this.dispatchEvent(
      new StateChangeEvent('statechange', { detail: { state, previousState } })
    )
  }

  private switchToWsFallbackIfPossible() {
    const search = new URLSearchParams(window.location.search)
    if (getMeta('ol-wsUrl') && search.get('ws') !== 'fallback') {
      // if we tried to boot from a custom real-time backend and failed,
      // try reloading and falling back to the siteUrl
      search.set('ws', 'fallback')
      window.location.search = search.toString()
      return true
    }
    return false
  }

  private onOnline() {
    if (!this.state.inactiveDisconnect) this.ensureIsConnected()
  }

  private onConnectionRejected(err: any) {
    switch (err?.message) {
      case 'retry': // pending real-time shutdown
        this.startAutoReconnectCountdown(0)
        break
      case 'rate-limit hit when joining project': // rate-limited
        this.changeState({
          ...this.state,
          error: 'rate-limited',
        })
        break
      case 'not authorized': // not logged in
      case 'invalid session': // expired session
        this.changeState({
          ...this.state,
          error: 'not-logged-in',
          forceDisconnected: true,
        })
        break
      case 'project not found': // project has been deleted
        this.changeState({
          ...this.state,
          error: 'project-deleted',
          forceDisconnected: true,
        })
        break
      default:
        this.changeState({
          ...this.state,
          error: 'unable-to-join',
        })
        break
    }
  }

  private onConnectError() {
    if (this.connectionAttempt === null) return // ignore errors once connected.
    if (this.connectionAttempt++ < MAX_RETRY_CONNECT) {
      setTimeout(
        () => {
          if (this.canReconnect()) this.socket.socket.connect()
        },
        // add jitter to spread reconnects
        this.connectionAttempt *
          (1 + Math.random()) *
          CONNECTION_ERROR_RECONNECT_DELAY
      )
    } else {
      if (!this.switchToWsFallbackIfPossible()) {
        this.disconnect()
        this.changeState({
          ...this.state,
          error: 'unable-to-connect',
        })
      }
    }
  }

  private onDisconnect() {
    this.connectionAttempt = null
    this.changeState({
      ...this.state,
      readyState: WebSocket.CLOSED,
    })
    if (this.disconnectIfIdleSince(DISCONNECT_AFTER_MS)) return
    if (this.state.error === 'rate-limited') {
      this.tryReconnectWithBackoff(JOIN_PROJECT_RATE_LIMITED_DELAY)
    } else {
      this.startAutoReconnectCountdown(0)
    }
  }

  private onForceDisconnect(
    delay: number,
    error: ConnectionError = 'maintenance'
  ) {
    clearInterval(this.idleDisconnectInterval)
    clearTimeout(this.reconnectCountdownInterval)
    window.removeEventListener('online', this.onOnline)

    window.setTimeout(() => this.disconnect(), 1000 * delay)

    this.changeState({
      ...this.state,
      forceDisconnected: true,
      forcedDisconnectDelay: delay,
      error,
    })
  }

  private onJoinProjectResponse({
    protocolVersion,
    publicId,
  }: {
    protocolVersion: number
    publicId: string
  }) {
    if (
      this.protocolVersion !== -1 &&
      this.protocolVersion !== protocolVersion
    ) {
      this.onForceDisconnect(0, 'protocol-changed')
      return
    }
    this.protocolVersion = protocolVersion
    this.socket.publicId = publicId
    this.connectionAttempt = null
    this.changeState({
      ...this.state,
      readyState: WebSocket.OPEN,
      error: '',
      reconnectAt: null,
    })
  }

  private onReconnectGracefully() {
    // Disconnect idle users a little earlier than the 24h limit.
    if (this.disconnectIfIdleSince(DISCONNECT_AFTER_MS * 0.75)) return
    if (this.gracefullyReconnectUntil) return
    this.gracefullyReconnectUntil =
      performance.now() + MAX_RECONNECT_GRACEFULLY_INTERVAL_MS
    this.tryReconnectGracefully()
  }

  private canReconnect(): boolean {
    if (this.state.readyState === WebSocket.OPEN) return false // no need to reconnect
    if (this.state.forceDisconnected) return false // reconnecting blocked
    return true
  }

  private isReconnectingSoon(ms: number): boolean {
    if (!this.state.reconnectAt) return false
    return this.state.reconnectAt - performance.now() <= ms
  }

  private hasReconnectedRecently(ms: number): boolean {
    return performance.now() - this.state.lastConnectionAttempt < ms
  }

  private isUserInactiveSince(since: number): boolean {
    return performance.now() - this.lastUserActivity > since
  }

  private disconnectIfIdleSince(threshold: number): boolean {
    if (!this.isUserInactiveSince(threshold)) return false
    const previouslyClosed = this.state.readyState === WebSocket.CLOSED
    this.changeState({
      ...this.state,
      readyState: WebSocket.CLOSED,
      inactiveDisconnect: true,
    })
    if (!previouslyClosed) {
      this.socket.disconnect()
    }
    return true
  }

  disconnect() {
    this.changeState({
      ...this.state,
      readyState: WebSocket.CLOSED,
    })
    this.socket.disconnect()
  }

  private ensureIsConnected() {
    if (this.state.readyState === WebSocket.OPEN) return
    this.tryReconnectWithBackoff(
      this.state.error === 'rate-limited'
        ? JOIN_PROJECT_RATE_LIMITED_DELAY
        : USER_ACTIVITY_RECONNECT_DELAY
    )
  }

  private startAutoReconnectCountdown(backoff: number) {
    if (this.userIsLeavingPage) return
    if (!this.canReconnect()) return
    let countdown
    if (this.isUserInactiveSince(TWO_MINUTES_IN_MS)) {
      countdown = 60 + Math.floor(Math.random() * 2 * 60)
    } else {
      countdown = 3 + Math.floor(Math.random() * 7)
    }
    const ms = backoff + countdown * 1000
    if (this.isReconnectingSoon(ms)) return

    this.changeState({
      ...this.state,
      reconnectAt: performance.now() + ms,
    })
    clearTimeout(this.reconnectCountdownInterval)
    this.reconnectCountdownInterval = window.setTimeout(() => {
      if (this.isReconnectingSoon(0)) {
        this.tryReconnect()
      }
    }, ms)
  }

  private tryReconnect() {
    this.gracefullyReconnectUntil = 0
    this.changeState({
      ...this.state,
      reconnectAt: null,
    })
    if (!this.canReconnect()) return

    this.connectionAttempt = 0
    this.changeState({
      ...this.state,
      readyState: WebSocket.CONNECTING,
      error: '',
      inactiveDisconnect: false,
      lastConnectionAttempt: performance.now(),
    })

    this.addReconnectListeners()
    this.socket.socket.connect()
  }

  private addReconnectListeners() {
    const handleFailure = () => {
      removeSocketListeners()
      this.startAutoReconnectCountdown(0)
    }
    const handleSuccess = () => {
      removeSocketListeners()
    }
    const removeSocketListeners = () => {
      this.socket.removeListener('error', handleFailure)
      this.socket.removeListener('connect', handleSuccess)
    }
    this.socket.on('error', handleFailure)
    this.socket.on('connect', handleSuccess)
  }

  private tryReconnectGracefully() {
    if (
      this.state.readyState === WebSocket.CLOSED ||
      !this.gracefullyReconnectUntil
    )
      return
    if (
      this.gracefullyReconnectUntil < performance.now() ||
      this.isUserInactiveSince(RECONNECT_GRACEFULLY_RETRY_INTERVAL_MS)
    ) {
      this.disconnect()
      this.tryReconnect()
    } else {
      setTimeout(() => {
        this.tryReconnectGracefully()
      }, RECONNECT_GRACEFULLY_RETRY_INTERVAL_MS)
    }
  }

  private tryReconnectWithBackoff(backoff: number) {
    if (this.hasReconnectedRecently(backoff)) {
      this.startAutoReconnectCountdown(backoff)
    } else {
      this.tryReconnect()
    }
  }
}
