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
const MODEL = 'dwd_icon'
const RUN_INTERVAL_HOURS = 6

/** How far back the tile archive is retained. Verified empirically — day -7 resolves, day -8 is gone. */
export const HISTORY_DAYS = 7

export const WEATHER_ATTRIBUTION = 'Weather &copy; Open-Meteo (DWD ICON)'

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
}

export const WEATHER_LAYERS: WeatherLayerDef[] = [
  {
    key: 'wind',
    label: 'Wind',
    iconName: 'wind',
    variable: 'wind_u_component_10m',
    hasDirection: true,
    hint: 'Speed at 10 m',
  },
  {
    key: 'temperature',
    label: 'Temperature',
    iconName: 'thermometer',
    variable: 'temperature_2m',
    hint: 'At 2 m',
  },
  { key: 'rain', label: 'Rain', iconName: 'rain', variable: 'precipitation' },
  { key: 'clouds', label: 'Clouds', iconName: 'cloudsLayer', variable: 'cloud_cover' },
  {
    key: 'gusts',
    label: 'Gusts',
    iconName: 'wind',
    variable: 'wind_gusts_10m',
    hint: 'Peak wind',
  },
  {
    key: 'storm',
    label: 'Storm energy',
    iconName: 'severeStorms',
    variable: 'cape',
    hint: 'CAPE — thunderstorm potential',
  },
]

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
export async function loadRunIndex(): Promise<RunIndex> {
  const url = `${TILE_BASE}/${MODEL}/latest.json`

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
  return `"${variable}" isn't published in the current ${MODEL} run.`
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

  const datePart = `${folder.getUTCFullYear()}/${pad(folder.getUTCMonth() + 1)}/${pad(folder.getUTCDate())}`
  const runPart = `${pad(folder.getUTCHours())}00Z`
  const validPart =
    `${snapped.getUTCFullYear()}-${pad(snapped.getUTCMonth() + 1)}-${pad(snapped.getUTCDate())}` +
    `T${pad(snapped.getUTCHours())}00`

  return `${TILE_BASE}/${MODEL}/${datePart}/${runPart}/${validPart}.om?variable=${variable}`
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

/** Vector-tile URL carrying pressure isolines (`contours` source-layer, `level` property). */
export function omIsobarUrl(time: Date, run: RunIndex): string {
  const base = omFileUrl(ISOBAR_VARIABLE, time, run)
  return `om://${base}&contours=true&intervals=${ISOBAR_INTERVAL_HPA}`
}
