import type { ExpressionSpecification } from 'maplibre-gl'

/**
 * Display units.
 *
 * The two data paths disagree natively: the tile package emits temperature in
 * °C and wind in m/s, while the point-forecast API defaults to °C and km/h.
 * Everything is therefore normalised here — tile values are converted from
 * their native unit, and API requests simply ask for the chosen unit directly.
 */

export type TemperatureUnit = 'C' | 'F'
export type WindUnit = 'kmh' | 'ms' | 'kt'

export const TEMPERATURE_UNITS: { key: TemperatureUnit; label: string }[] = [
  { key: 'C', label: '°C' },
  { key: 'F', label: '°F' },
]

export const WIND_UNITS: { key: WindUnit; label: string }[] = [
  { key: 'kmh', label: 'km/h' },
  { key: 'ms', label: 'm/s' },
  { key: 'kt', label: 'kt' },
]

export const TEMPERATURE_SUFFIX: Record<TemperatureUnit, string> = { C: '°C', F: '°F' }
export const WIND_SUFFIX: Record<WindUnit, string> = { kmh: 'km/h', ms: 'm/s', kt: 'kt' }

/** What to pass to Open-Meteo so it does the conversion server-side. */
export const API_TEMPERATURE_UNIT: Record<TemperatureUnit, string> = {
  C: 'celsius',
  F: 'fahrenheit',
}
export const API_WIND_UNIT: Record<WindUnit, string> = {
  kmh: 'kmh',
  ms: 'ms',
  kt: 'kn',
}

const MS_TO = { kmh: 3.6, ms: 1, kt: 1.943844 } as const
const KMH_TO = { kmh: 1, ms: 1 / 3.6, kt: 0.539957 } as const

/** °C → chosen unit. */
export function fromCelsius(value: number, unit: TemperatureUnit): number {
  return unit === 'F' ? value * 1.8 + 32 : value
}

/** m/s → chosen unit. Tile values arrive in m/s. */
export function fromMetresPerSecond(value: number, unit: WindUnit): number {
  return value * MS_TO[unit]
}

/** km/h → chosen unit. Most of the app's stored snapshots are km/h. */
export function fromKmh(value: number, unit: WindUnit): number {
  return value * KMH_TO[unit]
}

/**
 * MapLibre expression converting a tile `value` into the chosen unit.
 *
 * Grid labels are rendered by the GPU from vector-tile properties, so the
 * conversion has to be expressed as data rather than computed in JS.
 */
export function tileValueExpression(
  native: 'celsius' | 'ms' | 'none',
  temperature: TemperatureUnit,
  wind: WindUnit,
): ExpressionSpecification {
  const value: ExpressionSpecification = ['get', 'value']
  if (native === 'celsius' && temperature === 'F') {
    return ['+', ['*', value, 1.8], 32]
  }
  if (native === 'ms' && wind !== 'ms') {
    return ['*', value, MS_TO[wind]]
  }
  return value
}

class UnitsStore {
  temperature = $state<TemperatureUnit>('C')
  wind = $state<WindUnit>('kmh')

  setTemperature(unit: TemperatureUnit) {
    this.temperature = unit
  }
  setWind(unit: WindUnit) {
    this.wind = unit
  }
}

export const unitsStore = new UnitsStore()
