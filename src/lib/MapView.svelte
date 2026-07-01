<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import maplibregl from "maplibre-gl";
  // CSS is imported in main.ts — importing it here too causes race conditions
  // with Vite's style injection order in dev mode.

  import { isPointGeometry } from "../types/eonet";
  import {
    haversineKm,
    NEARBY_RADIUS_KM,
    circlePolygon,
    type UserLocation,
  } from "./geo";

  import type { EonetEvent } from "../types/eonet";
  import { getCategoryStyle } from "./categoryStyles";
  import { SEVERITY_COLORS } from "./severity";
  import { ICONS, type IconName } from "./icons";
  import { getCurrentWeather } from "./api/weather";
  import type { WeatherSnapshot } from "../types/weather";

  import {
    ensureOmProtocolRegistered,
    omSourceUrl,
    checkVariableAvailable,
    type WeatherLayerKey,
  } from "./weatherLayers";

  // ---- No top-level side-effects. Protocol is registered inside onMount. ----

  interface Props {
    events: EonetEvent[];
    activeCategories: Set<string>;
    onSelectEvent: (event: EonetEvent) => void;
    loading?: boolean;
    error?: string | null;
    onRetry?: () => void;
    showWeatherOnMap?: boolean;
    worldWeatherLayer?: WeatherLayerKey | null;
    userLocation?: UserLocation | null;
  }
  let {
    events,
    activeCategories,
    onSelectEvent,
    loading = false,
    error = null,
    onRetry,
    showWeatherOnMap = false,
    worldWeatherLayer = null,
    userLocation = null,
  }: Props = $props();

  // ---- Layer / source ids -----------------------------------------------
  const EVENTS_SOURCE = "events";
  const CLUSTERS_LAYER = "clusters";
  const POINTS_HALO_LAYER = "unclustered-point-halo";
  const POINTS_LAYER = "unclustered-point";
  const NEARME_SOURCE = "near-me-circle";
  const NEARME_FILL_LAYER = "near-me-circle-fill";
  const NEARME_LINE_LAYER = "near-me-circle-line";
  const WEATHER_SOURCE = "weather-raster";
  const WEATHER_LAYER = "weather-raster-layer";

  let mapContainer: HTMLDivElement;
  let map: maplibregl.Map | null = null;
  let mapLoaded = $state(false);
  let resizeObserver: ResizeObserver | null = null;

  let eventCount = $state(0);
  let weatherLayerError = $state<string | null>(null);

  let eventById = new Map<string, EonetEvent>();
  let hoverPopup: maplibregl.Popup | null = null;
  let clusterLabelMarkers = new Map<number, maplibregl.Marker>();
  let pulseRaf: number | null = null;

  // =========================
  // Helpers
  // =========================

  function escapeHtml(value: string): string {
    return value.replace(
      /[&<>"']/g,
      (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c),
    );
  }

  function tooltipIconSvg(color: string, iconKey: IconName): string {
    return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px">${ICONS[iconKey]}</svg>`;
  }

  function tooltipBaseHtml(event: EonetEvent): string {
    const style = getCategoryStyle(event.categories[0]?.id ?? "");
    const categoryNames = event.categories.map((c) => c.title).join(", ");
    return (
      `<div style="display:flex;align-items:center;gap:4px;font-weight:600;color:#33394A;font-size:12px">` +
      `${tooltipIconSvg(style.color, style.iconName)} ${escapeHtml(event.title)}</div>` +
      `<div style="color:#8A8473;font-size:11px">${escapeHtml(categoryNames)}</div>`
    );
  }

  function formatWeatherLine(w: WeatherSnapshot): string {
    const chance =
      w.precipChancePct !== null ? `${w.precipChancePct}% rain` : "—";
    return (
      `<div style="margin-top:2px;display:flex;gap:6px;flex-wrap:wrap;color:#33394A;font-size:11px">` +
      `<span>${Math.round(w.temperatureC)}°C (feels ${Math.round(w.feelsLikeC)}°)</span>` +
      `<span>${Math.round(w.windSpeedKph)} km/h</span>` +
      `<span>${w.humidityPct}% hum</span>` +
      `<span>${chance}</span></div>`
    );
  }

  // =========================
  // GeoJSON + markers
  // =========================

  function buildGeoJson(): GeoJSON.FeatureCollection<GeoJSON.Point> {
    const features: GeoJSON.Feature<GeoJSON.Point>[] = [];

    for (const event of events) {
      const matchesFilter = event.categories.some((c) =>
        activeCategories.has(c.id),
      );
      if (!matchesFilter) continue;

      const latestGeometry = event.geometry[event.geometry.length - 1];
      if (!latestGeometry || !isPointGeometry(latestGeometry)) continue;

      const [lng, lat] = latestGeometry.coordinates;
      const inRange =
        !userLocation ||
        haversineKm(userLocation.lat, userLocation.lng, lat, lng) <=
          NEARBY_RADIUS_KM;

      const style = getCategoryStyle(event.categories[0]?.id ?? "");
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: {
          id: event.id,
          color: style.color,
          markerOpacity: inRange ? 1 : 0.25,
        },
      });
    }

    return { type: "FeatureCollection", features };
  }

  function renderMarkers() {
    if (!map || !mapLoaded) return;
    const source = map.getSource(EVENTS_SOURCE) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (!source) return;

    const data = buildGeoJson();
    source.setData(data);
    eventCount = data.features.length;
  }

  function syncClusterLabels() {
    if (!map || !map.getLayer(CLUSTERS_LAYER)) return;

    const features = map.querySourceFeatures(EVENTS_SOURCE, {
      filter: ["has", "point_count"],
    });
    const seen = new Set<number>();

    for (const feature of features) {
      const clusterId = feature.properties?.cluster_id as number | undefined;
      const count = feature.properties?.point_count as number | undefined;
      if (
        clusterId == null ||
        count == null ||
        feature.geometry.type !== "Point"
      )
        continue;

      seen.add(clusterId);
      const [lng, lat] = feature.geometry.coordinates as [number, number];

      let marker = clusterLabelMarkers.get(clusterId);
      if (!marker) {
        const el = document.createElement("div");
        el.className = "cluster-count-label";
        marker = new maplibregl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(map!);
        clusterLabelMarkers.set(clusterId, marker);
      } else {
        marker.setLngLat([lng, lat]);
      }
      marker.getElement().textContent = String(count);
    }

    for (const [id, marker] of clusterLabelMarkers) {
      if (!seen.has(id)) {
        marker.remove();
        clusterLabelMarkers.delete(id);
      }
    }
  }

  // =========================
  // Pulse animation (rAF loop)
  // =========================

  function startPulseAnimation() {
    const start = performance.now();
    const PERIOD_MS = 2200;

    function tick() {
      if (!map || !map.getLayer(POINTS_HALO_LAYER)) return;
      const t = ((performance.now() - start) / PERIOD_MS) % 1;
      map.setPaintProperty(POINTS_HALO_LAYER, "circle-radius", 9 + t * 14);
      map.setPaintProperty(
        POINTS_HALO_LAYER,
        "circle-opacity",
        0.45 * (1 - t),
      );
      pulseRaf = requestAnimationFrame(tick);
    }
    pulseRaf = requestAnimationFrame(tick);
  }

  function stopPulseAnimation() {
    if (pulseRaf != null) {
      cancelAnimationFrame(pulseRaf);
      pulseRaf = null;
    }
  }

  // =========================
  // Interaction handlers
  // =========================

  function attachInteractionHandlers() {
    if (!map) return;

    for (const layerId of [CLUSTERS_LAYER, POINTS_LAYER]) {
      map.on("mouseenter", layerId, () => {
        if (map) map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layerId, () => {
        if (map) map.getCanvas().style.cursor = "";
      });
    }

    // Click cluster → zoom in
    map.on("click", CLUSTERS_LAYER, (e) => {
      if (!map) return;
      const feature = map.queryRenderedFeatures(e.point, {
        layers: [CLUSTERS_LAYER],
      })[0];
      if (!feature || feature.geometry.type !== "Point") return;

      const clusterId = feature.properties?.cluster_id as number | undefined;
      if (clusterId == null) return;

      const source = map.getSource(EVENTS_SOURCE) as maplibregl.GeoJSONSource;
      const coords = feature.geometry.coordinates as [number, number];

      source
        .getClusterExpansionZoom(clusterId)
        .then((zoom: number) => {
          if (!map) return;
          map.easeTo({ center: coords, zoom });
        })
        .catch(() => {
          // cluster id stale after source refresh — harmless
        });
    });

    // Click point → open event panel
    map.on("click", POINTS_LAYER, (e) => {
      const feature = e.features?.[0];
      const id = feature?.properties?.id as string | undefined;
      if (!id) return;
      const event = eventById.get(id);
      if (event) onSelectEvent(event);
    });

    // Hover tooltip
    map.on("mouseenter", POINTS_LAYER, (e) => {
      if (!map) return;
      const feature = e.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;

      const id = feature.properties?.id as string | undefined;
      const event = id ? eventById.get(id) : undefined;
      if (!event) return;

      const coords = feature.geometry.coordinates as [number, number];
      const baseHtml = tooltipBaseHtml(event);

      hoverPopup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 10,
      })
        .setLngLat(coords)
        .setHTML(
          showWeatherOnMap
            ? baseHtml +
                `<div style="margin-top:2px;color:#8A8473;font-size:11px">Loading weather…</div>`
            : baseHtml,
        )
        .addTo(map);

      if (showWeatherOnMap) {
        const [lng, lat] = coords;
        getCurrentWeather(lat, lng)
          .then((w: WeatherSnapshot) =>
            hoverPopup?.setHTML(baseHtml + formatWeatherLine(w)),
          )
          .catch(() =>
            hoverPopup?.setHTML(
              baseHtml +
                `<div style="margin-top:2px;color:#C97064;font-size:11px">Weather unavailable</div>`,
            ),
          );
      }
    });

    map.on("mouseleave", POINTS_LAYER, () => {
      hoverPopup?.remove();
      hoverPopup = null;
    });

    map.on("sourcedata", (e) => {
      if (e.sourceId === EVENTS_SOURCE) syncClusterLabels();
    });
    map.on("moveend", syncClusterLabels);
  }

  // =========================
  // Near Me radius ring
  // =========================

  function removeNearMeCircle() {
    if (!map) return;
    if (map.getLayer(NEARME_FILL_LAYER)) map.removeLayer(NEARME_FILL_LAYER);
    if (map.getLayer(NEARME_LINE_LAYER)) map.removeLayer(NEARME_LINE_LAYER);
    if (map.getSource(NEARME_SOURCE)) map.removeSource(NEARME_SOURCE);
  }

  function renderNearMeCircle() {
    if (!map || !mapLoaded) return;
    removeNearMeCircle();
    if (!userLocation) return;

    const polygon = circlePolygon(userLocation, NEARBY_RADIUS_KM, 64);
    map.addSource(NEARME_SOURCE, { type: "geojson", data: polygon });
    map.addLayer({
      id: NEARME_FILL_LAYER,
      type: "fill",
      source: NEARME_SOURCE,
      paint: { "fill-color": "#7FA8C9", "fill-opacity": 0.06 },
    });
    map.addLayer({
      id: NEARME_LINE_LAYER,
      type: "line",
      source: NEARME_SOURCE,
      paint: { "line-color": "#7FA8C9", "line-width": 1.5 },
    });
  }

  // =========================
  // Weather raster overlay
  // =========================

  function removeWeatherLayer() {
    if (!map) return;
    if (map.getLayer(WEATHER_LAYER)) map.removeLayer(WEATHER_LAYER);
    if (map.getSource(WEATHER_SOURCE)) map.removeSource(WEATHER_SOURCE);
  }

  function renderWeatherLayer() {
    if (!map || !mapLoaded) return;

    removeWeatherLayer();
    weatherLayerError = null;

    const layer = worldWeatherLayer;
    if (!layer) return;

    let cancelled = false;

    checkVariableAvailable(layer)
      .then(() => {
        if (cancelled || !map || worldWeatherLayer !== layer) return;
        map.addSource(WEATHER_SOURCE, {
          type: "raster",
          url: omSourceUrl(layer),
          tileSize: 256,
          maxzoom: 12,
          attribution: "Weather &copy; Open-Meteo (DWD ICON)",
        });
        // Insert below cluster/marker layers so events stay on top
        map.addLayer(
          {
            id: WEATHER_LAYER,
            type: "raster",
            source: WEATHER_SOURCE,
            paint: { "raster-opacity": 0.65 },
          },
          CLUSTERS_LAYER,
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        weatherLayerError =
          err instanceof Error ? err.message : "Couldn't load weather layer";
      });

    return () => {
      cancelled = true;
    };
  }

  // =========================
  // Public API (used by App.svelte)
  // =========================

  export function flyTo(event: EonetEvent): void {
    if (!map) return;
    const latestGeometry = event.geometry[event.geometry.length - 1];
    if (!latestGeometry || !isPointGeometry(latestGeometry)) return;
    const [lng, lat] = latestGeometry.coordinates;
    map.flyTo({
      center: [lng, lat],
      zoom: Math.max(map.getZoom(), 4),
      duration: 1000,
    });
  }

  export function flyToLocation(lat: number, lng: number, zoom: number): void {
    if (!map) return;
    map.flyTo({ center: [lng, lat], zoom, duration: 1000 });
  }

  // =========================
  // Lifecycle
  // =========================

  onMount(() => {
    // Step 1 — register om:// protocol BEFORE creating the map so it's
    // available as soon as we add the weather source.  Any error here is
    // non-fatal: the base map still loads, only the weather overlay fails.
    ensureOmProtocolRegistered().catch((err: unknown) => {
      console.warn("Open-Meteo weather overlay unavailable:", err);
    });

    // Step 2 — build the MapLibre map with an inline style.
    // We include an explicit "background" layer so the canvas renders
    // our cream color instead of MapLibre's default blue while OSM
    // tiles are fetching — makes the loading state look intentional.
    map = new maplibregl.Map({
      container: mapContainer,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            // Single canonical OSM URL — subdomain rotation isn't needed
            // in dev and can cause tile-server policy rejections.
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap contributors",
            maxzoom: 19,
          },
        },
        layers: [
          // Cream background so empty areas match the app's palette
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#FAF6EC" },
          },
          // OSM raster tiles
          {
            id: "osm-tiles",
            type: "raster",
            source: "osm",
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [0, 20],
      zoom: 2,
      minZoom: 1,
      maxBounds: [
        [-180, -85],
        [180, 85],
      ],
      renderWorldCopies: false,
      // Disable the built-in attribution widget (we add it manually below
      // so we can keep it compact without relying on the constructor option,
      // which changed signature between MapLibre v3 and v4).
      attributionControl: false,
    });

    // Surface any MapLibre-internal errors to the console so we can see
    // tile fetch failures, style parse errors, etc. in dev tools.
    map.on("error", (e) => {
      console.error("[MapLibre error]", e.error?.message ?? e);
    });

    // Re-add attribution as a properly typed control
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );

    map.on("load", () => {
      if (!map) return;

      // Events source — native MapLibre clustering
      map.addSource(EVENTS_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 14,
      });

      // Cluster bubbles — colored by size tier matching severity palette
      map.addLayer({
        id: CLUSTERS_LAYER,
        type: "circle",
        source: EVENTS_SOURCE,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            SEVERITY_COLORS.low,
            10,
            SEVERITY_COLORS.medium,
            50,
            SEVERITY_COLORS.high,
          ],
          "circle-radius": [
            "step",
            ["get", "point_count"],
            16,
            10,
            20,
            50,
            26,
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#FFFDF8",
        },
      });

      // Pulsing halo — radius + opacity driven by rAF loop below
      map.addLayer({
        id: POINTS_HALO_LAYER,
        type: "circle",
        source: EVENTS_SOURCE,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["get", "color"],
          "circle-opacity": 0.45,
          "circle-radius": 9,
        },
      });

      // Individual event dot
      map.addLayer({
        id: POINTS_LAYER,
        type: "circle",
        source: EVENTS_SOURCE,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["get", "color"],
          "circle-opacity": ["get", "markerOpacity"],
          "circle-radius": 7,
          "circle-stroke-width": 2,
          "circle-stroke-color": "rgba(255,255,255,0.9)",
        },
      });

      mapLoaded = true;
      renderMarkers();
      renderNearMeCircle();
      renderWeatherLayer();
      startPulseAnimation();
      attachInteractionHandlers();
    });

    resizeObserver = new ResizeObserver(() => {
      if (!map) return;
      map.resize();
    });
    resizeObserver.observe(mapContainer);
  });

  onDestroy(() => {
    stopPulseAnimation();
    resizeObserver?.disconnect();
    hoverPopup?.remove();
    for (const marker of clusterLabelMarkers.values()) marker.remove();
    map?.remove();
  });

  $effect(() => {
    eventById = new Map(events.map((e) => [e.id, e]));
  });

  $effect(() => {
    events;
    activeCategories;
    userLocation;
    renderMarkers();
  });

  $effect(() => {
    userLocation;
    renderNearMeCircle();
  });

  $effect(() => {
    worldWeatherLayer;
    return renderWeatherLayer();
  });
