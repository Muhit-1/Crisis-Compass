/**
 * World weather raster tiles via OpenWeatherMap. Distinct from the Open-Meteo
 * point lookups used for per-event weather — this is a continuous map overlay,
 * which Open-Meteo doesn't offer in a plain-Leaflet-compatible tile format.
 */
export type WeatherLayerKey = 'temp_new' | 'clouds_new' | 'precipitation_new' | 'wind_new'

export interface WeatherLayerOption {
  key: WeatherLayerKey
  label: string
}

export const WEATHER_LAYER_OPTIONS: WeatherLayerOption[] = [
  { key: 'temp_new', label: 'Temperature' },
  { key: 'clouds_new', label: 'Clouds' },
  { key: 'precipitation_new', label: 'Precipitation' },
  { key: 'wind_new', label: 'Wind' },
]

const OWM_TILE_BASE = 'https://tile.openweathermap.org/map'

function apiKeyOrThrow(): string {
  const apiKey = import.meta.env.VITE_OPENWEATHERMAP_API_KEY as string | undefined
  if (!apiKey) {
    throw new Error(
      'Missing OpenWeatherMap API key. Add VITE_OPENWEATHERMAP_API_KEY to a .env file and restart the dev server.',
    )
  }
  return apiKey
}

export function owmTileUrl(layer: WeatherLayerKey): string {
  return `${OWM_TILE_BASE}/${layer}/{z}/{x}/{y}.png?appid=${apiKeyOrThrow()}`
}

/**
 * Tile layers fail silently in Leaflet — a bad key just renders a blank tile,
 * never an error event. So before trusting the layer, fetch one known tile
 * directly and translate the HTTP status into an actionable message. This
 * catches the #1 cause of "the overlay shows nothing": a fresh OpenWeatherMap
 * key that hasn't activated yet (can take up to ~2 hours after signup).
 */
export async function checkOwmKey(): Promise<void> {
  const apiKey = apiKeyOrThrow()
  const probeUrl = `${OWM_TILE_BASE}/temp_new/2/2/1.png?appid=${apiKey}`

  let res: Response
  try {
    res = await fetch(probeUrl)
  } catch {
    throw new Error('Could not reach OpenWeatherMap — check your network connection.')
  }

  if (res.status === 401) {
    throw new Error(
      'OpenWeatherMap rejected the API key (401). New keys can take up to ~2 hours to activate — if you just created it, wait and refresh. Otherwise check VITE_OPENWEATHERMAP_API_KEY in .env and restart the dev server.',
    )
  }
  if (!res.ok) {
    throw new Error(`OpenWeatherMap tile request failed: ${res.status} ${res.statusText}`)
  }
}