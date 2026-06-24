import type { EonetEvent } from '../types/eonet'
import { latestEventTimestamp } from '../types/eonet'
import type { WeatherSnapshot } from '../types/weather'

export type SeverityLevel = 'low' | 'medium' | 'high'

export interface SeverityResult {
  level: SeverityLevel
  /** Raw heuristic score, exposed mainly for debugging/tuning — not shown to users. */
  score: number
  /** Plain-language reasons behind the score, shown in the UI. */
  reasons: string[]
}

export const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  low: '#8FBF8F',
  medium: '#E0A458',
  high: '#C97064',
}

export const SEVERITY_LABELS: Record<SeverityLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

// Categories that tend to carry higher inherent risk regardless of weather.
const HIGH_BASELINE_CATEGORIES = new Set(['wildfires', 'volcanoes', 'earthquakes', 'severeStorms'])

/**
 * Heuristic-only risk estimate from event recency + category + (optional) live weather.
 * This is NOT an official hazard rating — see project plan §6 Data Notes / Risks.
 */
export function computeSeverity(event: EonetEvent, weather: WeatherSnapshot | null): SeverityResult {
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

  return { level, score, reasons }
}
