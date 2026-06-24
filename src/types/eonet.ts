/**
 * Type definitions for the NASA EONET v3 API.
 * Docs: https://eonet.gsfc.nasa.gov/docs/v3
 */

/** A single category EONET assigns to an event (e.g. "Wildfires", "Severe Storms"). */
export interface EonetCategory {
  id: string
  title: string
  link?: string
}

/** Where the event data originally came from (e.g. InciWeb, GDACS). */
export interface EonetSource {
  id: string
  url: string
}

/**
 * A single point-in-time (or polygon-in-time) snapshot of an event's location.
 * Events that move or grow (storms, fires) have multiple geometry entries —
 * the array is ordered oldest -> newest.
 */
export interface EonetGeometry {
  date: string // ISO 8601 timestamp
  type: 'Point' | 'Polygon'
  /** [lng, lat] for Point, nested ring arrays for Polygon */
  coordinates: number[] | number[][][]
}

/** A single natural event as returned by the EONET /events endpoint. */
export interface EonetEvent {
  id: string
  title: string
  description: string | null
  link: string
  /** ISO date the event was marked closed, or null if still active. */
  closed: string | null
  categories: EonetCategory[]
  sources: EonetSource[]
  geometry: EonetGeometry[]
}

/** Shape of the raw JSON returned by GET /api/v3/events. */
export interface EonetEventsResponse {
  title: string
  description: string
  link: string
  events: EonetEvent[]
}

/** Category id strings we currently care about, used for filter UI + colors later. */
export type EonetCategoryId =
  | 'wildfires'
  | 'floods'
  | 'volcanoes'
  | 'severeStorms'
  | 'earthquakes'
  | 'seaLakeIce'
  | 'drought'
  | 'dustHaze'
  | 'landslides'
  | 'manmade'
  | 'snow'
  | 'tempExtremes'
  | 'waterColor'

/** Convenience: a Point geometry narrowed from the EonetGeometry union. */
export interface EonetPointGeometry extends EonetGeometry {
  type: 'Point'
  coordinates: [number, number]
}

export function isPointGeometry(g: EonetGeometry): g is EonetPointGeometry {
  return g.type === 'Point'
}
