import { DEFAULT_MODEL, WEATHER_LAYERS, WEATHER_MODELS, type ModelId, type WeatherLayerKey } from './weatherLayers'
import type { TemperatureUnit, WindUnit } from './units.svelte'

/**
 * The whole view encoded in the query string, so a link reproduces exactly
 * what someone was looking at — layer, hour, model, units and map position.
 *
 * Written with `replaceState` rather than `pushState`: scrubbing the timeline
 * would otherwise bury the back button under hundreds of history entries.
 */
export interface ViewState {
  layer: WeatherLayerKey | null
  isobars: boolean
  quakes: boolean
  alerts: boolean
  categories: string[]
  hourOffset: number
  model: ModelId
  temperature: TemperatureUnit
  wind: WindUnit
  center?: [number, number]
  zoom?: number
}

const LAYER_KEYS = new Set(WEATHER_LAYERS.map((l) => l.key))
const MODEL_IDS = new Set(WEATHER_MODELS.map((m) => m.id))

function bool(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback
  return value === '1' || value === 'true'
}

function num(value: string | null): number | undefined {
  if (value === null) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

/** Parse the current URL. Anything unrecognised falls back rather than throwing. */
export function readViewState(search = window.location.search): Partial<ViewState> {
  const q = new URLSearchParams(search)
  const out: Partial<ViewState> = {}

  const layer = q.get('layer')
  if (layer === 'none') out.layer = null
  else if (layer && LAYER_KEYS.has(layer as WeatherLayerKey)) out.layer = layer as WeatherLayerKey

  if (q.has('iso')) out.isobars = bool(q.get('iso'), false)
  if (q.has('eq')) out.quakes = bool(q.get('eq'), true)
  if (q.has('al')) out.alerts = bool(q.get('al'), true)

  const cats = q.get('cat')
  if (cats !== null) out.categories = cats ? cats.split(',').filter(Boolean) : []

  const hour = num(q.get('t'))
  if (hour !== undefined) out.hourOffset = Math.round(hour)

  const model = q.get('model')
  if (model && MODEL_IDS.has(model as ModelId)) out.model = model as ModelId

  const temp = q.get('tu')
  if (temp === 'C' || temp === 'F') out.temperature = temp

  const wind = q.get('wu')
  if (wind === 'kmh' || wind === 'ms' || wind === 'kt') out.wind = wind

  const lng = num(q.get('lng'))
  const lat = num(q.get('lat'))
  const zoom = num(q.get('z'))
  if (lng !== undefined && lat !== undefined) out.center = [lng, lat]
  if (zoom !== undefined) out.zoom = zoom

  return out
}

/** Serialise, omitting anything still at its default to keep links short. */
export function writeViewState(state: ViewState): void {
  const q = new URLSearchParams()

  q.set('layer', state.layer ?? 'none')
  if (state.isobars) q.set('iso', '1')
  if (!state.quakes) q.set('eq', '0')
  if (!state.alerts) q.set('al', '0')
  if (state.categories.length) q.set('cat', state.categories.join(','))
  if (state.hourOffset !== 0) q.set('t', String(state.hourOffset))
  if (state.model !== DEFAULT_MODEL) q.set('model', state.model)
  if (state.temperature !== 'C') q.set('tu', state.temperature)
  if (state.wind !== 'kmh') q.set('wu', state.wind)
  if (state.center) {
    q.set('lng', state.center[0].toFixed(3))
    q.set('lat', state.center[1].toFixed(3))
  }
  if (state.zoom !== undefined) q.set('z', state.zoom.toFixed(2))

  const next = `${window.location.pathname}?${q.toString()}`
  window.history.replaceState(null, '', next)
}
