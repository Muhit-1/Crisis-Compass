import type { IconName } from './icons'

/**
 * Visual styling per EONET category.
 *
 * Colors are tuned for the dark map shell: the old cream-background palette was
 * a set of low-contrast pastels that disappeared against a dark basemap. Hues
 * are unchanged so categories stay recognisable — only luminance and saturation
 * were raised. Category ids are the canonical ids EONET returns
 * (see /api/v3/categories).
 */
export interface CategoryStyle {
  id: string
  title: string
  color: string
  iconName: IconName
}

export const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  wildfires: { id: 'wildfires', title: 'Wildfires', color: '#FF7A45', iconName: 'wildfires' },
  floods: { id: 'floods', title: 'Floods', color: '#4DA3FF', iconName: 'floods' },
  volcanoes: { id: 'volcanoes', title: 'Volcanoes', color: '#FFAE3D', iconName: 'volcanoes' },
  severeStorms: {
    id: 'severeStorms',
    title: 'Severe Storms',
    color: '#B39DFF',
    iconName: 'severeStorms',
  },
  earthquakes: {
    id: 'earthquakes',
    title: 'Earthquakes',
    color: '#D08B4F',
    iconName: 'earthquakes',
  },
  seaLakeIce: {
    id: 'seaLakeIce',
    title: 'Sea & Lake Ice',
    color: '#5FE3C8',
    iconName: 'seaLakeIce',
  },
  drought: { id: 'drought', title: 'Drought', color: '#E0C060', iconName: 'drought' },
  dustHaze: { id: 'dustHaze', title: 'Dust & Haze', color: '#D9C48A', iconName: 'dustHaze' },
  landslides: { id: 'landslides', title: 'Landslides', color: '#B08968', iconName: 'landslides' },
  manmade: { id: 'manmade', title: 'Manmade', color: '#A8B4C4', iconName: 'manmade' },
  snow: { id: 'snow', title: 'Snow', color: '#D8E8F2', iconName: 'snow' },
  tempExtremes: {
    id: 'tempExtremes',
    title: 'Temperature Extremes',
    color: '#FF6B6B',
    iconName: 'tempExtremes',
  },
  waterColor: { id: 'waterColor', title: 'Water Color', color: '#4FD1C5', iconName: 'waterColor' },
}

export const DEFAULT_CATEGORY_STYLE: CategoryStyle = {
  id: 'default',
  title: 'Other',
  color: '#94A3B3',
  iconName: 'other',
}

export function getCategoryStyle(id: string): CategoryStyle {
  return CATEGORY_STYLES[id] ?? DEFAULT_CATEGORY_STYLE
}

/** Stable display order for category chips in the stats bar / sidebar. */
export const CATEGORY_ORDER: string[] = Object.keys(CATEGORY_STYLES)
