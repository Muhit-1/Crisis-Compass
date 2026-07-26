import type { GdacsAlert, GdacsAlertLevel, GdacsEventType } from '../../types/hazards'

/**
 * GDACS — the Global Disaster Alert and Coordination System (UN OCHA / EC JRC).
 *
 * Keyless GeoJSON with `Access-Control-Allow-Origin: *`. The value here isn't
 * the event list — EONET already has one — it's `alertlevel` and
 * `severitydata`, which are official assessments rather than the recency
 * heuristic this app would otherwise be guessing with.
 *
 * Note the endpoint is slower than the others (~3s) and blank filter params
 * return only Orange and Red; Green events are omitted by default.
 */
const EVENT_LIST_URL =
  'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?fromDate=&toDate=&alertlevel=&eventlist='

const EVENT_TYPES: GdacsEventType[] = ['EQ', 'TC', 'FL', 'DR', 'VO', 'WF']
const ALERT_LEVELS: GdacsAlertLevel[] = ['Green', 'Orange', 'Red']

/** GDACS hazard code → the EONET category it corresponds to. */
export const GDACS_TO_EONET_CATEGORY: Record<GdacsEventType, string> = {
  EQ: 'earthquakes',
  TC: 'severeStorms',
  FL: 'floods',
  DR: 'drought',
  VO: 'volcanoes',
  WF: 'wildfires',
}

export const GDACS_TYPE_LABEL: Record<GdacsEventType, string> = {
  EQ: 'Earthquake',
  TC: 'Tropical cyclone',
  FL: 'Flood',
  DR: 'Drought',
  VO: 'Volcano',
  WF: 'Wildfire',
}

/** Rank used for sorting and for deciding which alert "wins" when several match. */
export const ALERT_RANK: Record<GdacsAlertLevel, number> = {
  Green: 0,
  Orange: 1,
  Red: 2,
}

interface GdacsFeature {
  geometry: { type: string; coordinates: [number, number] } | null
  properties: {
    eventtype: string
    eventid: number | string
    episodeid?: number | string
    eventname?: string
    name?: string
    description?: string
    country?: string
    alertlevel?: string
    alertscore?: number
    fromdate?: string
    todate?: string
    iscurrent?: boolean | string
    severitydata?: { severity?: number; severitytext?: string; severityunit?: string }
    url?: { report?: string }
  }
}

interface GdacsResponse {
  features?: GdacsFeature[]
}

/**
 * GDACS timestamps come back without a zone marker but are UTC. Parsing them
 * directly would reinterpret them in the browser's timezone.
 */
function parseUtc(value: string | undefined): Date | null {
  if (!value) return null
  const normalised = value.endsWith('Z') ? value : `${value}Z`
  const parsed = new Date(normalised)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export interface GetAlertsOptions {
  timeoutMs?: number
}

export async function getGdacsAlerts(options: GetAlertsOptions = {}): Promise<GdacsAlert[]> {
  const { timeoutMs = 20000 } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(EVENT_LIST_URL, { signal: controller.signal })
    if (!res.ok) {
      throw new Error(`GDACS request failed: ${res.status} ${res.statusText}`)
    }

    const data = (await res.json()) as GdacsResponse

    return (data.features ?? [])
      .filter(
        (f): f is GdacsFeature & { geometry: { type: 'Point'; coordinates: [number, number] } } =>
          f.geometry?.type === 'Point' && Array.isArray(f.geometry.coordinates),
      )
      .map((f) => {
        const p = f.properties
        const [lng, lat] = f.geometry.coordinates

        const eventType = EVENT_TYPES.includes(p.eventtype as GdacsEventType)
          ? (p.eventtype as GdacsEventType)
          : null
        if (!eventType) return null

        const alertLevel = ALERT_LEVELS.includes(p.alertlevel as GdacsAlertLevel)
          ? (p.alertlevel as GdacsAlertLevel)
          : 'Green'

        const title =
          [p.eventname, p.name, p.description].find((v) => v && v.trim().length > 0)?.trim() ??
          GDACS_TYPE_LABEL[eventType]

        const from = parseUtc(p.fromdate)
        if (!from) return null

        return {
          id: `${p.eventtype}-${p.eventid}-${p.episodeid ?? '0'}`,
          eventType,
          title,
          country: p.country?.trim() || null,
          alertLevel,
          alertScore: typeof p.alertscore === 'number' ? p.alertscore : 0,
          severityText: p.severitydata?.severitytext?.trim() || null,
          from,
          to: parseUtc(p.todate),
          isCurrent: p.iscurrent === true || p.iscurrent === 'true',
          lat,
          lng,
          reportUrl: p.url?.report ?? 'https://www.gdacs.org/',
        } satisfies GdacsAlert
      })
      .filter((a): a is GdacsAlert => a !== null)
      .sort((a, b) => ALERT_RANK[b.alertLevel] - ALERT_RANK[a.alertLevel])
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`GDACS request timed out after ${Math.round(timeoutMs / 1000)}s.`)
    }
    if (err instanceof TypeError) {
      throw new Error('Network request to GDACS failed.')
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}
