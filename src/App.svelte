<script lang="ts">
  import { onMount, onDestroy, untrack } from "svelte";
  import MapView from "./lib/MapView.svelte";
  import FilterSidebar, { type Section } from "./lib/FilterSidebar.svelte";
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
  import ForecastPanel from "./lib/ForecastPanel.svelte";
  import HazardPanel from "./lib/HazardPanel.svelte";
  import MapKey from "./lib/MapKey.svelte";
  import StatusChips from "./lib/StatusChips.svelte";
  import Credit from "./lib/Credit.svelte";
  import { readViewState, writeViewState } from "./lib/urlState";
  import { unitsStore } from "./lib/units.svelte";
  import { hazardsStore } from "./lib/hazardsStore.svelte";
  import type { GdacsAlert, Quake } from "./types/hazards";
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

  // Every detail view shares the same slot on the right, so opening one
  // dismisses the others.
  let forecastPoint = $state<{ lat: number; lng: number } | null>(null);
  let selectedQuake = $state<Quake | null>(null);
  let selectedAlert = $state<GdacsAlert | null>(null);

  function clearPanels() {
    selectedEvent = null;
    forecastPoint = null;
    selectedQuake = null;
    selectedAlert = null;
  }

  function selectEvent(event: EonetEvent) {
    clearPanels();
    selectedEvent = event;
  }

  function selectPoint(point: { lat: number; lng: number }) {
    clearPanels();
    forecastPoint = point;
  }

  function selectQuake(quake: Quake) {
    clearPanels();
    selectedQuake = quake;
  }

  function selectAlert(alert: GdacsAlert) {
    clearPanels();
    selectedAlert = alert;
  }

  /**
   * Both feeds are opt-in and lazy: nothing is requested until the layer is
   * switched on. Earthquakes (~267 kB) and GDACS (~137 kB) are light enough to
   * default on — unlike EONET's unbounded feed, which is what made the app
   * slow — so the map shows something useful on first load.
   */
  let showQuakes = $state(true);
  let showAlerts = $state(true);

  // untrack is load-bearing: start*() synchronously reads the store's own
  // `quakes`/`alerts` state, so without it, the fetch writing those arrays
  // retriggers this effect and the feed polls itself in a tight loop.
  $effect(() => {
    const on = showQuakes;
    untrack(() => (on ? hazardsStore.startQuakes() : hazardsStore.stopQuakes()));
  });

  $effect(() => {
    const on = showAlerts;
    untrack(() => (on ? hazardsStore.startAlerts() : hazardsStore.stopAlerts()));
  });

  const visibleQuakes = $derived(showQuakes ? hazardsStore.quakes : []);
  const visibleAlerts = $derived(showAlerts ? hazardsStore.alerts : []);

  // Weather overlay toggle
  let showWeatherOnMap = $state(false);

  // No overlay by default — the plain political map is the resting state.
  let worldWeatherLayer = $state<WeatherLayerKey | null>(null);
  let showIsobars = $state(false);

  /**
   * The menu flyout and the expanded map key both grow into the same left-hand
   * column, so they take turns rather than stacking on top of each other.
   */
  let openSection = $state<Section | null>(null);
  let mapKeyOpen = $state(true);

  function setSection(section: Section | null) {
    openSection = section;
    if (section) mapKeyOpen = false;
  }

  function toggleMapKey() {
    mapKeyOpen = !mapKeyOpen;
    if (mapKeyOpen) openSection = null;
  }

  /**
   * The base map follows the data rather than being chosen separately.
   *
   * Saturated weather rasters over the pastel political map were unreadable —
   * two bright layers fighting each other. Any data overlay therefore drops
   * the map to the dark base, which is what those palettes are designed for.
   * The political map is the no-overlay resting state.
   */
  const basemap = $derived<BasemapKey>(
    worldWeatherLayer || showIsobars ? "detailed" : "simple",
  );

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

  /** EONET events that survive the category filter — i.e. actually on the map. */
  const visibleEventCount = $derived(
    activeCategories.size === 0
      ? 0
      : displayedEvents.filter((e) =>
          e.categories.some((c) => activeCategories.has(c.id)),
        ).length,
  );

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

  /**
   * Keyboard control of the timeline.
   *
   * Skipped whenever focus is in a form control, so arrow keys still drag the
   * scrubber and space still toggles a checkbox rather than the playback.
   */
  function handleKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        timelineStore.step(event.shiftKey ? -24 : -1);
        break;
      case "ArrowRight":
        event.preventDefault();
        timelineStore.step(event.shiftKey ? 24 : 1);
        break;
      case "n":
      case "N":
        timelineStore.resetToLive();
        break;
      case "Escape":
        clearPanels();
        break;
    }
  }

  /**
   * Mirror the view into the query string so a link reproduces it exactly.
   * Applied once on mount, then written back (replaceState) as things change.
   */
  function applyUrlState() {
    const s = readViewState();
    if (s.layer !== undefined) worldWeatherLayer = s.layer;
    if (s.isobars !== undefined) showIsobars = s.isobars;
    if (s.quakes !== undefined) showQuakes = s.quakes;
    if (s.alerts !== undefined) showAlerts = s.alerts;
    if (s.categories) activeCategories = new Set(s.categories);
    if (s.model) timelineStore.setModel(s.model);
    if (s.temperature) unitsStore.setTemperature(s.temperature);
    if (s.wind) unitsStore.setWind(s.wind);
    if (s.hourOffset !== undefined) pendingHourOffset = s.hourOffset;
    if (s.center) mapView?.jumpTo(s.center, s.zoom);
  }

  /** Held until the run index resolves, since the offset is clamped to it. */
  let pendingHourOffset: number | null = null;

  $effect(() => {
    if (pendingHourOffset === null || !timelineStore.run) return;
    timelineStore.setOffset(pendingHourOffset);
    pendingHourOffset = null;
  });

  onMount(() => {
    eventsStore.startAutoRefresh();
    timelineStore.startClock();
    applyUrlState();
  });

  $effect(() => {
    const state = {
      layer: worldWeatherLayer,
      isobars: showIsobars,
      quakes: showQuakes,
      alerts: showAlerts,
      categories: [...activeCategories],
      hourOffset: timelineStore.hourOffset,
      model: timelineStore.model,
      temperature: unitsStore.temperature,
      wind: unitsStore.wind,
    };
    untrack(() => writeViewState(state));
  });

  onDestroy(() => {
    eventsStore.stopAutoRefresh();
    timelineStore.stopClock();
    hazardsStore.stopAll();
  });
