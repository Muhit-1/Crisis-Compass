import type {
  ForecastHour,
  OpenMeteoForecastResponse,
  OpenMeteoPointResponse,
  PointForecast,
  WeatherSnapshot,
} from '../../types/weather'

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

    // ✅ UPDATED SNAPSHOT (your new structure)
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
// ---------------------------------------------------------------------------
// Point forecast (meteogram)
// ---------------------------------------------------------------------------

/**
 * Days of history and forecast requested for the click-anywhere meteogram.
 * Chosen to span the master clock's window so the selected-time marker always
 * lands somewhere on the chart. The whole response is ~18 kB.
 */
const POINT_PAST_DAYS = 7
const POINT_FORECAST_DAYS = 7

const POINT_HOURLY_VARS = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation',
  'precipitation_probability',
  'wind_speed_10m',
  'wind_direction_10m',
  'cloud_cover',
  'weather_code',
].join(',')

const pointCache = new Map<string, { expires: number; data: PointForecast }>()

/**
 * Hourly forecast for an arbitrary coordinate.
 *
 * Requested with `timezone=auto` so the labels read as local wall-clock time at
 * the location, which is what someone reading a meteogram wants. That means
 * `hourly.time` comes back WITHOUT a zone suffix — parsing it directly would
 * silently reinterpret it in the browser's timezone. Absolute instants are
 * reconstructed from the returned UTC offset instead.
 */
export async function getPointForecast(
  lat: number,
  lng: number,
  options: GetWeatherOptions = {},
): Promise<PointForecast> {
  const { timeoutMs = 15000 } = options

  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`
  const cached = pointCache.get(key)
  if (cached && cached.expires > Date.now()) return cached.data

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    timezone: 'auto',
    past_days: String(POINT_PAST_DAYS),
    forecast_days: String(POINT_FORECAST_DAYS),
    hourly: POINT_HOURLY_VARS,
  })

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${OPEN_METEO_BASE_URL}?${params.toString()}`, {
      signal: controller.signal,
    })

    if (!res.ok) {
      throw new Error(`Open-Meteo request failed: ${res.status} ${res.statusText}`)
    }

    const data = (await res.json()) as OpenMeteoPointResponse
    const h = data.hourly
    const offsetMs = data.utc_offset_seconds * 1000

    const hours: ForecastHour[] = h.time.map((localIso, i) => ({
      // Treat the local string as UTC, then undo the offset to get the real instant.
      at: new Date(Date.parse(`${localIso}Z`) - offsetMs),
      localIso,
      temperatureC: h.temperature_2m[i],
      feelsLikeC: h.apparent_temperature[i],
      precipitationMm: h.precipitation[i] ?? 0,
      precipChancePct: h.precipitation_probability?.[i] ?? null,
      windSpeedKph: h.wind_speed_10m[i],
      windDirectionDeg: h.wind_direction_10m[i],
      cloudCoverPct: h.cloud_cover[i],
      weatherCode: h.weather_code[i],
    }))

    const forecast: PointForecast = {
      latitude: data.latitude,
      longitude: data.longitude,
      elevationM: data.elevation,
      timezone: data.timezone,
      utcOffsetSeconds: data.utc_offset_seconds,
      hours,
      units: {
        temperature: data.hourly_units?.temperature_2m ?? '°C',
        precipitation: data.hourly_units?.precipitation ?? 'mm',
        wind: data.hourly_units?.wind_speed_10m ?? 'km/h',
      },
    }

    pointCache.set(key, { expires: Date.now() + CACHE_TTL_MS, data: forecast })
    return forecast
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Forecast request timed out after ${Math.round(timeoutMs / 1000)}s.`)
    }
    if (err instanceof TypeError) {
      throw new Error('Network request to Open-Meteo failed.')
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}
