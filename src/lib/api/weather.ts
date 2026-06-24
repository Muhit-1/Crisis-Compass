import type { OpenMeteoForecastResponse, WeatherSnapshot } from '../../types/weather'

const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast'

// Cache weather lookups per rounded lat/lng for a few minutes so repeated
// clicks on the same region don't spam the API. Phase 1 just stubs the shape;
// wired into the UI in Phase 2.
const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { expires: number; data: WeatherSnapshot }>()

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(1)},${lng.toFixed(1)}`
}

/**
 * Fetch the current weather snapshot for a given coordinate.
 * Throws on network failure or a non-2xx response so callers can show an error state.
 */
export async function getCurrentWeather(lat: number, lng: number): Promise<WeatherSnapshot> {
  const key = cacheKey(lat, lng)
  const cached = cache.get(key)
  if (cached && cached.expires > Date.now()) {
    return cached.data
  }

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: 'temperature_2m,wind_speed_10m,precipitation,uv_index',
  })

  const url = `${OPEN_METEO_BASE_URL}?${params.toString()}`

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Open-Meteo request failed: ${res.status} ${res.statusText}`)
  }

  const data = (await res.json()) as OpenMeteoForecastResponse

  const snapshot: WeatherSnapshot = {
    temperatureC: data.current.temperature_2m,
    windSpeedKph: data.current.wind_speed_10m,
    precipitationMm: data.current.precipitation,
    uvIndex: data.current.uv_index ?? null,
    observedAt: data.current.time,
  }

  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, data: snapshot })
  return snapshot
}
