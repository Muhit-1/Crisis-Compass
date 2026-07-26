<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import MapView from "./lib/MapView.svelte";
  import FilterSidebar from "./lib/FilterSidebar.svelte";
  import EventPanel from "./lib/EventPanel.svelte";
  import LiveBar from "./lib/LiveBar.svelte";
  import TimelineSlider from "./lib/TimelineSlider.svelte";
  import Icon from "./lib/Icon.svelte";
  import { eventsStore } from "./lib/eventsStore.svelte";
  import { timelineStore } from "./lib/timelineStore.svelte";
  import type { EonetEvent } from "./types/eonet";
  import { getCurrentWeather } from "./lib/api/weather";
  import type { WeatherLayerKey } from "./lib/weatherLayers";
  import type { BasemapKey } from "./lib/basemaps";
  import NearMeCard from "./lib/NearMeCard.svelte";
  import WeatherLegend from "./lib/WeatherLegend.svelte";
  import {
    getCurrentPosition,
    haversineKm,
    NEARBY_RADIUS_KM,
    type UserLocation,
  } from "./lib/geo";
  import { isPointGeometry, latestGeometryOf } from "./types/eonet";
  import type { WeatherSnapshot } from "./types/weather";

  // Starts empty on purpose. EONET returns ~7k open events and clustering all
  // of them on first paint is the single slowest thing the app does — the user
  // opts into the categories they actually care about.
  let activeCategories = $state<Set<string>>(new Set());
  let selectedEvent = $state<EonetEvent | null>(null);
  let mapView: MapView;

  // Weather overlay toggle
  let showWeatherOnMap = $state(false);

  // No overlay by default — the plain political map is the resting state.
  let worldWeatherLayer = $state<WeatherLayerKey | null>(null);

  let basemap = $state<BasemapKey>("simple");
  let showIsobars = $state(false);

  function toggleWeatherOnMap() {
    showWeatherOnMap = !showWeatherOnMap;
  }

  let userLocation = $state<UserLocation | null>(null);
  let nearMeStatus = $state<"idle" | "locating" | "error">("idle");
  let nearMeError = $state<string | null>(null);
  let nearMeWeather = $state<WeatherSnapshot | null>(null);
  let nearMeWeatherLoading = $state(false);

  const nearbyCount = $derived.by(() => {
    if (!userLocation) return 0;
    let count = 0;
    for (const event of eventsStore.events) {
      const geom = latestGeometryOf(event);
      if (!geom || !isPointGeometry(geom)) continue;
      const [lng, lat] = geom.coordinates;
      if (
        haversineKm(userLocation.lat, userLocation.lng, lat, lng) <=
        NEARBY_RADIUS_KM
      )
        count++;
    }
    return count;
  });

  async function activateNearMe() {
    nearMeStatus = "locating";
    nearMeError = null;
    try {
      const loc = await getCurrentPosition();
      userLocation = loc;
      nearMeStatus = "idle";
      mapView?.flyToLocation(loc.lat, loc.lng, 5);
      void loadNearMeWeather(loc);
    } catch (err) {
      nearMeStatus = "error";
      nearMeError =
        err instanceof Error
          ? err.message
          : "Could not determine your location.";
    }
  }

  function clearNearMe() {
    userLocation = null;
    nearMeWeather = null;
    nearMeError = null;
    nearMeStatus = "idle";
  }

  async function loadNearMeWeather(loc: UserLocation) {
    nearMeWeatherLoading = true;
    try {
      nearMeWeather = await getCurrentWeather(loc.lat, loc.lng);
    } catch {
      nearMeWeather = null;
    } finally {
      nearMeWeatherLoading = false;
    }
  }

  const displayedEvents = $derived(timelineStore.eventsAtSelectedTime);

  const isLoading = $derived(
    timelineStore.isPast ? timelineStore.loading : eventsStore.loading,
  );

  const loadError = $derived(
    timelineStore.isPast ? timelineStore.error : eventsStore.error,
  );

  function retryLoad() {
    if (timelineStore.isPast) timelineStore.retry();
    else void eventsStore.refresh(true);
  }

  function toggleCategory(id: string) {
    const next = new Set(activeCategories);

    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }

    activeCategories = next;
  }

  function jumpToEvent(event: EonetEvent) {
    // Jumping from the live ticker should always land on the live map
    timelineStore.resetToLive();
    selectedEvent = event;
    mapView?.flyTo(event);
  }

  onMount(() => {
    eventsStore.startAutoRefresh();
    timelineStore.startClock();
  });

  onDestroy(() => {
    eventsStore.stopAutoRefresh();
    timelineStore.stopClock();
  });
