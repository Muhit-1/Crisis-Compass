<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import MapView from './lib/MapView.svelte'
  import FilterSidebar from './lib/FilterSidebar.svelte'
  import EventPanel from './lib/EventPanel.svelte'
  import LiveBar from './lib/LiveBar.svelte'
  import TimelineSlider from './lib/TimelineSlider.svelte'
  import Icon from './lib/Icon.svelte'
  import { CATEGORY_STYLES } from './lib/categoryStyles'
  import { eventsStore } from './lib/eventsStore.svelte'
  import { timelineStore } from './lib/timelineStore.svelte'
  import type { EonetEvent } from './types/eonet'

  let activeCategories = $state<Set<string>>(new Set(Object.keys(CATEGORY_STYLES)))
  let selectedEvent = $state<EonetEvent | null>(null)
  let mapView: MapView

  // The map always renders from one merged source: live (auto-refreshing)
  // events normally, or a frozen historical snapshot while the timeline is
  // being scrubbed. The live ticker/stats bar are intentionally NOT affected
  // by this — they always reflect the real-time pulse.
  const displayedEvents = $derived(
    timelineStore.active ? timelineStore.eventsOnSelectedDay : eventsStore.events,
  )
  const isLoading = $derived(timelineStore.active ? timelineStore.loading : eventsStore.loading)
  const loadError = $derived(timelineStore.active ? timelineStore.error : eventsStore.error)

  function retryLoad() {
    if (timelineStore.active) timelineStore.retry()
    else void eventsStore.refresh(true)
  }

  function toggleCategory(id: string) {
    const next = new Set(activeCategories)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    activeCategories = next
  }

  function jumpToEvent(event: EonetEvent) {
    // Jumping from the live ticker should always land on the live map, even
    // if the user had been scrubbing the timeline.
    timelineStore.resetToLive()
    selectedEvent = event
    mapView?.flyTo(event)
  }

  onMount(() => {
    eventsStore.startAutoRefresh()
  })

  onDestroy(() => {
    eventsStore.stopAutoRefresh()
  })
</script>

<div class="flex h-screen w-screen flex-col bg-[#FAF6EC]">
  <header
    class="flex items-center justify-between border-b border-[#E8E0CC] bg-[#FFFDF8] px-4 py-2"
  >
    <h1 class="flex items-center gap-1.5 text-base font-semibold text-[#33394A]">
      <Icon name="compass" size={18} />
      Crisis Compass
    </h1>
    <span class="text-xs text-[#8A8473]">Live natural events — NASA EONET</span>
  </header>

  <LiveBar onJumpToEvent={jumpToEvent} />

  <div class="flex flex-1 overflow-hidden">
    <FilterSidebar active={activeCategories} onToggle={toggleCategory} />

    <main class="relative flex-1">
      <MapView
        bind:this={mapView}
        events={displayedEvents}
        {activeCategories}
        onSelectEvent={(event) => (selectedEvent = event)}
        loading={isLoading}
        error={loadError}
        onRetry={retryLoad}
      />

      {#if selectedEvent}
        <EventPanel event={selectedEvent} onClose={() => (selectedEvent = null)} />
      {/if}
    </main>
  </div>

  <TimelineSlider />
</div>