</script>

<svelte:window onkeydown={handleKeydown} />

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
      onSelectEvent={selectEvent}
      onSelectPoint={selectPoint}
      onSelectQuake={selectQuake}
      onSelectAlert={selectAlert}
      quakes={visibleQuakes}
      alerts={visibleAlerts}
      {forecastPoint}
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

  <!-- Floating top bar: brand · what's on the map · location -->
  <header
    class="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start gap-2 p-3"
  >
    <div
      class="glass pointer-events-auto flex shrink-0 items-center gap-2 rounded-full py-2 pr-4 pl-3"
    >
      <Icon name="compass" size={17} class="text-accent" />
      <h1 class="text-sm font-semibold tracking-tight whitespace-nowrap">
        Crisis Compass
      </h1>
    </div>

    <div class="pointer-events-auto ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
      <StatusChips
        quakeCount={visibleQuakes.length}
        alertCount={visibleAlerts.length}
        eventCount={visibleEventCount}
        {showQuakes}
        {showAlerts}
      />
      {#if nearMeError}
        <span
          class="glass hidden max-w-[16rem] truncate rounded-full px-3 py-1.5 text-[12px] text-sev-high lg:block"
        >
          {nearMeError}
        </span>
      {/if}

      <button
        type="button"
        onclick={userLocation ? clearNearMe : activateNearMe}
        disabled={nearMeStatus === "locating"}
        class="glass flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium whitespace-nowrap transition-colors hover:text-accent disabled:opacity-50"
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
    {showIsobars}
    onToggleIsobars={() => (showIsobars = !showIsobars)}
    {showQuakes}
    onToggleQuakes={() => (showQuakes = !showQuakes)}
    {showAlerts}
    onToggleAlerts={() => (showAlerts = !showAlerts)}
    quakeCount={hazardsStore.quakes.length}
    alertCount={hazardsStore.alerts.length}
    quakeError={hazardsStore.quakesError}
    alertError={hazardsStore.alertsError}
    quakesLoading={hazardsStore.quakesLoading}
    alertsLoading={hazardsStore.alertsLoading}
    {openSection}
    onSetSection={setSection}
    model={timelineStore.model}
    onSetModel={(m) => timelineStore.setModel(m)}
  />

  {#if selectedEvent}
    <EventPanel event={selectedEvent} onClose={() => (selectedEvent = null)} />
  {:else if selectedQuake}
    <HazardPanel quake={selectedQuake} onClose={() => (selectedQuake = null)} />
  {:else if selectedAlert}
    <HazardPanel alert={selectedAlert} onClose={() => (selectedAlert = null)} />
  {:else if forecastPoint}
    <ForecastPanel
      lat={forecastPoint.lat}
      lng={forecastPoint.lng}
      selectedTime={timelineStore.selectedTime}
      onClose={() => (forecastPoint = null)}
    />
  {/if}

  <!--
    Bottom-left stack, raised clear of the timeline bar. Legends sit closest to
    the bottom so the key is the last thing between the map and the timeline,
    with the live ticker above it.
  -->
  <div
    class="pointer-events-none absolute bottom-20 left-3 z-30 flex max-h-[calc(100vh-12rem)] flex-col items-start gap-2 overflow-y-auto"
  >
    <div class="pointer-events-auto">
      <LiveBar onJumpToEvent={jumpToEvent} />
    </div>

    {#if userLocation}
      <div class="pointer-events-auto">
        <NearMeCard
          weather={nearMeWeather}
          weatherLoading={nearMeWeatherLoading}
          {nearbyCount}
          onClear={clearNearMe}
        />
      </div>
    {/if}

    {#if worldWeatherLayer}
      <div class="pointer-events-auto">
        <WeatherLegend layer={worldWeatherLayer} {basemap} />
      </div>
    {/if}

    <div class="pointer-events-auto">
      <MapKey
        {showQuakes}
        {showAlerts}
        {activeCategories}
        open={mapKeyOpen}
        onToggle={toggleMapKey}
      />
    </div>
  </div>

  <TimelineSlider />

  <Credit />
</div>
