/**
 * Small hand-drawn line-icon set for Crisis Compass.
 *
 * Each entry is the *inner* markup of a 24x24 viewBox SVG (no outer <svg> tag —
 * that's added by Icon.svelte so size/color/stroke-width stay consistent everywhere).
 * Icons default to stroke="currentColor" so they inherit text color via CSS,
 * matching the muted palette already used for categories.
 */
export type IconName =
  | 'compass'
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
  | 'play'
  | 'pause'
  | 'chevronUp'
  | 'chevronDown'
  | 'skipForward'
  | 'tempExtremes'
  | 'waterColor'
  | 'other'
  | 'close'
  | 'refresh'
  | 'thermometer'
  | 'wind'
  | 'rain'
  | 'sun'
  | 'pulse'
  | 'link'
  | 'humidity'
  | 'satellite'
  | 'radar'
  | 'pressure'
  | 'cloudsLayer'


export const ICONS: Record<IconName, string> = {
  compass: `
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7 14 12 12 17 10 12 Z" fill="currentColor" stroke="none" />
  `,
  wildfires: `
    <path d="M12 21c4 0 6.2-2.6 6.2-6.1 0-2.7-1.7-4.3-2.7-5.8-.4-.6-.7-1.3-.8-2-.6 1-1.1 1.9-1.1 2.9 0 1-.5 1.7-1.2 1.7-.8 0-1.2-.9-1.1-1.9.1-1.4.9-2.5.5-4.1-2.1 1.6-4.9 4.7-4.9 8.3C6.9 18.4 8.6 21 12 21Z" />
  `,
  floods: `
    <path d="M3 9.5c1.4-1.4 2.9-1.4 4.3 0s2.9 1.4 4.3 0 2.9-1.4 4.3 0 2.9 1.4 4.3 0" />
    <path d="M3 14.5c1.4-1.4 2.9-1.4 4.3 0s2.9 1.4 4.3 0 2.9-1.4 4.3 0 2.9 1.4 4.3 0" />
  `,
  volcanoes: `
    <path d="M4 19h16L14 6l-2 3-2-3-6 13Z" />
    <circle cx="14.5" cy="4" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="16.3" cy="3" r="0.6" fill="currentColor" stroke="none" />
  `,
  severeStorms: `
    <path d="M7 15a4 4 0 1 1 .7-7.9A5 5 0 0 1 17 9a3.4 3.4 0 0 1-.5 7H7Z" />
    <path d="M13.2 11 10 16h2.4l-1 4 4-6h-2.4l1-3Z" fill="currentColor" stroke="none" />
  `,
  earthquakes: `
    <path d="M2 13h3.5l2-6 3 12 3-9 1.8 3H22" />
  `,
  seaLakeIce: `
    <path d="M6.5 17 10 8l2.6 5 1.8-2.6L17.5 17Z" />
    <path d="M3 19.5h18" />
  `,
  drought: `
    <circle cx="12" cy="8.5" r="3.4" />
    <path d="M12 2.8v1.4M12 12.3v1.4M6.7 8.5h1.4M16 8.5h1.4M8.3 4.8l1 1M15.7 4.8l-1 1M8.3 12.2l1-1M15.7 12.2l-1-1" />
    <path d="M3.5 19.5l2.3-1.8 1.8 1.8 2.3-2.6 2.3 2.6 1.8-1.8 2.3 2.6 1.8-1.8 2.4 1.6" />
  `,
  dustHaze: `
    <path d="M3 8.5c1.8 0 1.8-1.6 3.6-1.6s1.8 1.6 3.6 1.6 1.8-1.6 3.6-1.6 1.8 1.6 3.6 1.6" />
    <path d="M3 13c1.8 0 1.8-1.6 3.6-1.6S8.4 13 10.2 13s1.8-1.6 3.6-1.6S15.6 13 17.4 13s1.8-1.6 3.6-1.6" />
    <path d="M3 17.5c1.8 0 1.8-1.6 3.6-1.6s1.8 1.6 3.6 1.6 1.8-1.6 3.6-1.6 1.8 1.6 3.6 1.6" />
  `,
  landslides: `
    <path d="M3 19 8 10l2.6 3.4L14 8l7 11Z" />
    <path d="M3.5 21.2h2M7.5 21.2h2M11.5 21.2h2M15.5 21.2h2M19.5 21.2h1.5" />
  `,
  manmade: `
    <path d="M12 4 2.5 20h19L12 4Z" />
    <path d="M12 10.3v4" />
    <circle cx="12" cy="17" r="0.55" fill="currentColor" stroke="none" />
  `,
  snow: `
    <path d="M12 2.5v19M4 6.2l16 11.6M20 6.2 4 17.8" />
    <path d="M12 5.3 10.3 4M12 5.3 13.7 4M12 18.7 10.3 20M12 18.7 13.7 20" />
  `,
  tempExtremes: `
    <path d="M12 3.2a1.9 1.9 0 0 0-1.9 1.9v8.4a3.8 3.8 0 1 0 3.8 0V5.1A1.9 1.9 0 0 0 12 3.2Z" />
    <path d="M12 8.4v5" />
  `,
  waterColor: `
    <path d="M12 3.3s5.8 6.8 5.8 10.7a5.8 5.8 0 1 1-11.6 0c0-3.9 5.8-10.7 5.8-10.7Z" />
  `,
  other: `
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.4a2.4 2.4 0 1 1 3.5 2.2c-.6.4-1.1.9-1.1 1.6v.4M12 16.6v.01" />
  `,
  close: `
    <path d="M6 6 18 18M18 6 6 18" />
  `,
  refresh: `
    <path d="M3.5 12a8.5 8.5 0 0 1 14.2-6.3M20.5 12a8.5 8.5 0 0 1-14.2 6.3" />
    <path d="M16.8 3.6v4.4h-4.4M7.2 20.4V16h4.4" />
  `,
  thermometer: `
    <path d="M12 3.2a1.9 1.9 0 0 0-1.9 1.9v8.4a3.8 3.8 0 1 0 3.8 0V5.1A1.9 1.9 0 0 0 12 3.2Z" />
    <path d="M12 8.4v5" />
  `,
  wind: `
    <path d="M3 8h10.2a2.4 2.4 0 1 0-1.9-3.9" />
    <path d="M3 12.2h14a2.4 2.4 0 1 1-1.9 3.9" />
    <path d="M3 16.4h8.2" />
  `,
  rain: `
    <path d="M7 13.5a4 4 0 1 1 .7-7.9 5 5 0 0 1 9.3 1.9 3.4 3.4 0 0 1-.5 6.8H7Z" />
    <path d="M9 17.5 8 20M13 17.5l-1 2.5M17 17.5l-1 2.5" />
  `,
  sun: `
    <circle cx="12" cy="12" r="3.6" />
    <path d="M12 3.8v1.7M12 18.5v1.7M5.3 12H7M17 12h1.7M7.3 7.3l1.2 1.2M15.5 15.5l1.2 1.2M16.7 7.3l-1.2 1.2M8.5 15.5l-1.2 1.2" />
  `,
  pulse: `
    <path d="M2 12h4l2-5.5 3 11 3-9 1.5 3.5H22" />
  `,
  link: `
    <path d="M9.5 14.5 14.5 9.5" />
    <path d="M11 7.5l1.4-1.4a3.3 3.3 0 1 1 4.7 4.7L15.7 12.2" />
    <path d="M13 16.5l-1.4 1.4a3.3 3.3 0 1 1-4.7-4.7l1.4-1.4" />
  `,
  play: `<path d="M7 4.5v15l13-7.5Z" fill="currentColor" stroke="none" />`,
  pause: `<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />`,
  chevronUp: `<path d="M6 14l6-6 6 6" />`,
  chevronDown: `<path d="M6 10l6 6 6-6" />`,
  skipForward: `<path d="M5 5v14l10-7Z" fill="currentColor" stroke="none" /><rect x="17" y="5" width="2.2" height="14" fill="currentColor" stroke="none" />`,

  humidity: `
  <path d="M12 3.3s5.8 6.8 5.8 10.7a5.8 5.8 0 1 1-11.6 0c0-3.9 5.8-10.7 5.8-10.7Z" />
  <path d="M9.3 13.2a2.7 2.7 0 0 0 2.7 2.7" />
`,

  satellite: `
    <rect x="9" y="10" width="6" height="4" rx="0.6" />
    <rect x="3.5" y="9" width="4" height="6" rx="0.5" transform="rotate(-25 5.5 12)" />
    <rect x="16.5" y="9" width="4" height="6" rx="0.5" transform="rotate(25 18.5 12)" />
    <path d="M12 10V6.5" />
    <circle cx="12" cy="5.5" r="0.6" fill="currentColor" stroke="none" />
  `,
  radar: `
    <path d="M4 20 18 6" />
    <circle cx="4" cy="20" r="1" fill="currentColor" stroke="none" />
    <path d="M7 20a3 3 0 0 0-3-3" />
    <path d="M11 20a7 7 0 0 0-7-7" />
    <path d="M15 20a11 11 0 0 0-11-11" />
  `,
  pressure: `
    <circle cx="12" cy="13" r="7" />
    <path d="M12 13 15 9.5" />
    <path d="M9 7 8 5.5M15 7l1-1.5M12 5.5V4" />
  `,
  cloudsLayer: `
    <path d="M7 17.5a3.6 3.6 0 0 1-.6-7.1 4.6 4.6 0 0 1 8.9-1.7 3.3 3.3 0 0 1 3.7 3.3 3.1 3.1 0 0 1-.6 5.5H7Z" />
  `,
}