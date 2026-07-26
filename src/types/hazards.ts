/**
 * Hazard feeds that sit alongside NASA EONET.
 *
 * EONET is a catalogue of *events* with no severity attached. These two fill
 * the two biggest gaps in it: USGS is the authoritative real-time earthquake
 * source (EONET's earthquake coverage is close to empty), and GDACS carries
 * official UN/EC alert levels, which is the only non-guessed severity signal
 * available to this app.
 */

export interface Quake {
  id: string
  magnitude: number
  /** Human-readable location, e.g. "112 km SSE of Hasaki, Japan". */
  place: string
  time: Date
  depthKm: number
  lat: number
  lng: number
  tsunami: boolean
  /** USGS "significance" score, 0–1000ish — combines magnitude, felt reports and impact. */
  significance: number
  /** USGS PAGER impact colour, when one has been issued. */
  pagerAlert: string | null
  url: string
}

export type GdacsAlertLevel = 'Green' | 'Orange' | 'Red'

/** GDACS hazard type codes. */
export type GdacsEventType = 'EQ' | 'TC' | 'FL' | 'DR' | 'VO' | 'WF'

export interface GdacsAlert {
  id: string
  eventType: GdacsEventType
  /** Falls back through eventname → name → description. */
  title: string
  country: string | null
  alertLevel: GdacsAlertLevel
  /** 0–3ish; finer grained than the level. */
  alertScore: number
  /** e.g. "Magnitude 5.5M, Depth:10km" or "Hurricane/Typhoon > 74 mph". */
  severityText: string | null
  from: Date
  to: Date | null
  /** GDACS still considers the episode ongoing. */
  isCurrent: boolean
  lat: number
  lng: number
  reportUrl: string
}
