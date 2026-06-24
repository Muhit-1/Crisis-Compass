/**
 * Type definitions for the Open-Meteo "current weather" API.
 * Docs: https://open-meteo.com/en/docs
 */

/** Units that come back alongside each "current" field, keyed by field name. */
export interface OpenMeteoCurrentUnits {
  time: string
  interval: string
  temperature_2m: string
  wind_speed_10m: string
  precipitation: string
  uv_index?: string
}

/** The live weather snapshot for a single lat/lng at the time of the request. */
export interface OpenMeteoCurrent {
  time: string
  interval: number
  temperature_2m: number
  wind_speed_10m: number
  precipitation: number
  uv_index?: number
}

/** Shape of the raw JSON returned by GET /v1/forecast (current-weather mode). */
export interface OpenMeteoForecastResponse {
  latitude: number
  longitude: number
  generationtime_ms: number
  utc_offset_seconds: number
  timezone: string
  timezone_abbreviation: string
  elevation: number
  current_units: OpenMeteoCurrentUnits
  current: OpenMeteoCurrent
}

/** Simplified shape our UI actually consumes. */
export interface WeatherSnapshot {
  temperatureC: number
  windSpeedKph: number
  precipitationMm: number
  uvIndex: number | null
  observedAt: string
}
