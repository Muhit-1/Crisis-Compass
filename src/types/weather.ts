export interface OpenMeteoCurrentUnits {
  time: string
  interval: string
  temperature_2m: string
  apparent_temperature: string
  relative_humidity_2m: string
  wind_speed_10m: string
  precipitation: string
  uv_index?: string
}

export interface OpenMeteoCurrent {
  time: string
  interval: number
  temperature_2m: number
  apparent_temperature: number
  relative_humidity_2m: number
  wind_speed_10m: number
  precipitation: number
  uv_index?: number
}

export interface OpenMeteoHourly {
  time: string[]
  precipitation_probability: number[]
}

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
  hourly?: OpenMeteoHourly
}

export interface WeatherSnapshot {
  temperatureC: number
  feelsLikeC: number
  humidityPct: number
  windSpeedKph: number
  precipitationMm: number
  precipChancePct: number | null
  uvIndex: number | null
  observedAt: string
}