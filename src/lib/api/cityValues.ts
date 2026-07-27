import type { City } from '../data/cities'
import { API_TEMPERATURE_UNIT, API_WIND_UNIT, type TemperatureUnit, type WindUnit } from '../units.svelte'

/**
 * Values for a list of cities at one hour, in a single request.
 *
 * Open-Meteo accepts comma-separated coordinate lists and returns an array of
 * results in the same order, so labelling 30 cities costs one round trip
 * rather than 30. `start_hour`/`end_hour` pin it to the exact hour the
 * timeline is showing, and `timezone=UTC` keeps that hour unambiguous.
 */
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'

/** Above this the URL gets unwieldy and the map gets crowded regardless. */
export const MAX_CITY_LABELS = 30

interface HourlyBlock {
  time?: string[]
  [variable: string]: unknown
}

interface PointResult {
  hourly?: HourlyBlock
}

const pad = (n: number) => String(n).padStart(2, '0')

/** `YYYY-MM-DDTHH:00` in UTC, the format the hour filters expect. */
function utcHourParam(date: Date): string {
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}:00`
  )
}

export interface CityValue {
  city: City
  value: number
}

/**
 * Returns only the cities a value came back for — a null reading is dropped
 * rather than labelled, since a blank label is worse than no label.
 */
export async function getCityValues(
  cities: City[],
  apiVariable: string,
  at: Date,
  units: { temperature: TemperatureUnit; wind: WindUnit },
  signal?: AbortSignal,
): Promise<CityValue[]> {
  if (cities.length === 0) return []

  const hour = utcHourParam(at)
  const params = new URLSearchParams({
    latitude: cities.map((c) => c.la).join(','),
    longitude: cities.map((c) => c.lo).join(','),
    hourly: apiVariable,
    start_hour: hour,
    end_hour: hour,
    timezone: 'UTC',
    // Let the API convert rather than doing it here — avoids a second source
    // of truth for rounding.
    temperature_unit: API_TEMPERATURE_UNIT[units.temperature],
    wind_speed_unit: API_WIND_UNIT[units.wind],
  })

  const res = await fetch(`${FORECAST_URL}?${params.toString()}`, { signal })
  if (!res.ok) throw new Error(`Open-Meteo city values failed: ${res.status}`)

  const body = (await res.json()) as PointResult | PointResult[]
  // A single coordinate returns an object rather than a one-element array.
  const results = Array.isArray(body) ? body : [body]

  const out: CityValue[] = []
  results.forEach((result, i) => {
    const city = cities[i]
    if (!city) return
    const series = result.hourly?.[apiVariable]
    const value = Array.isArray(series) ? (series[0] as number | null) : null
    if (typeof value === 'number' && Number.isFinite(value)) out.push({ city, value })
  })
  return out
}
