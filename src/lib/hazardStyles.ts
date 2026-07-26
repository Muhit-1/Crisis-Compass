import type { GdacsAlertLevel, GdacsEventType } from '../types/hazards'
import type { IconName } from './icons'

/** GDACS alert colours — deliberately the traffic-light scheme GDACS itself uses. */
export const ALERT_COLORS: Record<GdacsAlertLevel, string> = {
  Green: '#5FD68A',
  Orange: '#FFB443',
  Red: '#FF4D4D',
}

export const ALERT_ICONS: Record<GdacsEventType, IconName> = {
  EQ: 'earthquakes',
  TC: 'severeStorms',
  FL: 'floods',
  DR: 'drought',
  VO: 'volcanoes',
  WF: 'wildfires',
}

/**
 * Earthquake markers are sized and coloured by magnitude only.
 *
 * Magnitude is logarithmic, so a linear radius ramp would make everything
 * below M5 look identical — the interpolation is weighted to spread the
 * M2.5–M5 range where most of the data sits.
 */
export const QUAKE_COLOR_STOPS: [number, string][] = [
  [2.5, '#7FD4C9'],
  [4, '#E0C060'],
  [5, '#FFB443'],
  [6, '#FF7A45'],
  [7, '#FF4D4D'],
]

export const QUAKE_RADIUS_STOPS: [number, number][] = [
  [2.5, 3],
  [4, 5.5],
  [5, 8],
  [6, 12],
  [8, 20],
]

export function quakeColor(magnitude: number): string {
  let color = QUAKE_COLOR_STOPS[0][1]
  for (const [threshold, value] of QUAKE_COLOR_STOPS) {
    if (magnitude >= threshold) color = value
  }
  return color
}
