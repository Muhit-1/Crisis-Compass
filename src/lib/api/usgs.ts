import type { Quake } from '../../types/hazards'

/**
 * USGS earthquake feeds.
 *
 * Pre-generated GeoJSON, no key, `Access-Control-Allow-Origin: *`, updated
 * every minute. Feeds exist for each magnitude/period combination, so the
 * payload is chosen by picking a URL rather than by filtering client-side.
 */
const FEED_BASE = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary'

export type QuakeFeed =
  | 'all_hour'
  | 'all_day'
  | '2.5_day'
  | '2.5_week'
  | '4.5_week'
  | 'significant_month'

/** M2.5+ over the past week: ~380 quakes, ~267 kB. Enough to read as a pattern. */
export const DEFAULT_QUAKE_FEED: QuakeFeed = '2.5_week'

interface UsgsFeature {
  id: string
  properties: {
    mag: number | null
    place: string | null
    time: number
    tsunami: number
    sig: number
    alert: string | null
    url: string
  }
  geometry: { type: string; coordinates: [number, number, number] }
}

interface UsgsResponse {
  features: UsgsFeature[]
}

export interface GetQuakesOptions {
  feed?: QuakeFeed
  timeoutMs?: number
}

export async function getQuakes(options: GetQuakesOptions = {}): Promise<Quake[]> {
  const { feed = DEFAULT_QUAKE_FEED, timeoutMs = 15000 } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${FEED_BASE}/${feed}.geojson`, { signal: controller.signal })
    if (!res.ok) {
      throw new Error(`USGS request failed: ${res.status} ${res.statusText}`)
    }

    const data = (await res.json()) as UsgsResponse

    return data.features
      .filter((f) => f.geometry?.type === 'Point' && f.properties.mag !== null)
      .map((f) => {
        const [lng, lat, depth] = f.geometry.coordinates
        return {
          id: f.id,
          magnitude: f.properties.mag as number,
          place: f.properties.place ?? 'Unknown location',
          time: new Date(f.properties.time),
          depthKm: depth,
          lat,
          lng,
          tsunami: f.properties.tsunami === 1,
          significance: f.properties.sig,
          pagerAlert: f.properties.alert,
          url: f.properties.url,
        } satisfies Quake
      })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`USGS request timed out after ${Math.round(timeoutMs / 1000)}s.`)
    }
    if (err instanceof TypeError) {
      throw new Error('Network request to USGS failed.')
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}
