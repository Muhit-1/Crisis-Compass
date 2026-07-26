import type { IconName } from './icons'

/**
 * WMO 4677 present-weather codes, as returned by Open-Meteo's `weather_code`.
 * Grouped into the handful of buckets the UI actually distinguishes — there's
 * no value in separating "light" from "moderate" drizzle in a summary line.
 */
interface WeatherCodeInfo {
  label: string
  iconName: IconName
}

const GROUPS: { codes: number[]; label: string; iconName: IconName }[] = [
  { codes: [0], label: 'Clear', iconName: 'sun' },
  { codes: [1, 2], label: 'Partly cloudy', iconName: 'cloudsLayer' },
  { codes: [3], label: 'Overcast', iconName: 'cloudsLayer' },
  { codes: [45, 48], label: 'Fog', iconName: 'dustHaze' },
  { codes: [51, 53, 55, 56, 57], label: 'Drizzle', iconName: 'rain' },
  { codes: [61, 63, 65, 66, 67], label: 'Rain', iconName: 'rain' },
  { codes: [80, 81, 82], label: 'Rain showers', iconName: 'rain' },
  { codes: [71, 73, 75, 77, 85, 86], label: 'Snow', iconName: 'snow' },
  { codes: [95, 96, 99], label: 'Thunderstorm', iconName: 'severeStorms' },
]

const BY_CODE = new Map<number, WeatherCodeInfo>()
for (const group of GROUPS) {
  for (const code of group.codes) {
    BY_CODE.set(code, { label: group.label, iconName: group.iconName })
  }
}

const UNKNOWN: WeatherCodeInfo = { label: 'Unknown', iconName: 'other' }

export function describeWeatherCode(code: number): WeatherCodeInfo {
  return BY_CODE.get(code) ?? UNKNOWN
}

/** Compass point for a meteorological wind bearing (direction the wind blows FROM). */
export function compassPoint(degrees: number): string {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return points[Math.round(((degrees % 360) + 360) % 360 / 45) % 8]
}
