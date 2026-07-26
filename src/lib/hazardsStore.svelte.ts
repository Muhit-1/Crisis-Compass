import { getQuakes } from './api/usgs'
import { getGdacsAlerts } from './api/gdacs'
import type { GdacsAlert, Quake } from '../types/hazards'

const QUAKE_REFRESH_MS = 5 * 60 * 1000
/** GDACS assessments change on the order of hours, not minutes. */
const ALERT_REFRESH_MS = 15 * 60 * 1000

/**
 * USGS earthquakes and GDACS alerts.
 *
 * Both are fetched lazily — nothing is requested until the corresponding layer
 * is switched on — and each tracks its own loading/error state so one feed
 * being down never blanks the other.
 */
class HazardsStore {
  quakes = $state<Quake[]>([])
  quakesLoading = $state(false)
  quakesError = $state<string | null>(null)

  alerts = $state<GdacsAlert[]>([])
  alertsLoading = $state(false)
  alertsError = $state<string | null>(null)

  #quakeTimer: ReturnType<typeof setInterval> | null = null
  #alertTimer: ReturnType<typeof setInterval> | null = null
  #quakesInFlight = false
  #alertsInFlight = false

  async loadQuakes(): Promise<void> {
    if (this.#quakesInFlight) return
    this.#quakesInFlight = true
    if (this.quakes.length === 0) this.quakesLoading = true
    this.quakesError = null
    try {
      this.quakes = await getQuakes()
    } catch (err) {
      this.quakesError = err instanceof Error ? err.message : 'Failed to load earthquakes'
    } finally {
      this.quakesLoading = false
      this.#quakesInFlight = false
    }
  }

  async loadAlerts(): Promise<void> {
    if (this.#alertsInFlight) return
    this.#alertsInFlight = true
    if (this.alerts.length === 0) this.alertsLoading = true
    this.alertsError = null
    try {
      this.alerts = await getGdacsAlerts()
    } catch (err) {
      this.alertsError = err instanceof Error ? err.message : 'Failed to load GDACS alerts'
    } finally {
      this.alertsLoading = false
      this.#alertsInFlight = false
    }
  }

  /** Called when the earthquake layer is switched on. Idempotent. */
  startQuakes(): void {
    void this.loadQuakes()
    if (this.#quakeTimer) return
    this.#quakeTimer = setInterval(() => void this.loadQuakes(), QUAKE_REFRESH_MS)
  }

  stopQuakes(): void {
    if (this.#quakeTimer) {
      clearInterval(this.#quakeTimer)
      this.#quakeTimer = null
    }
  }

  startAlerts(): void {
    void this.loadAlerts()
    if (this.#alertTimer) return
    this.#alertTimer = setInterval(() => void this.loadAlerts(), ALERT_REFRESH_MS)
  }

  stopAlerts(): void {
    if (this.#alertTimer) {
      clearInterval(this.#alertTimer)
      this.#alertTimer = null
    }
  }

  stopAll(): void {
    this.stopQuakes()
    this.stopAlerts()
  }
}

export const hazardsStore = new HazardsStore()
