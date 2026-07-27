import type { IconName } from './icons'

/**
 * World weather overlay — powered by Open-Meteo's spatial OM-file tiles.
 *
 * The OM protocol and MapLibre are loaded lazily inside async functions so
 * that a package error never breaks the base map initialization.
 *
 * Package docs: https://github.com/open-meteo/weather-map-layer
 *
 * ## Addressing a point in time
 *
 * Every `.om` tile file is addressed by *two* timestamps: which model run
 * produced it, and which hour that run is forecasting. The layout is
 *
 *     <base>/<model>/YYYY/MM/DD/HHMMZ/YYYY-MM-DDTHHMM.om?variable=<v>
 *                    ^^^^^^^^^^^^^^^^ run folder    ^^^^ valid time
 *
 * DWD ICON publishes a run every 6 hours (00/06/12/18Z), each reaching 5 days
 * forward, and the archive keeps roughly 7 days of past runs. Together that's
 * the ~12-day window the timeline can scrub.
 *
 * We resolve the current run *once* via `latest.json` and then build direct
 * file paths for every frame. Going through `latest.json?time_step=...` on
 * every frame would work too, but the package's own docs warn it costs an
 * extra metadata round-trip (0.5–1s) per request — unusable during playback.
 */

const TILE_BASE = 'https://map-tiles.open-meteo.com/data_spatial'
const RUN_INTERVAL_HOURS = 6

/**
 * Global models that publish every variable this app draws.
 *
 * Verified against each model's live `latest.json`: GFS, UK Met Office and
 * JMA were dropped because they omit variables the layer list depends on
 * (10 m wind components, gusts or CAPE), which would leave dead entries in the
 * picker. Horizons differ a lot — the timeline reads its bounds from whichever
 * run is loaded, so switching model reshapes the scrubber automatically.
 */
export type ModelId =
  | 'dwd_icon'
  | 'ecmwf_ifs025'
  | 'meteofrance_arpege_world025'
  | 'cma_grapes_global'

export interface WeatherModel {
  id: ModelId
  label: string
  hint: string
}

export const WEATHER_MODELS: WeatherModel[] = [
  { id: 'dwd_icon', label: 'ICON', hint: 'DWD · 11 km · 7.5 d' },
  { id: 'ecmwf_ifs025', label: 'ECMWF', hint: 'IFS · 25 km · 15 d' },
  { id: 'meteofrance_arpege_world025', label: 'ARPEGE', hint: 'Météo-France · 4 d' },
  { id: 'cma_grapes_global', label: 'GRAPES', hint: 'CMA · 5 d' },
]

export const DEFAULT_MODEL: ModelId = 'dwd_icon'

/** How far back the tile archive is retained. Verified empirically — day -7 resolves, day -8 is gone. */
export const HISTORY_DAYS = 7

export function weatherAttribution(model: ModelId): string {
  const label = WEATHER_MODELS.find((m) => m.id === model)?.label ?? model
  return `Weather &copy; Open-Meteo (${label})`
}

export type WeatherLayerKey = 'wind' | 'temperature' | 'rain' | 'clouds' | 'gusts' | 'storm'

export interface WeatherLayerDef {
  key: WeatherLayerKey
  label: string
  iconName: IconName
  /** Variable name as published in the model run. */
  variable: string
  /**
   * Whether the package can derive a direction field for this variable, which
   * is what arrow overlays need. True for anything matching its u/v
   * derivation rule — requesting `*_u_component_*` transparently fetches both
   * components and returns speed + bearing, NOT the raw eastward component.
   */
  hasDirection?: boolean
  /** Shown under the layer name in the picker. */
  hint?: string
  /**
   * Variable name in the point-forecast API, which differs from the tile
   * variable for wind: tiles derive speed from u/v components, the API
   * exposes wind_speed_10m directly.
   */
  apiVariable: string
  /** Unit the TILE values arrive in, so grid labels can be converted. */
  nativeUnit: 'celsius' | 'ms' | 'none'
  /** Appended to the on-map value labels, e.g. "27°". Kept very short. */
  valueSuffix: string
  /** Decimal places for those labels. */
  valueDecimals: number
  /**
   * Suppress labels below this value. Precipitation is zero across most of the
   * map, and a field of "0"s is pure noise.
   */
  minLabelValue?: number
}

