import type { ExpressionSpecification } from 'maplibre-gl'

/**
 * Base map options.
 *
 * Both live in a single MapLibre style at once and are switched by toggling
 * layer visibility rather than calling `setStyle`. That matters: `setStyle`
 * tears down every custom source and layer, so event markers, the weather
 * raster and the Near Me ring would all have to be rebuilt on each switch.
 */

/**
 * Not user-selectable on its own — derived from whether a data overlay is
 * active. See the `basemap` derivation in App.svelte.
 */
export type BasemapKey = 'simple' | 'detailed'

/**
 * Opening view.
 *
 * Deliberately regional rather than the whole globe: at world zoom the hazard
 * feeds put several hundred circles on screen at once, which reads as noise
 * before the viewer knows what any of them mean. Starting zoomed in shows a
 * legible handful and invites zooming out.
 */
export const DEFAULT_VIEW = {
  center: [88, 20] as [number, number],
  zoom: 4,
}

/** Layer ids, shared between the style definition and the visibility toggle. */
export const BASEMAP_LAYERS = {
  background: 'background',
  simpleLand: 'simple-land',
  simpleBorders: 'simple-borders',
  simpleLabels: 'simple-labels',
  detailedBase: 'dark-base',
  detailedLabels: 'dark-labels',
} as const

/**
 * Data overlays are inserted directly before this layer, which keeps every
 * label layer above the data. Anchoring to the *first* label layer matters —
 * anchoring to the last would let weather cover the simple map's country names.
 */
export const OVERLAY_ANCHOR = BASEMAP_LAYERS.simpleLabels

/** Ocean/base colour per option — applied to the style's background layer. */
export const BACKGROUND_COLOR: Record<BasemapKey, string> = {
  simple: '#A8D8E8',
  detailed: '#070B10',
}

/**
 * Classic political-map palette. Countries are coloured by `fid % palette
 * length` rather than by any real attribute — the point is only that
 * neighbours are usually distinguishable, exactly like a printed atlas.
 */
const COUNTRY_PALETTE = [
  '#A8E06B',
  '#E86FB0',
  '#F5A54A',
  '#6FCF97',
  '#B9A5E0',
  '#F7E7A0',
  '#F5A8C8',
  '#7FD4C9',
  '#F59A8A',
  '#C9E06B',
]

/** `["match", fid % n, 0, colour0, 1, colour1, …, fallback]` */
export function countryFillColor(): ExpressionSpecification {
  const cases = COUNTRY_PALETTE.flatMap((color, index) => [index, color])
  return [
    'match',
    ['%', ['get', 'fid'], COUNTRY_PALETTE.length],
    ...cases,
    '#DCDCDC',
  ] as unknown as ExpressionSpecification
}

export const SIMPLE_BORDER_COLOR = '#54798C'
export const SIMPLE_LABEL_COLOR = '#1F3A4A'
export const SIMPLE_LABEL_HALO = 'rgba(255,255,255,0.92)'

/**
 * MapLibre's public demo vector tiles: country polygons, centroids for labels
 * and nothing else, which is exactly the "just water and land with names"
 * look. Keyless and free, but it is a demo service — if this ever needs to be
 * production-grade, swap in a self-hosted PMTiles extract of Natural Earth.
 */
export const SIMPLE_TILES_URL = 'https://demotiles.maplibre.org/tiles/tiles.json'
export const SIMPLE_COUNTRIES_LAYER = 'countries'
export const SIMPLE_CENTROIDS_LAYER = 'centroids'

/** Glyph endpoint that ships with the demo tiles — required for any text layer. */
export const GLYPHS_URL = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'
export const LABEL_FONT = ['Open Sans Semibold']

/**
 * Dark detailed basemap: Esri's World Dark Gray Canvas, split into geography
 * and a labels-only reference layer so weather can sit between them. Keyless
 * and CORS-enabled. (CARTO's free raster tiles were used before, but now stamp
 * "API KEY REQUIRED" across every tile.) Esri's canvas tops out at zoom 16.
 */
export const DARK_ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors'

export const DARK_MAX_ZOOM = 16

const ESRI_CANVAS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas'

export function darkBaseTiles(): string[] {
  return [`${ESRI_CANVAS}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`]
}

export function darkLabelTiles(): string[] {
  return [`${ESRI_CANVAS}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`]
}
