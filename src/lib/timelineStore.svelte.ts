import { getEvents } from './api/eonet'
import type { EonetEvent } from '../types/eonet'
import { eventsStore } from './eventsStore.svelte'
import {
  DEFAULT_MODEL,
  HISTORY_DAYS,
  loadRunIndex,
  snapToValidTime,
  type ModelId,
  type RunIndex,
} from './weatherLayers'

/**
 * How much EONET history to pull when the user scrubs into the past.
 *
 * Matched to the weather archive rather than picked independently: the
 * timeline can't go further back than the tiles can, so fetching more is dead
 * weight. The old 30-day window returned a payload large enough to blow the
 * 15s request timeout, which left past-scrubbing permanently broken.
 */
export const TIMELINE_WINDOW_DAYS = HISTORY_DAYS

/** Hours of past weather the tile archive can serve. */
export const HISTORY_HOURS = HISTORY_DAYS * 24

/** Playback advances in 3-hour jumps — hour-by-hour is too slow to read as motion. */
export const PLAYBACK_STEP_HOURS = 3
const PLAYBACK_INTERVAL_MS = 600

/** How often the "now" anchor is re-pinned so a long-lived session doesn't drift. */
const CLOCK_SYNC_INTERVAL_MS = 5 * 60 * 1000

function startOfHour(date: Date): Date {
  const copy = new Date(date)
  copy.setMinutes(0, 0, 0)
  return copy
}

function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000)
}

/**
 * The master clock every time-aware layer reads from.
 *
 * One offset in hours relative to the current hour drives everything: negative
 * scrubs into the past, positive into the forecast. Weather tiles resolve at
 * hour resolution; EONET events only carry daily dates, so they're filtered by
 * day — the clock is the single source of truth either way.
 *
 * `baseHour` is pinned rather than read from `Date.now()` on access, because a
 * getter whose value changes every call would retrigger effects endlessly.
 */
class TimelineStore {
  /** Hours relative to `baseHour`. 0 = live. */
  hourOffset = $state(0)

  /** The "now" the offset is measured against. */
  baseHour = $state(startOfHour(new Date()))

  /** Metadata for the newest model run — resolves the forecast horizon. */
  run = $state<RunIndex | null>(null)
  runError = $state<string | null>(null)
  model = $state<ModelId>(DEFAULT_MODEL)

  playing = $state(false)

  historicalEvents = $state<EonetEvent[]>([])
  loading = $state(false)
  error = $state<string | null>(null)

  #loaded = false
  #playTimer: ReturnType<typeof setInterval> | null = null
  #clockTimer: ReturnType<typeof setInterval> | null = null

  // ---- Derived time ----

  /**
   * The hour actually being displayed. Snapped to a frame the model publishes,
   * so the readout never claims an hour the map isn't showing — beyond +78h
   * the run only carries every third hour.
   */
  get selectedTime(): Date {
    const raw = addHours(this.baseHour, this.hourOffset)
    return this.run ? snapToValidTime(raw, this.run) : raw
  }

  /** Offset of the frame on screen, which can differ from the slider position after snapping. */
  get effectiveOffset(): number {
    return Math.round((this.selectedTime.getTime() - this.baseHour.getTime()) / 3_600_000)
  }

  get isLive(): boolean {
    return this.hourOffset === 0
  }

  /** Scrubbed into the past — EONET history applies, not the live feed. */
  get isPast(): boolean {
    return this.hourOffset < 0
  }

  get isForecast(): boolean {
    return this.hourOffset > 0
  }

  get minOffset(): number {
    return -HISTORY_HOURS
  }

  /** Forecast horizon of the loaded run, or 0 until it resolves. */
  get maxOffset(): number {
    const last = this.run?.validTimes.at(-1)
    if (!last) return 0
    return Math.floor((last.getTime() - this.baseHour.getTime()) / 3_600_000)
  }

  // ---- Lifecycle ----

  /** Load the model-run index and keep the "now" anchor fresh. */
  startClock(): void {
    void this.#loadRun()
    if (this.#clockTimer) return
    this.#clockTimer = setInterval(() => this.syncToNow(), CLOCK_SYNC_INTERVAL_MS)
  }

  stopClock(): void {
    this.pause()
    if (this.#clockTimer) {
      clearInterval(this.#clockTimer)
      this.#clockTimer = null
    }
  }

  async #loadRun(): Promise<void> {
    this.runError = null
    const requested = this.model
    try {
      const index = await loadRunIndex(requested)
      // A slow switch must not clobber a newer one.
      if (this.model !== requested) return
      this.run = index
    } catch (err) {
      if (this.model !== requested) return
      this.runError = err instanceof Error ? err.message : 'Failed to load the weather model index'
    }
  }

  retryRun(): void {
    void this.#loadRun()
  }

  /**
   * Switch forecast model.
   *
   * Horizons differ a lot — ICON reaches 7.5 days, ECMWF 15, ARPEGE 4 — so the
   * selected hour is re-clamped once the new run resolves rather than left
   * pointing past the end of a shorter forecast.
   */
  setModel(model: ModelId): void {
    if (model === this.model) return
    this.pause()
    this.model = model
    this.run = null
    void this.#loadRun().then(() => this.setOffset(this.hourOffset))
  }

  /**
   * Re-pin "now" to the current hour, holding the selected *instant* steady so
   * the map doesn't jump under the user when the hour rolls over.
   */
  syncToNow(): void {
    const nextBase = startOfHour(new Date())
    const drift = Math.round((nextBase.getTime() - this.baseHour.getTime()) / 3_600_000)
    if (drift === 0) return

    this.baseHour = nextBase
    if (!this.isLive) this.setOffset(this.hourOffset - drift)
  }

  // ---- Scrubbing ----

  setOffset(value: number): void {
    const clamped = Math.min(Math.max(this.minOffset, Math.round(value)), this.maxOffset)
    this.hourOffset = clamped
    if (clamped < 0) void this.ensureLoaded()
  }

  step(hours: number): void {
    this.setOffset(this.hourOffset + hours)
  }

  resetToLive(): void {
    this.pause()
    this.syncToNow()
    this.hourOffset = 0
  }

  // ---- Playback ----

  play(): void {
    if (this.playing) return
    this.playing = true
    this.#playTimer = setInterval(() => {
      const next = this.hourOffset + PLAYBACK_STEP_HOURS
      this.setOffset(next > this.maxOffset ? this.minOffset : next)
    }, PLAYBACK_INTERVAL_MS)
  }

  pause(): void {
    this.playing = false
    if (this.#playTimer) {
      clearInterval(this.#playTimer)
      this.#playTimer = null
    }
  }

  togglePlay(): void {
    if (this.playing) this.pause()
    else this.play()
  }

  // ---- EONET history ----

  async ensureLoaded(): Promise<void> {
    if (this.#loaded || this.loading) return
    this.loading = true
    this.error = null
    try {
      this.historicalEvents = await getEvents({
        status: 'all',
        days: TIMELINE_WINDOW_DAYS,
        // Still a much heavier query than the live feed — open + closed events
        // across a week — so it gets more headroom than the default 15s.
        timeoutMs: 30_000,
      })
      this.#loaded = true
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to load event history'
    } finally {
      this.loading = false
    }
  }

  retry(): void {
    this.#loaded = false
    void this.ensureLoaded()
  }

  /**
   * Events to show at the selected time. The forecast side has no event data —
   * you can't forecast a wildfire — so anything at or ahead of now shows the
   * live feed.
   */
  get eventsAtSelectedTime(): EonetEvent[] {
    if (!this.isPast) return eventsStore.events

    const day = startOfDay(this.selectedTime)
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
