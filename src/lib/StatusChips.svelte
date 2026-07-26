<script lang="ts">
  import { ALERT_COLORS } from './hazardStyles'
  import { relativeTime } from './time'
  import { eventsStore } from './eventsStore.svelte'
  import Icon from './Icon.svelte'

  interface Props {
    quakeCount: number
    alertCount: number
    eventCount: number
    showQuakes: boolean
    showAlerts: boolean
  }

  let { quakeCount, alertCount, eventCount, showQuakes, showAlerts }: Props = $props()

  /**
   * Counts of what is currently drawn, each with the word for what it counts.
   *
   * These used to be bare icons with numbers — "137" next to a small glyph
   * tells a first-time viewer nothing. Every chip now carries a colour swatch
   * matching its markers plus the noun, so the header and the map agree.
   */
  const chips = $derived(
    [
      showAlerts && { key: 'alerts', label: 'Alerts', count: alertCount, color: ALERT_COLORS.Red },
      showQuakes && { key: 'quakes', label: 'Quakes', count: quakeCount, color: '#FFB443' },
      eventCount > 0 && { key: 'events', label: 'Events', count: eventCount, color: '#4FA8E0' },
    ].filter((c): c is { key: string; label: string; count: number; color: string } => Boolean(c)),
  )

  let refreshing = $state(false)
  async function handleRefresh() {
    refreshing = true
    await eventsStore.refresh(true)
    refreshing = false
  }
</script>

<div class="glass flex items-center gap-2.5 rounded-full py-1.5 pr-1.5 pl-3">
  {#each chips as chip (chip.key)}
    <span class="flex items-center gap-1.5 whitespace-nowrap" title={`${chip.count} ${chip.label}`}>
      <span
        class="h-2.5 w-2.5 shrink-0 rounded-full"
        style={`background:${chip.color}`}
      ></span>
      <span class="text-[13px] font-semibold text-ink tabular-nums">{chip.count}</span>
      <span class="text-[12px] text-muted">{chip.label}</span>
    </span>
  {/each}

  {#if chips.length === 0}
    <span class="text-[12px] whitespace-nowrap text-muted">No layers on</span>
  {/if}

  <span class="hidden text-[12px] whitespace-nowrap text-faint xl:inline">
    {relativeTime(eventsStore.lastUpdated)}
  </span>

  <button
    type="button"
    onclick={handleRefresh}
    aria-label="Refresh now"
    title="Refresh now"
    class="rounded-full p-1.5 text-muted transition-colors hover:bg-panel-2 hover:text-ink"
  >
    <Icon name="refresh" size={14} class={refreshing ? 'animate-spin' : ''} />
  </button>
</div>
