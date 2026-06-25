import type { OpenMeteoForecastResponse, WeatherSnapshot } from '../../types/weather'

const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast'

// Cache weather lookups per rounded lat/lng for a few minutes so repeated
// clicks on the same region don't spam the API.
const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { expires: number; data: WeatherSnapshot }>()

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(1)},${lng.toFixed(1)}`
}

export interface GetWeatherOptions {
  /** Abort the request if it hasn't resolved within this many ms. Default 10000. */
  timeoutMs?: number
}

/**
 * Find the hourly array index matching the current observation hour.
 */
function hourlyIndexFor(data: OpenMeteoForecastResponse): number {
  const hourly = data.hourly
  if (!hourly?.time?.length) return -1

  const targetHour = data.current.time.slice(0, 13) // YYYY-MM-DDTHH
  return hourly.time.findIndex((t) => t.slice(0, 13) === targetHour)
}

/**
 * Get precipitation probability for the current hour.
 */
function precipChanceFor(data: OpenMeteoForecastResponse): number | null {
  const hourly = data.hourly

  if (!hourly?.precipitation_probability?.length) {
    return null
  }

  const idx = hourlyIndexFor(data)

  return (
    (idx >= 0
      ? hourly.precipitation_probability[idx]
      : hourly.precipitation_probability[0]) ?? null
  )
}

/**
 * Get UV index for the current hour.
 * Open-Meteo exposes uv_index in hourly data, not current data.
 */
function uvIndexFor(data: OpenMeteoForecastResponse): number | null {
  const hourly = data.hourly

  if (!hourly?.uv_index?.length) {
    return null
  }

  const idx = hourlyIndexFor(data)

  return (idx >= 0 ? hourly.uv_index[idx] : hourly.uv_index[0]) ?? null
}

/**
 * Fetch the current weather snapshot for a given coordinate.
 */
export async function getCurrentWeather(
  lat: number,
  lng: number,
  options: GetWeatherOptions = {},
): Promise<WeatherSnapshot> {
  const { timeoutMs = 10000 } = options

  const key = cacheKey(lat, lng)
  const cached = cache.get(key)

  if (cached && cached.expires > Date.now()) {
    return cached.data
  }

  // IMPORTANT:
  // uv_index is NOT a valid Open-Meteo "current" variable.
  // It must be requested under "hourly".
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    timezone: 'auto',
    current:
      'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,precipitation',
    hourly: 'precipitation_probability,uv_index',
    forecast_days: '1',
  })

  const url = `${OPEN_METEO_BASE_URL}?${params.toString()}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, { signal: controller.signal })

    if (!res.ok) {
      throw new Error(`Open-Meteo request failed: ${res.status} ${res.statusText}`)
    }

    const data = (await res.json()) as OpenMeteoForecastResponse

    const snapshot: WeatherSnapshot = {
      temperatureC: data.current.temperature_2m,
      feelsLikeC: data.current.apparent_temperature,
      humidityPct: data.current.relative_humidity_2m,
      windSpeedKph: data.current.wind_speed_10m,
      precipitationMm: data.current.precipitation,
      precipChancePct: precipChanceFor(data),
      uvIndex: uvIndexFor(data),
      observedAt: data.current.time,
    }

    cache.set(key, {
      expires: Date.now() + CACHE_TTL_MS,
      data: snapshot,
    })

    return snapshot
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        `Weather request timed out after ${Math.round(timeoutMs / 1000)}s.`,
      )
    }

    if (err instanceof TypeError) {
      throw new Error('Network request to Open-Meteo failed.')
    }

    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}