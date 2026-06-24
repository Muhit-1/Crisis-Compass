import type { EonetEventsResponse, EonetEvent } from '../../types/eonet'

const EONET_BASE_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events'

export interface GetEventsOptions {
  /** 'open' = ongoing events, 'closed' = resolved, 'all' = both. Default 'open'. */
  status?: 'open' | 'closed' | 'all'
  /** Only return events from the last N days. */
  days?: number
  /** Limit number of events returned. */
  limit?: number
}

/**
 * Fetch natural events from NASA EONET.
 * Throws on network failure or a non-2xx response so callers can show an error state.
 */
export async function getEvents(options: GetEventsOptions = {}): Promise<EonetEvent[]> {
  const { status = 'open', days, limit } = options

  const params = new URLSearchParams()
  params.set('status', status)
  if (days) params.set('days', String(days))
  if (limit) params.set('limit', String(limit))

  const url = `${EONET_BASE_URL}?${params.toString()}`

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`EONET request failed: ${res.status} ${res.statusText}`)
  }

  const data = (await res.json()) as EonetEventsResponse
  return data.events
}
