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
  import { getCurrentWeather } from './lib/api/weather'

  let activeCategories = $state<Set<string>>(new Set(Object.keys(CATEGORY_STYLES)))
  let selectedEvent = $state<EonetEvent | null>(null)
  let mapView: MapView

  // Weather overlay toggle
  let showWeatherOnMap = $state(false)

  function toggleWeatherOnMap() {
    showWeatherOnMap = !showWeatherOnMap
  }

  // TEMP: API connectivity check — delete this whole block when done
  let weatherStatus = $state<'checking' | 'ok' | 'error'>('checking')

  const eonetStatus = $derived(
    eventsStore.error
      ? 'error'
      : eventsStore.loading && eventsStore.events.length === 0
        ? 'checking'
        : 'ok',
  )
  // END TEMP

  const displayedEvents = $derived(
    timelineStore.active
      ? timelineStore.eventsOnSelectedDay
      : eventsStore.events,
  )

  const isLoading = $derived(
    timelineStore.active
      ? timelineStore.loading
      : eventsStore.loading,
  )

  const loadError = $derived(
    timelineStore.active
      ? timelineStore.error
      : eventsStore.error,
  )

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
    // Jumping from the live ticker should always land on the live map
    timelineStore.resetToLive()
    selectedEvent = event
    mapView?.flyTo(event)
  }

  onMount(() => {
    eventsStore.startAutoRefresh()

    // TEMP: remove this block
    getCurrentWeather(20, 0)
      .then(() => (weatherStatus = 'ok'))
      .catch(() => (weatherStatus = 'error'))
    // END TEMP
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

    <!-- TEMP: API connection status — delete this div when done -->
    <div class="flex items-center gap-2 text-[11px] font-medium">
      <span
        class={`rounded-full px-2 py-0.5 ${
          eonetStatus === 'ok'
            ? 'bg-[#8FBF8F]/20 text-[#4f7a4f]'
            : eonetStatus === 'error'
              ? 'bg-[#C97064]/20 text-[#C97064]'
              : 'bg-[#E0A458]/20 text-[#8a662f]'
        }`}
      >
        EONET
        {eonetStatus === 'ok'
          ? ' ✓ connected'
          : eonetStatus === 'error'
            ? ' ✗ failed'
            : ' … checking'}
      </span>

      <span
        class={`rounded-full px-2 py-0.5 ${
          weatherStatus === 'ok'
            ? 'bg-[#8FBF8F]/20 text-[#4f7a4f]'
            : weatherStatus === 'error'
              ? 'bg-[#C97064]/20 text-[#C97064]'
              : 'bg-[#E0A458]/20 text-[#8a662f]'
        }`}
      >
        Open-Meteo
        {weatherStatus === 'ok'
          ? ' ✓ connected'
          : weatherStatus === 'error'
            ? ' ✗ failed'
            : ' … checking'}
      </span>
    </div>
    <!-- END TEMP -->

    <span class="text-xs text-[#8A8473]">
      Live natural events — NASA EONET
    </span>
  </header>

  <LiveBar onJumpToEvent={jumpToEvent} />

  <div class="flex flex-1 overflow-hidden">
    <FilterSidebar
      active={activeCategories}
      onToggle={toggleCategory}
      {showWeatherOnMap}
      onToggleWeatherOnMap={toggleWeatherOnMap}
    />

    <main class="relative flex-1">
      <MapView
        bind:this={mapView}
        events={displayedEvents}
        {activeCategories}
        onSelectEvent={(event) => (selectedEvent = event)}
        loading={isLoading}
        error={loadError}
        onRetry={retryLoad}
        {showWeatherOnMap}
      />

      {#if selectedEvent}
        <EventPanel
          event={selectedEvent}
          onClose={() => (selectedEvent = null)}
        />
      {/if}
    </main>
  </div>

  <TimelineSlider />
</div>