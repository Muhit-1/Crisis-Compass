import type { IconName } from './icons'

/**
 * Visual styling per EONET category, matching the muted palette from the project plan.
 * Category ids here are the canonical ids EONET returns (see /api/v3/categories).
 */
export interface CategoryStyle {
  id: string
  title: string
  color: string
  iconName: IconName
}

export const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  wildfires: { id: 'wildfires', title: 'Wildfires', color: '#D98C70', iconName: 'wildfires' },
  floods: { id: 'floods', title: 'Floods', color: '#7FA8C9', iconName: 'floods' },
  volcanoes: { id: 'volcanoes', title: 'Volcanoes', color: '#E0A458', iconName: 'volcanoes' },
  severeStorms: {
    id: 'severeStorms',
    title: 'Severe Storms',
    color: '#A89BC8',
    iconName: 'severeStorms',
  },
  earthquakes: {
    id: 'earthquakes',
    title: 'Earthquakes',
    color: '#A67C5A',
    iconName: 'earthquakes',
  },
  seaLakeIce: {
    id: 'seaLakeIce',
    title: 'Sea & Lake Ice',
    color: '#7FBFB0',
    iconName: 'seaLakeIce',
  },
  drought: { id: 'drought', title: 'Drought', color: '#C9A66B', iconName: 'drought' },
  dustHaze: { id: 'dustHaze', title: 'Dust & Haze', color: '#D9C9A8', iconName: 'dustHaze' },
  landslides: { id: 'landslides', title: 'Landslides', color: '#8C7B6B', iconName: 'landslides' },
  manmade: { id: 'manmade', title: 'Manmade', color: '#9AA0AC', iconName: 'manmade' },
  snow: { id: 'snow', title: 'Snow', color: '#C7D6DE', iconName: 'snow' },
  tempExtremes: {
    id: 'tempExtremes',
    title: 'Temperature Extremes',
    color: '#D88A8A',
    iconName: 'tempExtremes',
  },
  waterColor: { id: 'waterColor', title: 'Water Color', color: '#6FA3A0', iconName: 'waterColor' },
}

export const DEFAULT_CATEGORY_STYLE: CategoryStyle = {
  id: 'default',
  title: 'Other',
  color: '#8A8473',
  iconName: 'other',
}

export function getCategoryStyle(id: string): CategoryStyle {
  return CATEGORY_STYLES[id] ?? DEFAULT_CATEGORY_STYLE
}

/** Stable display order for category chips in the stats bar / sidebar. */
export const CATEGORY_ORDER: string[] = Object.keys(CATEGORY_STYLES)
