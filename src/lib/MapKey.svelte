<script lang="ts">
  import { ALERT_COLORS, QUAKE_COLOR_STOPS } from './hazardStyles'
  import { CATEGORY_STYLES } from './categoryStyles'
  import Icon from './Icon.svelte'

  interface Props {
    showQuakes: boolean
    showAlerts: boolean
    activeCategories: Set<string>
  }

  let { showQuakes, showAlerts, activeCategories }: Props = $props()

  let open = $state(true)

  /**
   * What every mark on the map means.
   *
   * Colour-coded markers are meaningless without this — a first-time viewer
   * has no way to know a red dot is a GDACS red alert rather than "a bad
   * thing". Only layers actually on the map are listed, so the key never
   * explains something that isn't there.
   */
  const ALERT_ROWS: { level: keyof typeof ALERT_COLORS; meaning: string }[] = [
    { level: 'Red', meaning: 'Severe — high impact expected' },
    { level: 'Orange', meaning: 'Moderate impact expected' },
    { level: 'Green', meaning: 'Minor impact expected' },
  ]

  /** Magnitude samples, with the on-map radius they'd actually be drawn at. */
  const QUAKE_ROWS = [
    { mag: 2.5, radius: 3 },
    { mag: 5, radius: 8 },
    { mag: 7, radius: 15 },
  ]

  const activeCategoryStyles = $derived(
    Object.values(CATEGORY_STYLES).filter((c) => activeCategories.has(c.id)),
  )

  const hasAnything = $derived(
    showAlerts || showQuakes || activeCategoryStyles.length > 0,
  )

  function quakeColorFor(mag: number): string {
    let color = QUAKE_COLOR_STOPS[0][1]
    for (const [threshold, value] of QUAKE_COLOR_STOPS) {
      if (mag >= threshold) color = value
    }
    return color
  }
</script>

{#if hasAnything}
  <div class="glass w-60 max-w-[calc(100vw-1.5rem)] rounded-xl">
    <button
      type="button"
      onclick={() => (open = !open)}
      class="flex w-full items-center justify-between px-3 py-2 text-left"
      aria-expanded={open}
    >
      <span class="text-[12px] font-semibold tracking-wider text-muted uppercase">
        Map key
      </span>
      <Icon name={open ? 'chevronDown' : 'chevronUp'} size={13} class="text-muted" />
    </button>

    {#if open}
      <div class="space-y-2.5 px-3 pb-3">
        {#if showAlerts}
          <div>
            <p class="mb-1 text-[12px] font-semibold text-ink">Disaster alerts</p>
            <p class="mb-1.5 text-[11px] text-faint">GDACS official alert level</p>
            {#each ALERT_ROWS as row (row.level)}
              <div class="flex items-center gap-2 py-0.5">
                <span
                  class="h-3 w-3 shrink-0 rounded-full border border-abyss/70"
                  style={`background:${ALERT_COLORS[row.level]}`}
                ></span>
                <span class="w-12 shrink-0 text-[12px] font-medium text-ink">{row.level}</span>
                <span class="min-w-0 flex-1 text-[11px] text-muted">{row.meaning}</span>
              </div>
            {/each}
          </div>
        {/if}

        {#if showQuakes}
          <div class={showAlerts ? 'border-t border-edge/60 pt-2.5' : ''}>
            <p class="mb-1 text-[12px] font-semibold text-ink">Earthquakes</p>
            <p class="mb-1.5 text-[11px] text-faint">USGS · circle size = magnitude</p>
            <div class="flex items-end gap-4 pl-1">
              {#each QUAKE_ROWS as row (row.mag)}
                <div class="flex flex-col items-center gap-1">
                  <span
                    class="rounded-full border border-abyss/70"
                    style={`width:${row.radius * 2}px;height:${row.radius * 2}px;background:${quakeColorFor(row.mag)};opacity:0.75`}
                  ></span>
                  <span class="text-[11px] text-muted tabular-nums">M{row.mag}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if activeCategoryStyles.length}
          <div class={showAlerts || showQuakes ? 'border-t border-edge/60 pt-2.5' : ''}>
            <p class="mb-1 text-[12px] font-semibold text-ink">Natural events</p>
            <p class="mb-1.5 text-[11px] text-faint">NASA EONET</p>
            <div class="flex flex-wrap gap-x-3 gap-y-1">
              {#each activeCategoryStyles as category (category.id)}
                <span class="flex items-center gap-1.5">
                  <span
                    class="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={`background:${category.color}`}
                  ></span>
                  <span class="text-[11px] text-muted">{category.title}</span>
                </span>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}
