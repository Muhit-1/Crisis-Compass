export interface OpenMeteoCurrentUnits {
  time: string
  interval: string
  temperature_2m: string
  apparent_temperature: string
  relative_humidity_2m: string
  wind_speed_10m: string
  precipitation: string
}

export interface OpenMeteoCurrent {
  time: string
  interval: number
  temperature_2m: number
  apparent_temperature: number
  relative_humidity_2m: number
  wind_speed_10m: number
  precipitation: number
}

export interface OpenMeteoHourly {
  time: string[]
  precipitation_probability: number[]
  uv_index: number[]
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

/** One hour of the point forecast, already resolved to an absolute instant. */
export interface ForecastHour {
  /** True UTC instant — safe to compare against the master clock. */
  at: Date
  /** Wall-clock label at the forecast location, e.g. "2026-07-27T15:00". */
  localIso: string
  temperatureC: number
  feelsLikeC: number
  precipitationMm: number
  precipChancePct: number | null
  windSpeedKph: number
  windDirectionDeg: number
  cloudCoverPct: number
  weatherCode: number
}

export interface PointForecast {
  latitude: number
  longitude: number
  elevationM: number
  timezone: string
  utcOffsetSeconds: number
  hours: ForecastHour[]
  units: {
    temperature: string
    precipitation: string
    wind: string
  }
}

export interface OpenMeteoPointHourly {
  time: string[]
  temperature_2m: number[]
  apparent_temperature: number[]
  precipitation: number[]
  precipitation_probability: (number | null)[]
  wind_speed_10m: number[]
  wind_direction_10m: number[]
  cloud_cover: number[]
  weather_code: number[]
}

export interface OpenMeteoPointResponse {
  latitude: number
  longitude: number
  elevation: number
  timezone: string
  utc_offset_seconds: number
  hourly: OpenMeteoPointHourly
  hourly_units: Record<string, string>
}