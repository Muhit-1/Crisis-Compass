import { getEvents } from './api/eonet'
import type { EonetEvent } from '../types/eonet'

const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000

/**
 * Only pull events with activity in this window.
 *
 * An unbounded `status=open` query returns 4.8 MB of JSON — EONET keeps events
 * "open" for years, and each carries its full geometry history, so a wildfire
 * tracked daily for months contributes hundreds of coordinates. That payload
 * was downloaded on first paint and again on every auto-refresh, and parsing it
 * blocks the main thread.
 *
 * 30 days cuts it to ~196 kB (24x smaller) while still covering everything
 * actively developing. The trade-off: long-dormant open events — a volcano
 * flagged years ago with no recent updates — no longer appear. Raise this if
 * you want them back; it is the only knob involved.
 */
const ACTIVITY_WINDOW_DAYS = 30
// Prevents two refresh triggers (e.g. auto-timer + a manual click) landing
// within a few seconds of each other from firing two redundant requests.
const MIN_GAP_BETWEEN_FETCHES_MS = 20 * 1000

/**
 * Single source of truth for EONET events, shared across MapView, the stats
 * bar, and the live ticker. Centralizing the fetch here (instead of each
 * component fetching on its own) is what makes a debounced, shared
 * auto-refresh possible.
 */
class EventsStore {
  events = $state<EonetEvent[]>([])
  loading = $state(true)
  error = $state<string | null>(null)
  lastUpdated = $state<Date | null>(null)

  #timer: ReturnType<typeof setInterval> | null = null
  #lastFetchAt = 0
  #inFlight = false

  /**
   * Fetch the latest events. Calls within MIN_GAP_BETWEEN_FETCHES_MS of the
   * previous successful fetch are skipped unless `force` is set (used for the
   * very first load and for an explicit user-triggered refresh).
   */
  async refresh(force = false): Promise<void> {
    if (this.#inFlight) return
    const sinceLast = Date.now() - this.#lastFetchAt
    if (!force && sinceLast < MIN_GAP_BETWEEN_FETCHES_MS) return

    this.#inFlight = true
    if (this.events.length === 0) this.loading = true
    this.error = null

    try {
      this.events = await getEvents({ status: 'open', days: ACTIVITY_WINDOW_DAYS })
      this.lastUpdated = new Date()
      this.#lastFetchAt = Date.now()
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to load events'
    } finally {
      this.loading = false
      this.#inFlight = false
    }
  }

  /** Start polling. Safe to call multiple times — only one interval is ever active. */
  startAutoRefresh(): void {
    this.refresh(true)
    if (this.#timer) return
    this.#timer = setInterval(() => this.refresh(), AUTO_REFRESH_INTERVAL_MS)
  }

  stopAutoRefresh(): void {
    if (this.#timer) {
      clearInterval(this.#timer)
      this.#timer = null
    }
  }
}

export const eventsStore = new EventsStore()