export const WEATHER_LAYERS: WeatherLayerDef[] = [
  {
    key: 'wind',
    nativeUnit: 'ms',
    apiVariable: 'wind_speed_10m',
    label: 'Wind',
    iconName: 'wind',
    variable: 'wind_u_component_10m',
    hasDirection: true,
    hint: 'Speed at 10 m',
    valueSuffix: '',
    valueDecimals: 0,
  },
  {
    key: 'temperature',
    nativeUnit: 'celsius',
    apiVariable: 'temperature_2m',
    label: 'Temperature',
    iconName: 'thermometer',
    variable: 'temperature_2m',
    hint: 'At 2 m',
    valueSuffix: '°',
    valueDecimals: 0,
  },
  {
    key: 'rain',
    nativeUnit: 'none',
    apiVariable: 'precipitation',
    label: 'Rain',
    iconName: 'rain',
    variable: 'precipitation',
    valueSuffix: '',
    valueDecimals: 1,
    minLabelValue: 0.2,
  },
  {
    key: 'clouds',
    nativeUnit: 'none',
    apiVariable: 'cloud_cover',
    label: 'Clouds',
    iconName: 'cloudsLayer',
    variable: 'cloud_cover',
    valueSuffix: '%',
    valueDecimals: 0,
  },
  {
    key: 'gusts',
    nativeUnit: 'ms',
    apiVariable: 'wind_gusts_10m',
    label: 'Gusts',
    iconName: 'wind',
    variable: 'wind_gusts_10m',
    hint: 'Peak wind',
    valueSuffix: '',
    valueDecimals: 0,
  },
  {
    key: 'storm',
    nativeUnit: 'none',
    apiVariable: 'cape',
    label: 'Storm energy',
    iconName: 'severeStorms',
    variable: 'cape',
    hint: 'CAPE — thunderstorm potential',
    valueSuffix: '',
    valueDecimals: 0,
  },
]

/**
 * Two tiers of on-map value labels.
 *
 * City labels come first, because named places are what makes a number
 * meaningful — "Dhaka 27°" reads instantly where a bare 27 floating over the
 * delta does not. The raw model grid is only unlocked once zoomed far enough
 * in that the points are spaced out, since at low zoom it's a wall of digits.
 */
export const CITY_LABEL_MINZOOM = 4
export const GRID_LABEL_MINZOOM = 7

const LAYER_BY_KEY = new Map(WEATHER_LAYERS.map((l) => [l.key, l]))

export function weatherLayer(key: WeatherLayerKey): WeatherLayerDef {
  const def = LAYER_BY_KEY.get(key)
  if (!def) throw new Error(`Unknown weather layer: ${key}`)
  return def
}

/** Mean sea-level pressure, drawn as isolines rather than a colour field. */
export const ISOBAR_VARIABLE = 'pressure_msl'
/** Contour spacing in hPa. 4 is the standard interval on synoptic charts. */
export const ISOBAR_INTERVAL_HPA = 4

/** Resolved metadata for the newest completed model run. */
export interface RunIndex {
  /** Which model this run came from — every tile URL is built from it. */
  model: ModelId
  /** When the run was initialised — also the first hour it can describe. */
  referenceTime: Date
  /** Every hour this run forecasts, ascending. */
  validTimes: Date[]
  /** Variables published in this run. */
  variables: string[]
}

interface LatestJson {
  reference_time?: string
  valid_times?: string[]
  variables?: string[]
}

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

/**
 * Fetch the index for the newest completed run. Called once at startup; every
 * tile URL afterwards is derived from the result without further requests.
 */
export async function loadRunIndex(model: ModelId = DEFAULT_MODEL): Promise<RunIndex> {
  const url = `${TILE_BASE}/${model}/latest.json`

  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new Error('Could not reach Open-Meteo map tiles — check your network connection.')
  }

  if (!res.ok) {
    throw new Error(`Open-Meteo map tile index failed: ${res.status} ${res.statusText}`)
  }

  const index = (await res.json()) as LatestJson

  if (!index.reference_time || !index.valid_times?.length) {
    throw new Error('Open-Meteo returned a model run index with no valid times.')
  }

  return {
    model,
    referenceTime: new Date(index.reference_time),
    validTimes: index.valid_times.map((t) => new Date(t)),
    variables: index.variables ?? [],
  }
}

/**
 * Whether the run publishes a variable.
 *
 * Derived variables are a special case: the u/v rule means a request for
 * `wind_u_component_10m` also needs `wind_v_component_10m` present, and the
 * index lists both, so a plain membership test is still correct.
 */
