<script lang="ts">
  import { weatherLayer, type WeatherLayerKey } from './weatherLayers'
  import type { BasemapKey } from './basemaps'

  interface Props {
    layer: WeatherLayerKey
    basemap: BasemapKey
  }

  let { layer, basemap }: Props = $props()

  interface Stop {
    /** Position along the bar, 0–1. */
    at: number
    color: string
    label?: string
  }

  let stops = $state<Stop[]>([])
  let unit = $state('')
  let failed = $state(false)

  const def = $derived(weatherLayer(layer))

  const rgba = (c: number[]) =>
    `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${c[3] ?? 1})`

  const tidy = (n: number) =>
    Math.abs(n) >= 100 || Number.isInteger(n) ? String(Math.round(n)) : n.toFixed(1)

  /**
   * Reads the palette straight out of the tile package so the legend can't
   * drift from what the map actually draws. Imported dynamically to preserve
   * the lazy-loading the rest of the weather code relies on — a static import
   * would pull the whole OM reader into the initial bundle.
   */
  async function buildLegend(variable: string, dark: boolean) {
    failed = false
    try {
      const { getColorScale } = await import('@openmeteo/weather-map-layer')
      const scale = getColorScale(variable, dark)
      unit = scale.unit ?? ''

      if (scale.type === 'rgba') {
        const span = scale.max - scale.min
        stops = scale.colors.map((color, i) => {
          const t = scale.colors.length === 1 ? 0 : i / (scale.colors.length - 1)
          return {
            at: t,
            color: rgba(color),
            label: i === 0 || i === scale.colors.length - 1 ? tidy(scale.min + t * span) : undefined,
          }
        })
      } else {
        const points = scale.breakpoints
        const min = points[0]
        const max = points[points.length - 1]
        const span = max - min || 1
        // Label the ends plus a couple inside, so the bar stays readable.
        const labelEvery = Math.max(1, Math.round((points.length - 1) / 4))
        stops = points.map((value, i) => ({
          at: (value - min) / span,
          color: rgba(scale.colors[i] ?? scale.colors[scale.colors.length - 1]),
          label: i % labelEvery === 0 || i === points.length - 1 ? tidy(value) : undefined,
        }))
      }
    } catch {
      failed = true
      stops = []
    }
  }

  $effect(() => {
    void buildLegend(def.variable, basemap === 'detailed')
  })

  const gradient = $derived(
    stops.length
      ? `linear-gradient(to right, ${stops.map((s) => `${s.color} ${(s.at * 100).toFixed(1)}%`).join(', ')})`
      : 'none',
  )

  const labelled = $derived(stops.filter((s) => s.label !== undefined))
</script>

{#if !failed && stops.length}
  <div class="glass w-56 rounded-xl px-2.5 py-2">
    <div class="mb-1 flex items-baseline justify-between gap-2">
      <span class="text-[12px] font-semibold text-ink">{def.label}</span>
      {#if unit}<span class="text-[12px] text-muted">{unit}</span>{/if}
    </div>

    <div class="h-2 w-full rounded-full" style={`background:${gradient}`}></div>

    <div class="relative mt-1 h-3">
      {#each labelled as stop (stop.at)}
        <span
          class="absolute -translate-x-1/2 text-[11px] text-muted tabular-nums"
          style={`left:${Math.min(96, Math.max(4, stop.at * 100))}%`}
        >
          {stop.label}
        </span>
      {/each}
    </div>
  </div>
{/if}
