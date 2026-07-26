import type { ExpressionSpecification } from 'maplibre-gl'

/**
 * Base map options.
 *
 * Both live in a single MapLibre style at once and are switched by toggling
 * layer visibility rather than calling `setStyle`. That matters: `setStyle`
 * tears down every custom source and layer, so event markers, the weather
 * raster and the Near Me ring would all have to be rebuilt on each switch.
 */

export type BasemapKey = 'simple' | 'detailed'

export interface BasemapOption {
  key: BasemapKey
  label: string
  description: string
}

export const BASEMAP_OPTIONS: BasemapOption[] = [
  { key: 'simple', label: 'Simple', description: 'Political map — countries and names' },
  { key: 'detailed', label: 'Detailed', description: 'Dark map with roads and cities' },
]

/** Layer ids, shared between the style definition and the visibility toggle. */
export const BASEMAP_LAYERS = {
  background: 'background',
  simpleLand: 'simple-land',
  simpleBorders: 'simple-borders',
  simpleLabels: 'simple-labels',
  detailedBase: 'carto-base',
  detailedLabels: 'carto-labels',
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

export const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

const CARTO_SUBDOMAINS = ['a', 'b', 'c', 'd']

export function cartoTiles(style: string): string[] {
  return CARTO_SUBDOMAINS.map(
    (s) => `https://${s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}@2x.png`,
  )
}
