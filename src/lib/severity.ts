import type { EonetEvent } from '../types/eonet'
import { latestEventTimestamp, isPointGeometry, latestGeometryOf } from '../types/eonet'
import type { WeatherSnapshot } from '../types/weather'
import type { GdacsAlert, GdacsAlertLevel } from '../types/hazards'
import { GDACS_TO_EONET_CATEGORY, ALERT_RANK } from './api/gdacs'
import { haversineKm } from './geo'

export type SeverityLevel = 'low' | 'medium' | 'high'

export interface SeverityResult {
  level: SeverityLevel
  /** Raw heuristic score, exposed mainly for debugging/tuning — not shown to users. */
  score: number
  /** Plain-language reasons behind the score, shown in the UI. */
  reasons: string[]
  /**
   * True when the level came from a GDACS assessment rather than this file's
   * heuristic. The UI leans on this to decide whether to disclaim the number.
   */
  official: boolean
  /** The GDACS alert the level was taken from, when there was one. */
  source: GdacsAlert | null
}

// Brightened for the dark map shell — must stay legible as small cluster
// bubbles and 10px badges. Keep in sync with --color-sev-* in app.css.
export const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  low: '#5FD68A',
  medium: '#FFB443',
  high: '#FF6A5A',
}

export const SEVERITY_LABELS: Record<SeverityLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

// Categories that tend to carry higher inherent risk regardless of weather.
const HIGH_BASELINE_CATEGORIES = new Set(['wildfires', 'volcanoes', 'earthquakes', 'severeStorms'])

/** Proximity tolerance per hazard type, for the location-matched types. */
const MATCH_RADIUS_KM: Record<string, number> = {
  earthquakes: 150,
  volcanoes: 150,
  floods: 250,
  wildfires: 250,
  drought: 400,
}
const DEFAULT_MATCH_RADIUS_KM = 200

/** Events must overlap in time within this slack to be the same incident. */
const TIME_SLACK_MS = 3 * 24 * 3_600_000

const LEVEL_FROM_ALERT: Record<GdacsAlertLevel, SeverityLevel> = {
  Green: 'low',
  Orange: 'medium',
  Red: 'high',
}

/**
 * Words that appear in hazard titles but carry no identity — stripped before
 * comparing names so "Typhoon Noul" and "NOUL-26" reduce to the same token.
 */
const TITLE_STOP_WORDS = new Set([
  'TROPICAL',
  'CYCLONE',
  'STORM',
  'TYPHOON',
  'HURRICANE',
  'DEPRESSION',
  'SUPER',
  'SEVERE',
  'EARTHQUAKE',
  'FLOOD',
  'FLOODS',
  'WILDFIRE',
  'WILDFIRES',
  'FIRE',
  'VOLCANO',
  'DROUGHT',
  'OVERALL',
  'GREEN',
  'ORANGE',
  'RED',
  'ALERT',
])

/** Distinctive uppercase tokens in a title — proper nouns, effectively. */
function nameTokens(title: string): Set<string> {
  return new Set(
    title
      .toUpperCase()
      .split(/[^A-Z]+/)
      .filter((token) => token.length >= 4 && !TITLE_STOP_WORDS.has(token)),
  )
}

function sharesName(a: string, b: string): boolean {
  const tokensA = nameTokens(a)
  if (tokensA.size === 0) return false
  for (const token of nameTokens(b)) {
    if (tokensA.has(token)) return true
  }
  return false
}

/** [start, end] of an EONET event's observed activity. */
function eventWindow(event: EonetEvent): [number, number] {
  const first = event.geometry[0]?.date
  const start = first ? new Date(first).getTime() : 0
  const end = event.closed ? new Date(event.closed).getTime() : (latestEventTimestamp(event) ?? Date.now())
  return [start, end]
}

function overlaps(a: [number, number], b: [number, number]): boolean {
  return a[0] - TIME_SLACK_MS <= b[1] && b[0] - TIME_SLACK_MS <= a[1]
}

/**
 * Find the GDACS alert describing the same incident as an EONET event.
 *
 * Neither feed carries the other's identifiers, so there is nothing to join on
 * and the match has to be inferred. How, depends on the hazard:
 *
 * - **Tropical cyclones are matched by name only.** They travel thousands of
 *   kilometres, so any radius wide enough to catch the right storm also
 *   catches the wrong one — an early proximity-based version confidently
 *   matched "Typhoon Noul" to the unrelated "RAGASA-25". Both feeds use the
 *   WMO storm name, which is unambiguous.
 * - **Everything else is matched by proximity and overlapping dates**, since
 *   those hazards are geographically fixed and usually unnamed.
 *
 * A name match anywhere is treated as decisive. Otherwise the most severe
 * qualifying alert wins, then the nearest.
 */