</script>

<!--
  Full-bleed shell: the map is the page, and every control floats over it.
  Nothing boxes the map in or steals width from it — that framing is the single
  biggest difference between a dashboard and a weather map.
-->
<div class="relative h-screen w-screen overflow-hidden bg-abyss text-ink">
  <div class="absolute inset-0">
    <MapView
      bind:this={mapView}
      events={displayedEvents}
      {activeCategories}
      onSelectEvent={(event) => (selectedEvent = event)}
      loading={isLoading}
      error={loadError}
      onRetry={retryLoad}
      {showWeatherOnMap}
      {worldWeatherLayer}
      {userLocation}
      {basemap}
      {showIsobars}
      weatherTime={timelineStore.selectedTime}
      runIndex={timelineStore.run}
    />
  </div>

  <!-- Floating top bar: brand · live ticker · location -->
  <header
    class="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-2 p-3"
  >
    <div
      class="glass pointer-events-auto flex shrink-0 items-center gap-2 rounded-full py-2 pr-4 pl-3"
    >
      <Icon name="compass" size={17} class="text-accent" />
      <h1 class="text-sm font-semibold tracking-tight whitespace-nowrap">
        Crisis Compass
      </h1>
    </div>

    <div class="pointer-events-auto hidden min-w-0 flex-1 sm:block">
      <LiveBar onJumpToEvent={jumpToEvent} />
    </div>

    <div class="pointer-events-auto ml-auto flex shrink-0 items-center gap-2">
      {#if nearMeError}
        <span
          class="glass hidden max-w-[16rem] truncate rounded-full px-3 py-1.5 text-[11px] text-sev-high lg:block"
        >
          {nearMeError}
        </span>
      {/if}

      <button
        type="button"
        onclick={userLocation ? clearNearMe : activateNearMe}
        disabled={nearMeStatus === "locating"}
        class="glass flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors hover:text-accent disabled:opacity-50"
      >
        <Icon name="compass" size={14} />
        {nearMeStatus === "locating"
          ? "Locating…"
          : userLocation
            ? "Exit Near Me"
            : "Near Me"}
      </button>
    </div>
  </header>

  <FilterSidebar
    active={activeCategories}
    onToggle={toggleCategory}
    {showWeatherOnMap}
    onToggleWeatherOnMap={toggleWeatherOnMap}
    {worldWeatherLayer}
    onSetWorldWeatherLayer={(key) => (worldWeatherLayer = key)}
    {basemap}
    onSetBasemap={(key) => (basemap = key)}
    {showIsobars}
    onToggleIsobars={() => (showIsobars = !showIsobars)}
  />

  {#if selectedEvent}
    <EventPanel event={selectedEvent} onClose={() => (selectedEvent = null)} />
  {/if}

  <!-- Bottom-left stack, raised clear of the timeline bar. -->
  <div class="absolute bottom-24 left-3 z-30 flex flex-col items-start gap-2">
    {#if userLocation}
      <NearMeCard
        weather={nearMeWeather}
        weatherLoading={nearMeWeatherLoading}
        {nearbyCount}
        onClear={clearNearMe}
      />
    {/if}

    {#if worldWeatherLayer}
      <WeatherLegend layer={worldWeatherLayer} {basemap} />
    {/if}
  </div>

  <TimelineSlider />
</div>
