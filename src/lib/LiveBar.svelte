<script lang="ts">
  import { onDestroy } from 'svelte'
  import { eventsStore } from './eventsStore.svelte'
  import { CATEGORY_STYLES, CATEGORY_ORDER } from './categoryStyles'
  import { latestEventTimestamp } from '../types/eonet'
  import type { EonetEvent } from '../types/eonet'
  import { relativeTime } from './time'
  import Icon from './Icon.svelte'

  interface Props {
    onJumpToEvent: (event: EonetEvent) => void
  }

  let { onJumpToEvent }: Props = $props()

  const TICKER_SIZE = 5
  const TICKER_INTERVAL_MS = 4500

  // Per-category counts, in the same stable order as the filter sidebar.
  const categoryCounts = $derived.by(() => {
    const counts = new Map<string, number>()
    for (const event of eventsStore.events) {
      const categoryId = event.categories[0]?.id
      if (!categoryId || !CATEGORY_STYLES[categoryId]) continue
      counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1)
    }
    return CATEGORY_ORDER.map((id) => ({ style: CATEGORY_STYLES[id], count: counts.get(id) ?? 0 }))
      .filter((entry) => entry.count > 0)
  })

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

  let refreshing = $state(false)
  async function handleManualRefresh() {
    refreshing = true
    await eventsStore.refresh(true)
    refreshing = false
  }
</script>

<div
  class="flex items-center gap-4 border-b border-[#E8E0CC] bg-[#FFFDF8] px-4 py-1.5 text-xs text-[#33394A]"
>
  <!-- Live alert ticker -->
  <button
    type="button"
    class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left disabled:cursor-default"
    disabled={!activeTickerEvent}
    onclick={() => activeTickerEvent && onJumpToEvent(activeTickerEvent)}
    title={activeTickerEvent ? 'Jump to this event on the map' : undefined}
  >
    <span class="flex items-center gap-1 text-[#C97064]">
      <span class="relative flex h-1.5 w-1.5">
        <span
          class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C97064] opacity-60"
        ></span>
        <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#C97064]"></span>
      </span>
      <span class="font-semibold tracking-wide uppercase">Live</span>
    </span>

    {#if activeTickerEvent}
      {@const style = categoryStyleOf(activeTickerEvent)}
      <span class="flex min-w-0 items-center gap-1.5 truncate">
        {#if style}
          <span style={`color:${style.color}`} class="shrink-0">
            <Icon name={style.iconName} size={13} />
          </span>
        {/if}
        <span class="truncate hover:underline">{activeTickerEvent.title}</span>
      </span>
    {:else if eventsStore.loading}
      <span class="text-[#8A8473]">Loading recent activity…</span>
    {:else}
      <span class="text-[#8A8473]">No recent events to show.</span>
    {/if}
  </button>

  <!-- Per-category stat chips -->
  {#if categoryCounts.length > 0}
    <div class="hidden items-center gap-3 overflow-x-auto md:flex">
      {#each categoryCounts as entry (entry.style.id)}
        <span class="flex items-center gap-1 whitespace-nowrap" title={entry.style.title}>
          <span style={`color:${entry.style.color}`}><Icon name={entry.style.iconName} size={13} /></span>
          <span class="font-medium">{entry.count}</span>
        </span>
      {/each}
    </div>
  {/if}

  <!-- Refresh status / manual refresh -->
  <div class="flex shrink-0 items-center gap-2 text-[#8A8473]">
    <span class="hidden sm:inline">Updated {relativeTime(eventsStore.lastUpdated)}</span>
    <button
      type="button"
      onclick={handleManualRefresh}
      aria-label="Refresh now"
      title="Refresh now"
      class="rounded p-1 text-[#8A8473] hover:bg-[#FAF6EC] hover:text-[#33394A]"
    >
      <Icon name="refresh" size={13} class={refreshing ? 'animate-spin' : ''} />
    </button>
  </div>
</div>
