/**
 * World weather overlay — powered by Open-Meteo's spatial OM-file tiles.
 *
 * The OM protocol and MapLibre are loaded lazily inside async functions so
 * that a package error never breaks the base map initialization.
 *
 * Package docs: https://github.com/open-meteo/weather-map-layer
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

/**
 * DWD ICON spatial-tile variable names.
 * wind_speed_10m is NOT in the spatial tiles — DWD stores wind as
 * U (eastward) + V (northward) components. wind_u_component_10m gives a
 * useful directional overlay for the single-layer picker we have.
 */
const VARIABLE_BY_LAYER: Record<WeatherLayerKey, string> = {
  temp_new: 'temperature_2m',
  clouds_new: 'cloud_cover',
  precipitation_new: 'precipitation',
  wind_new: 'wind_u_component_10m',
}

const MODEL = 'dwd_icon'
const RUN_INDEX_URL = `https://map-tiles.open-meteo.com/data_spatial/${MODEL}/latest.json`

let _protocolRegistered = false

/**
 * Registers the om:// protocol with MapLibre. Fully lazy — imports both
 * maplibre-gl and @openmeteo/weather-map-layer only when first called.
 * Safe to call multiple times (no-ops after first success).
 */
export async function ensureOmProtocolRegistered(): Promise<void> {
  if (_protocolRegistered) return

  // Dynamic imports so a package-level error never breaks MapView mounting
  const [maplibreModule, omModule] = await Promise.all([
    import('maplibre-gl'),
    import('@openmeteo/weather-map-layer'),
  ])

  const maplibregl = maplibreModule.default
  const { omProtocol } = omModule

  maplibregl.addProtocol('om', omProtocol)
  _protocolRegistered = true
}

/** om:// source URL for a given layer. Only call after ensureOmProtocolRegistered resolves. */
export function omSourceUrl(layer: WeatherLayerKey): string {
  const variable = VARIABLE_BY_LAYER[layer]
  return `om://${RUN_INDEX_URL}?variable=${variable}`
}

/**
 * Fetches the current model-run index and verifies the variable is available.
 * Gives a clear, actionable error instead of a silently blank tile layer.
 */
export async function checkVariableAvailable(layer: WeatherLayerKey): Promise<void> {
  const variable = VARIABLE_BY_LAYER[layer]

  let res: Response
  try {
    res = await fetch(RUN_INDEX_URL)
  } catch {
    throw new Error('Could not reach Open-Meteo map tiles — check your network connection.')
  }

  if (!res.ok) {
    throw new Error(`Open-Meteo map tile index failed: ${res.status} ${res.statusText}`)
  }

  const index = (await res.json()) as { variables?: string[] }
  if (index.variables && !index.variables.includes(variable)) {
    // For wind, show which wind variables are actually available
    const hint =
      layer === 'wind_new'
        ? ` Available wind variables: ${index.variables.filter((v) => v.startsWith('wind')).join(', ')}.`
        : ''
    throw new Error(
      `"${variable}" isn't in the current ${MODEL} run.${hint} See ${RUN_INDEX_URL}.`,
    )
  }
}