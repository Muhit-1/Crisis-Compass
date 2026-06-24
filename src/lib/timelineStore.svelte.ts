import { getEvents } from './api/eonet'
import type { EonetEvent } from '../types/eonet'
import { eventsStore } from './eventsStore.svelte'

export const TIMELINE_WINDOW_DAYS = 30

function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

/**
 * Drives the 30-day timeline slider. `daysAgo === 0` means "Live" — the map
 * falls back to the always-current `eventsStore`. Moving the slider loads a
 * one-time 30-day window of open + closed events (fetched lazily, only once
 * the user actually scrubs) and filters it down to whatever was active on
 * the selected day.
 */
class TimelineStore {
  daysAgo = $state(0)
  historicalEvents = $state<EonetEvent[]>([])
  loading = $state(false)
  error = $state<string | null>(null)

  #loaded = false

  get active(): boolean {
    return this.daysAgo > 0
  }

  get selectedDate(): Date {
    const d = new Date()
    d.setDate(d.getDate() - this.daysAgo)
    return startOfDay(d)
  }

  async ensureLoaded(): Promise<void> {
    if (this.#loaded || this.loading) return
    this.loading = true
    this.error = null
    try {
      this.historicalEvents = await getEvents({ status: 'all', days: TIMELINE_WINDOW_DAYS })
      this.#loaded = true
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to load event history'
    } finally {
      this.loading = false
    }
  }

  setDaysAgo(value: number): void {
    const clamped = Math.min(Math.max(0, Math.round(value)), TIMELINE_WINDOW_DAYS - 1)
    this.daysAgo = clamped
    if (clamped > 0) void this.ensureLoaded()
  }

  resetToLive(): void {
    this.daysAgo = 0
  }

  retry(): void {
    this.#loaded = false
    void this.ensureLoaded()
  }

  /** Events considered "active" on the selected historical day. Falls back to live events when not scrubbing. */
  get eventsOnSelectedDay(): EonetEvent[] {
    if (!this.active) return eventsStore.events

    const day = this.selectedDate
    return this.historicalEvents.filter((event) => {
      const firstGeometry = event.geometry[0]
      if (!firstGeometry) return false

      const startedAt = startOfDay(new Date(firstGeometry.date))
      if (startedAt > day) return false // hadn't started yet on the selected day

      if (event.closed) {
        const closedAt = startOfDay(new Date(event.closed))
        if (closedAt < day) return false // already closed before the selected day
      }

      return true
    })
  }
}

export const timelineStore = new TimelineStore()