</script>

<div class="relative h-full w-full">
  <div bind:this={mapContainer} class="h-full w-full"></div>

  <div class="absolute top-4 left-4 z-[1000] flex flex-col items-start gap-2">
    {#if error}
      <div
        class="flex max-w-xs flex-col gap-2 rounded-md bg-[#FFFDF8]/95 px-3 py-2 text-sm text-[#C97064] shadow"
      >
        <span>Couldn't load events: {error}</span>
        {#if onRetry}
          <button
            type="button"
            onclick={onRetry}
            class="self-start rounded border border-[#C97064] px-2 py-1 text-xs font-medium text-[#C97064] hover:bg-[#C97064] hover:text-white"
          >
            Retry
          </button>
        {/if}
      </div>
    {/if}

    {#if weatherLayerError}
      <div
        class="max-w-xs rounded-md bg-[#FFFDF8]/95 px-3 py-2 text-xs text-[#C97064] shadow"
      >
        Weather layer: {weatherLayerError}
      </div>
    {/if}

    {#if !loading && !error}
      <div
        class="rounded-md bg-[#FFFDF8]/95 px-3 py-2 text-sm text-[#33394A] shadow"
      >
        {eventCount} event{eventCount === 1 ? "" : "s"} shown
      </div>
    {/if}
  </div>
</div>

<style>
  :global(.cluster-count-label) {
    color: #33394a;
    font-size: 11px;
    font-weight: 700;
    font-family: inherit;
    pointer-events: none;
  }

  :global(.maplibregl-popup-content) {
    background: #fffdf8;
    border-radius: 8px;
    padding: 8px 10px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
    font-family: inherit;
  }

  :global(.maplibregl-popup-tip) {
    border-top-color: #fffdf8 !important;
  }

  :global(.maplibregl-ctrl-attrib) {
    font-size: 10px;
  }
</style>