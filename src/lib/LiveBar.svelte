<script lang="ts">
  import { onDestroy } from 'svelte'
  import { eventsStore } from './eventsStore.svelte'
  import { CATEGORY_STYLES } from './categoryStyles'
  import { latestEventTimestamp } from '../types/eonet'
  import type { EonetEvent } from '../types/eonet'
  import Icon from './Icon.svelte'

  interface Props {
    onJumpToEvent: (event: EonetEvent) => void
  }

  let { onJumpToEvent }: Props = $props()

  const TICKER_SIZE = 5
  const TICKER_INTERVAL_MS = 4500

  // The N most recently updated open events, newest first.
  const recentEvents = $derived.by(() =>
    [...eventsStore.events]
      .sort((a, b) => latestEventTimestamp(b) - latestEventTimestamp(a))
      .slice(0, TICKER_SIZE),
  )

  let tickerIndex = $state(0)
  let tickerTimer: ReturnType<typeof setInterval> | null = null

  function startTicker() {
    stopTicker()
    tickerTimer = setInterval(() => {
      if (recentEvents.length === 0) return
      tickerIndex = (tickerIndex + 1) % recentEvents.length
    }, TICKER_INTERVAL_MS)
  }

  function stopTicker() {
    if (tickerTimer) {
      clearInterval(tickerTimer)
      tickerTimer = null
    }
  }

  startTicker()
  onDestroy(stopTicker)

  // Keep the ticker index in range if the underlying list shrinks/refreshes.
  $effect(() => {
    if (tickerIndex >= recentEvents.length) tickerIndex = 0
  })

  const activeTickerEvent = $derived(recentEvents[tickerIndex] ?? null)

  function categoryStyleOf(event: EonetEvent) {
    return CATEGORY_STYLES[event.categories[0]?.id ?? ''] ?? null
  }
</script>

<!--
  A single headline, sized to its content. This used to be a full-width bar
  across the top of the map, which spent most of its width on nothing and read
  as a header rather than as an ambient activity feed.
-->
{#if activeTickerEvent}
  {@const style = categoryStyleOf(activeTickerEvent)}
  <button
    type="button"
    class="glass flex max-w-[22rem] items-center gap-2 rounded-full py-1.5 pr-3.5 pl-2.5 text-left"
    onclick={() => onJumpToEvent(activeTickerEvent)}
    title="Jump to this event on the map"
  >
    <span class="flex shrink-0 items-center gap-1.5 text-sev-high">
      <span class="relative flex h-2 w-2">
        <span
          class="absolute inline-flex h-full w-full animate-ping rounded-full bg-sev-high opacity-60"
        ></span>
        <span class="relative inline-flex h-2 w-2 rounded-full bg-sev-high"></span>
      </span>
      <span class="text-[11px] font-bold tracking-widest uppercase">Live</span>
    </span>

    {#if style}
      <span style={`color:${style.color}`} class="shrink-0">
        <Icon name={style.iconName} size={14} />
      </span>
    {/if}
    <span class="truncate text-[13px] text-ink hover:underline">
      {activeTickerEvent.title}
    </span>
  </button>
{/if}
