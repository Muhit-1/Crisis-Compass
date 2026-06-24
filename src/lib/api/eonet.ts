import type { EonetEventsResponse, EonetEvent } from '../../types/eonet'

const EONET_BASE_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events'

export interface GetEventsOptions {
  /** 'open' = ongoing events, 'closed' = resolved, 'all' = both. Default 'open'. */
  status?: 'open' | 'closed' | 'all'
  /** Only return events from the last N days. */
  days?: number
  /** Limit number of events returned. */
  limit?: number
  /** Abort the request if it hasn't resolved within this many ms. Default 15000. */
  timeoutMs?: number
}

/**
 * Fetch natural events from NASA EONET.
 * Throws on network failure, timeout, or a non-2xx response so callers can show an error state.
 *
 * Without an explicit timeout, a stalled/blocked request just hangs forever and the UI is
 * stuck on "Loading events…" with no feedback — this is what was happening before. We now
 * abort after `timeoutMs` and surface a clear, actionable error instead.
 */
export async function getEvents(options: GetEventsOptions = {}): Promise<EonetEvent[]> {
  const { status = 'open', days, limit, timeoutMs = 15000 } = options

  const params = new URLSearchParams()
  params.set('status', status)
  if (days) params.set('days', String(days))
  if (limit) params.set('limit', String(limit))

  const url = `${EONET_BASE_URL}?${params.toString()}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      throw new Error(`EONET request failed: ${res.status} ${res.statusText}`)
    }

    const data = (await res.json()) as EonetEventsResponse
    return data.events
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        `EONET request timed out after ${Math.round(timeoutMs / 1000)}s. The API may be slow, or this network/firewall may be blocking eonet.gsfc.nasa.gov.`,
      )
    }
    if (err instanceof TypeError) {
      // fetch() throws a generic TypeError for network failures and CORS rejections,
      // with details only visible in the browser console (not to JS).
      throw new Error(
        'Network request to EONET failed. Check your connection, or open the browser console for more detail (this can also happen if something on your network blocks NASA .gov domains).',
      )
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}