export function hasVariable(run: RunIndex, variable: string): boolean {
  // An empty variable list means the index didn't declare any — assume yes
  // rather than blocking the layer on missing metadata.
  if (run.variables.length === 0) return true
  return run.variables.includes(variable)
}

/** Human-readable explanation for a layer the current run can't serve. */
export function missingVariableMessage(variable: string): string {
  return `"${variable}" isn't published in the current model run.`
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Which run folder holds a given hour.
 *
 * Anything at or after the newest run comes from that run (it's the only one
 * that forecasts forward). Anything earlier comes from the 6-hourly run at or
 * before it, so we're always reading a run's own analysis or a short lead time
 * rather than a stale 5-day-old forecast.
 */
function runFolderFor(time: Date, run: RunIndex): Date {
  if (time.getTime() >= run.referenceTime.getTime()) return run.referenceTime

  const folder = new Date(time)
  folder.setUTCMinutes(0, 0, 0)
  folder.setUTCHours(Math.floor(folder.getUTCHours() / RUN_INTERVAL_HOURS) * RUN_INTERVAL_HOURS)
  return folder
}

/**
 * Snap an arbitrary hour to one the run actually publishes.
 *
 * The forecast side is NOT uniformly hourly: DWD ICON emits hourly steps to
 * +78h and 3-hourly after that (93 steps across a 120-hour span). Scrubbing by
 * raw hours would request files that don't exist for two hours out of every
 * three near the end of the run.
 *
 * The past side needs no snapping — historical frames always read from a run
 * at most 6 hours older than the target, well inside the hourly portion.
 */
export function snapToValidTime(time: Date, run: RunIndex): Date {
  if (time.getTime() < run.referenceTime.getTime()) return time

  let best = time
  let bestDelta = Infinity
  for (const valid of run.validTimes) {
    const delta = Math.abs(valid.getTime() - time.getTime())
    if (delta < bestDelta) {
      bestDelta = delta
      best = valid
    }
  }
  return best
}

function omFileUrl(variable: string, time: Date, run: RunIndex): string {
  const snapped = snapToValidTime(time, run)
  const folder = runFolderFor(snapped, run)

  const model = run.model
  const datePart = `${folder.getUTCFullYear()}/${pad(folder.getUTCMonth() + 1)}/${pad(folder.getUTCDate())}`
  const runPart = `${pad(folder.getUTCHours())}00Z`
  const validPart =
    `${snapped.getUTCFullYear()}-${pad(snapped.getUTCMonth() + 1)}-${pad(snapped.getUTCDate())}` +
    `T${pad(snapped.getUTCHours())}00`

  return `${TILE_BASE}/${model}/${datePart}/${runPart}/${validPart}.om?variable=${variable}`
}

export interface TileUrlOptions {
  /** Selects the package's dark-tuned palettes. Match to the active basemap. */
  dark?: boolean
}

/** Raster colour-field URL for a layer at a specific hour. */
export function omRasterUrl(
  key: WeatherLayerKey,
  time: Date,
  run: RunIndex,
  options: TileUrlOptions = {},
): string {
  const base = omFileUrl(weatherLayer(key).variable, time, run)
  return `om://${base}${options.dark ? '&dark=true' : ''}`
}

/**
 * Vector-tile URL carrying direction arrows (`arrows` source-layer).
 * Only meaningful for layers whose variable resolves to a direction field.
 */
export function omArrowsUrl(key: WeatherLayerKey, time: Date, run: RunIndex): string {
  return `om://${omFileUrl(weatherLayer(key).variable, time, run)}&arrows=true`
}

/**
 * Vector-tile URL carrying one point per model grid cell (`grid` source-layer,
 * `value` property, plus `direction` where the variable has one).
 *
 * This is what makes the "numbers scattered across the map" reading possible —
 * the same trick Windy uses to show a value at every town — except the points
 * are the model's own grid rather than a city list, so no extra data source is
 * involved and the values are exactly what the raster underneath is painting.
 */
export function omGridUrl(key: WeatherLayerKey, time: Date, run: RunIndex): string {
  return `om://${omFileUrl(weatherLayer(key).variable, time, run)}&grid=true`
}

/** Vector-tile URL carrying pressure isolines (`contours` source-layer, `level` property). */
export function omIsobarUrl(time: Date, run: RunIndex): string {
  const base = omFileUrl(ISOBAR_VARIABLE, time, run)
  return `om://${base}&contours=true&intervals=${ISOBAR_INTERVAL_HPA}`
}
