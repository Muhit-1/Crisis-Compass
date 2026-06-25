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

/** Throws a clear, actionable error if the key isn't configured — caught and shown in the UI. */
export function owmTileUrl(layer: WeatherLayerKey): string {
  const apiKey = import.meta.env.VITE_OPENWEATHERMAP_API_KEY as string | undefined

  if (!apiKey) {
    throw new Error(
      'Missing OpenWeatherMap API key. Sign up free at openweathermap.org/api and add VITE_OPENWEATHERMAP_API_KEY to a .env file, then restart the dev server.',
    )
  }

  return `${OWM_TILE_BASE}/${layer}/{z}/{x}/{y}.png?appid=${apiKey}`
}