export function matchGdacsAlert(event: EonetEvent, alerts: GdacsAlert[]): GdacsAlert | null {
  if (alerts.length === 0) return null

  const geometry = latestGeometryOf(event)
  if (!geometry || !isPointGeometry(geometry)) return null
  const [lng, lat] = geometry.coordinates

  const categoryIds = new Set(event.categories.map((c) => c.id))
  const window = eventWindow(event)

  let best: GdacsAlert | null = null
  let bestDistance = Infinity

  for (const alert of alerts) {
    const mappedCategory = GDACS_TO_EONET_CATEGORY[alert.eventType]
    if (!categoryIds.has(mappedCategory)) continue

    const named = sharesName(event.title, alert.title)

    if (alert.eventType === 'TC') {
      // Named storms: the name is the only trustworthy signal.
      if (!named) continue
      return alert
    }

    if (!overlaps(window, [alert.from.getTime(), (alert.to ?? alert.from).getTime()])) continue

    const distance = haversineKm(lat, lng, alert.lat, alert.lng)
    if (!named && distance > (MATCH_RADIUS_KM[mappedCategory] ?? DEFAULT_MATCH_RADIUS_KM)) continue
    if (named) return alert

    if (
      !best ||
      ALERT_RANK[alert.alertLevel] > ALERT_RANK[best.alertLevel] ||
      (ALERT_RANK[alert.alertLevel] === ALERT_RANK[best.alertLevel] && distance < bestDistance)
    ) {
      best = alert
      bestDistance = distance
    }
  }

  return best
}

/**
 * Risk estimate for an event.
 *
 * When a GDACS alert covers the same incident its official level is used
 * verbatim — that assessment is made by the JRC from population exposure and
 * hazard magnitude, and no heuristic here can improve on it. The recency +
 * category + weather scoring below is the fallback for the majority of EONET
 * events that GDACS doesn't track, and is explicitly labelled as an estimate.
 */
export function computeSeverity(
  event: EonetEvent,
  weather: WeatherSnapshot | null,
  gdacsAlert: GdacsAlert | null = null,
): SeverityResult {
  if (gdacsAlert) {
    const reasons = [`GDACS ${gdacsAlert.alertLevel.toLowerCase()} alert`]
    if (gdacsAlert.severityText) reasons.push(gdacsAlert.severityText)
    if (gdacsAlert.country) reasons.push(gdacsAlert.country)
    return {
      level: LEVEL_FROM_ALERT[gdacsAlert.alertLevel],
      score: gdacsAlert.alertScore,
      reasons,
      official: true,
      source: gdacsAlert,
    }
  }

  let score = 0
  const reasons: string[] = []

  // Recency: a recently-updated event suggests it's still active/developing.
  const latestTs = latestEventTimestamp(event)
  const ageHours = latestTs ? (Date.now() - latestTs) / 36e5 : Infinity
  if (ageHours <= 24) {
    score += 2
    reasons.push('Updated within the last day')
  } else if (ageHours <= 24 * 7) {
    score += 1
    reasons.push('Updated within the last week')
  } else {
    reasons.push('No recent updates')
  }

  // Category baseline.
  const categoryId = event.categories[0]?.id
  if (categoryId && HIGH_BASELINE_CATEGORIES.has(categoryId)) {
    score += 1
  }

  // Live weather conditions at the event's last known location.
  if (weather) {
    if (weather.windSpeedKph >= 60) {
      score += 2
      reasons.push(`High winds (${weather.windSpeedKph} km/h)`)
    } else if (weather.windSpeedKph >= 35) {
      score += 1
      reasons.push(`Elevated winds (${weather.windSpeedKph} km/h)`)
    }

    if (weather.temperatureC >= 38 || weather.temperatureC <= -10) {
      score += 1
      reasons.push(`Extreme temperature (${weather.temperatureC}°C)`)
    }

    if (weather.precipitationMm >= 10) {
      score += 1
      reasons.push(`Heavy precipitation (${weather.precipitationMm} mm)`)
    }
  }

  let level: SeverityLevel = 'low'
  if (score >= 4) level = 'high'
  else if (score >= 2) level = 'medium'

  return { level, score, reasons, official: false, source: null }
}
