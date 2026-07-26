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
    hasVariable,
    ISOBAR_VARIABLE,
    missingVariableMessage,
    omArrowsUrl,
    omIsobarUrl,
    omRasterUrl,
    weatherLayer,
    WEATHER_ATTRIBUTION,
    type RunIndex,
    type WeatherLayerKey,
  } from "./weatherLayers";
  import {
    BACKGROUND_COLOR,
    BASEMAP_LAYERS,
    CARTO_ATTRIBUTION,
    cartoTiles,
    countryFillColor,
    GLYPHS_URL,
    LABEL_FONT,
    OVERLAY_ANCHOR,
    SIMPLE_BORDER_COLOR,
    SIMPLE_CENTROIDS_LAYER,
    SIMPLE_COUNTRIES_LAYER,
    SIMPLE_LABEL_COLOR,
    SIMPLE_LABEL_HALO,
    SIMPLE_TILES_URL,
    type BasemapKey,
  } from "./basemaps";

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
    /** Hour the weather overlay should show, from the master clock. */
    weatherTime: Date;
    /** Model-run metadata; weather layers can't resolve a URL without it. */
    runIndex?: RunIndex | null;
    basemap?: BasemapKey;
    /** Mean sea-level pressure isolines, independent of the colour layer. */
    showIsobars?: boolean;
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
    weatherTime,
    runIndex = null,
    basemap = "simple",
    showIsobars = false,
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
  const ARROWS_SOURCE = "weather-arrows";
  const ARROWS_LAYER = "weather-arrows-layer";
  const ISOBAR_SOURCE = "weather-isobars";
  const ISOBAR_LAYER = "weather-isobars-layer";
  const ISOBAR_LABEL_LAYER = "weather-isobars-label";

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
      `<div style="display:flex;align-items:center;gap:4px;font-weight:600;color:#E8EEF4;font-size:12px">` +
      `${tooltipIconSvg(style.color, style.iconName)} ${escapeHtml(event.title)}</div>` +
      `<div style="color:#8595A5;font-size:11px">${escapeHtml(categoryNames)}</div>`
    );
  }

  function formatWeatherLine(w: WeatherSnapshot): string {
    const chance =
      w.precipChancePct !== null ? `${w.precipChancePct}% rain` : "—";
    return (
      `<div style="margin-top:2px;display:flex;gap:6px;flex-wrap:wrap;color:#E8EEF4;font-size:11px">` +
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
                `<div style="margin-top:2px;color:#8595A5;font-size:11px">Loading weather…</div>`
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
                `<div style="margin-top:2px;color:#FF6A5A;font-size:11px">Weather unavailable</div>`,
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
      paint: { "fill-color": "#4FA8E0", "fill-opacity": 0.06 },
    });
    map.addLayer({
      id: NEARME_LINE_LAYER,
      type: "line",
      source: NEARME_SOURCE,
      paint: { "line-color": "#4FA8E0", "line-width": 1.5 },
    });
  }

  // =========================
  // Weather overlays (colour field, arrows, isobars)
  // =========================

  // URLs currently applied to each overlay source. Tracked so a time change
  // can be pushed with setUrl instead of a remove/add cycle, and so redundant
  // refetches are skipped when several effects settle on the same frame.
  let appliedUrls: Record<string, string | null> = {
    [WEATHER_SOURCE]: null,
    [ARROWS_SOURCE]: null,
    [ISOBAR_SOURCE]: null,
  };

  function removeOverlay(sourceId: string, ...layerIds: string[]) {
    if (!map) return;
    for (const id of layerIds) if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
    appliedUrls[sourceId] = null;
  }

  /**
   * Re-assert overlay draw order.
   *
   * Each overlay is added and removed independently, so insertion order alone
   * can't guarantee the stack — re-adding the raster after the isobars exist
   * would bury them. Moving each present overlay in front of the anchor, in a
   * fixed sequence, makes the result deterministic regardless of history.
   */
  function restackOverlays() {
    if (!map) return;
    for (const id of [WEATHER_LAYER, ARROWS_LAYER, ISOBAR_LAYER, ISOBAR_LABEL_LAYER]) {
      if (map.getLayer(id)) map.moveLayer(id, OVERLAY_ANCHOR);
    }
  }

  /** Full rebuild — needed when the layer, model run, or palette changes. */
  function renderWeatherLayer() {
    if (!map || !mapLoaded) return;

    removeOverlay(WEATHER_SOURCE, WEATHER_LAYER);
    removeOverlay(ARROWS_SOURCE, ARROWS_LAYER);
    weatherLayerError = null;

    const key = worldWeatherLayer;
    if (!key || !runIndex) return;

    const def = weatherLayer(key);
    if (!hasVariable(runIndex, def.variable)) {
      weatherLayerError = missingVariableMessage(def.variable);
      return;
    }

    // Dark palettes are tuned for a dark ground — pick to match the basemap.
    const url = omRasterUrl(key, weatherTime, runIndex, {
      dark: basemap === "detailed",
    });

    map.addSource(WEATHER_SOURCE, {
      type: "raster",
      url,
      tileSize: 256,
      maxzoom: 12,
      attribution: WEATHER_ATTRIBUTION,
    });
    map.addLayer(
      {
        id: WEATHER_LAYER,
        type: "raster",
        source: WEATHER_SOURCE,
        // Kept well below 1 so the basemap still reads through the data —
        // coastlines and borders are what make the overlay locatable.
        paint: { "raster-opacity": 0.62 },
      },
      OVERLAY_ANCHOR,
    );
    appliedUrls[WEATHER_SOURCE] = url;

    // Direction arrows, where the variable resolves to a bearing.
    if (def.hasDirection) {
      const arrowsUrl = omArrowsUrl(key, weatherTime, runIndex);
      map.addSource(ARROWS_SOURCE, { type: "vector", url: arrowsUrl });
      map.addLayer(
        {
          id: ARROWS_LAYER,
          type: "line",
          source: ARROWS_SOURCE,
          "source-layer": "arrows",
          paint: {
            "line-color": basemap === "detailed" ? "#E8EEF4" : "#1F3A4A",
            "line-width": 1,
            "line-opacity": 0.55,
          },
        },
        OVERLAY_ANCHOR,
      );
      appliedUrls[ARROWS_SOURCE] = arrowsUrl;
    }

    restackOverlays();
  }

  function renderIsobars() {
    if (!map || !mapLoaded) return;

    removeOverlay(ISOBAR_SOURCE, ISOBAR_LAYER, ISOBAR_LABEL_LAYER);

    if (!showIsobars || !runIndex) return;
    if (!hasVariable(runIndex, ISOBAR_VARIABLE)) return;

    const url = omIsobarUrl(weatherTime, runIndex);
    const stroke = basemap === "detailed" ? "#E8EEF4" : "#20384A";

    map.addSource(ISOBAR_SOURCE, { type: "vector", url });
    map.addLayer(
      {
        id: ISOBAR_LAYER,
        type: "line",
        source: ISOBAR_SOURCE,
        "source-layer": "contours",
        paint: { "line-color": stroke, "line-width": 0.9, "line-opacity": 0.5 },
      },
      OVERLAY_ANCHOR,
    );
    map.addLayer(
      {
        id: ISOBAR_LABEL_LAYER,
        type: "symbol",
        source: ISOBAR_SOURCE,
        "source-layer": "contours",
        layout: {
          "symbol-placement": "line",
          "text-field": ["to-string", ["get", "level"]],
          "text-font": LABEL_FONT,
          "text-size": 10,
          "symbol-spacing": 220,
        },
        paint: {
          "text-color": stroke,
          "text-halo-color":
            basemap === "detailed" ? "rgba(7,11,16,0.8)" : "rgba(255,255,255,0.85)",
          "text-halo-width": 1.1,
        },
      },
      OVERLAY_ANCHOR,
    );
    appliedUrls[ISOBAR_SOURCE] = url;

    restackOverlays();
  }

  /**
   * Cheap path for scrubbing: point existing sources at another hour.
   * Rebuilding them per frame would drop the layers out of their slots in the
   * stack and make playback flicker.
   */
  function updateOverlayTimes() {
    if (!map || !runIndex) return;

    const swap = (sourceId: string, nextUrl: string) => {
      const source = map?.getSource(sourceId) as
        | maplibregl.RasterTileSource
        | maplibregl.VectorTileSource
        | undefined;
      if (!source || appliedUrls[sourceId] === nextUrl) return;
      source.setUrl(nextUrl);
      appliedUrls[sourceId] = nextUrl;
    };

    if (worldWeatherLayer) {
      swap(
        WEATHER_SOURCE,
        omRasterUrl(worldWeatherLayer, weatherTime, runIndex, {
          dark: basemap === "detailed",
        }),
      );
      if (weatherLayer(worldWeatherLayer).hasDirection) {
        swap(ARROWS_SOURCE, omArrowsUrl(worldWeatherLayer, weatherTime, runIndex));
      }
    }

    if (showIsobars) swap(ISOBAR_SOURCE, omIsobarUrl(weatherTime, runIndex));
  }

  function applyBasemap() {
    if (!map || !mapLoaded) return;
    const simple = basemap === "simple";
    const visibility = (on: boolean) => (on ? "visible" : "none");

    map.setLayoutProperty(BASEMAP_LAYERS.simpleLand, "visibility", visibility(simple));
    map.setLayoutProperty(BASEMAP_LAYERS.simpleBorders, "visibility", visibility(simple));
    map.setLayoutProperty(BASEMAP_LAYERS.simpleLabels, "visibility", visibility(simple));
    map.setLayoutProperty(BASEMAP_LAYERS.detailedBase, "visibility", visibility(!simple));
    map.setLayoutProperty(BASEMAP_LAYERS.detailedLabels, "visibility", visibility(!simple));
    map.setPaintProperty(
      BASEMAP_LAYERS.background,
      "background-color",
      BACKGROUND_COLOR[basemap],
    );
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
    //
    // Both basemaps are declared up front and switched by visibility, and the
    // detailed one is split into geography (no labels) and labels-only so the
    // weather raster can be sandwiched between them. That ordering is what
    // makes a weather map readable: data covers the land, but place names stay
    // legible on top of the data instead of being buried under it.
    const hidden = { visibility: "none" } as const;
    const visible = { visibility: "visible" } as const;
    const startSimple = basemap === "simple";

    map = new maplibregl.Map({
      container: mapContainer,
      style: {
        version: 8,
        // Required by any text layer — supplied alongside the demo vector tiles.
        glyphs: GLYPHS_URL,
        sources: {
          "simple-countries": {
            type: "vector",
            url: SIMPLE_TILES_URL,
            attribution: "&copy; MapLibre",
          },
          "carto-base": {
            type: "raster",
            tiles: cartoTiles("dark_nolabels"),
            // @2x tiles are 512px images for a 256px logical tile — declaring
            // 256 here is what gets us retina detail rather than giant tiles.
            tileSize: 256,
            attribution: CARTO_ATTRIBUTION,
            maxzoom: 19,
          },
          "carto-labels": {
            type: "raster",
            tiles: cartoTiles("dark_only_labels"),
            tileSize: 256,
            maxzoom: 19,
          },
        },
        layers: [
          // Doubles as the ocean fill for the simple basemap
          {
            id: BASEMAP_LAYERS.background,
            type: "background",
            paint: { "background-color": BACKGROUND_COLOR[basemap] },
          },
          {
            id: BASEMAP_LAYERS.simpleLand,
            type: "fill",
            source: "simple-countries",
            "source-layer": SIMPLE_COUNTRIES_LAYER,
            layout: startSimple ? visible : hidden,
            paint: { "fill-color": countryFillColor() },
          },
          {
            id: BASEMAP_LAYERS.simpleBorders,
            type: "line",
            source: "simple-countries",
            "source-layer": SIMPLE_COUNTRIES_LAYER,
            layout: startSimple ? visible : hidden,
            paint: {
              "line-color": SIMPLE_BORDER_COLOR,
              "line-width": 0.5,
              "line-opacity": 0.7,
            },
          },
          {
            id: BASEMAP_LAYERS.detailedBase,
            type: "raster",
            source: "carto-base",
            layout: startSimple ? hidden : visible,
            minzoom: 0,
            maxzoom: 19,
          },

          // ---- Data overlays are inserted here, between map and labels ----

          {
            id: BASEMAP_LAYERS.simpleLabels,
            type: "symbol",
            source: "simple-countries",
            "source-layer": SIMPLE_CENTROIDS_LAYER,
            layout: {
              ...(startSimple ? visible : hidden),
              // Abbreviations while the whole world is on screen, full names
              // once there's room for them.
              "text-field": ["step", ["zoom"], ["get", "ABBREV"], 3, ["get", "NAME"]],
              "text-font": LABEL_FONT,
              "text-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                1,
                9,
                3,
                11,
                6,
                15,
              ],
              "text-max-width": 8,
              "text-padding": 4,
            },
            paint: {
              "text-color": SIMPLE_LABEL_COLOR,
              "text-halo-color": SIMPLE_LABEL_HALO,
              "text-halo-width": 1.3,
            },
          },
          {
            id: BASEMAP_LAYERS.detailedLabels,
            type: "raster",
            source: "carto-labels",
            layout: startSimple ? hidden : visible,
            minzoom: 0,
            maxzoom: 19,
            paint: { "raster-opacity": 0.9 },
          },
        ],
      },
      center: [0, 20],
      zoom: 2,
      minZoom: 1,
      // Infinite horizontal pan, the way every serious weather map behaves —
      // a bounded world made ocean-spanning systems awkward to follow.
      renderWorldCopies: true,
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
          "circle-stroke-color": "rgba(7,11,16,0.55)",
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
          "circle-stroke-color": "rgba(7,11,16,0.75)",
        },
      });

      mapLoaded = true;
      renderMarkers();
      renderNearMeCircle();
      // Weather is left to its $effect, which tracks `mapLoaded` — calling it
      // here too is what created the duplicate-source race.
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

  // Rebuild when the layer, model run, or palette changes...
  $effect(() => {
    mapLoaded;
    worldWeatherLayer;
    runIndex;
    basemap;
    renderWeatherLayer();
  });

  $effect(() => {
    mapLoaded;
    showIsobars;
    runIndex;
    basemap;
    renderIsobars();
  });

  // ...and swap URLs in place when only the selected hour moves.
  $effect(() => {
    weatherTime;
    updateOverlayTimes();
  });

  $effect(() => {
    mapLoaded;
    basemap;
    applyBasemap();
  });
</script>

<div class="relative h-full w-full">
  <div bind:this={mapContainer} class="h-full w-full"></div>

  <!-- Status stack sits below the floating header, clear of the brand pill. -->
  <div class="pointer-events-none absolute top-16 left-3 z-20 flex flex-col items-start gap-2">
    {#if error}
      <div
        class="glass pointer-events-auto flex max-w-xs flex-col gap-2 rounded-xl px-3 py-2 text-sm text-sev-high"
      >
        <span>Couldn't load events: {error}</span>
        {#if onRetry}
          <button
            type="button"
            onclick={onRetry}
            class="self-start rounded-lg border border-sev-high/60 px-2 py-1 text-xs font-medium text-sev-high transition-colors hover:bg-sev-high hover:text-abyss"
          >
            Retry
          </button>
        {/if}
      </div>
    {/if}

    {#if weatherLayerError}
      <div class="glass pointer-events-auto max-w-xs rounded-xl px-3 py-2 text-xs text-sev-high">
        Weather layer: {weatherLayerError}
      </div>
    {/if}

    {#if !loading && !error}
      <div
        class="glass pointer-events-auto rounded-full px-3 py-1 text-xs font-medium text-muted tabular-nums"
      >
        <span class="text-ink">{eventCount}</span>
        event{eventCount === 1 ? "" : "s"} shown
      </div>
    {/if}
  </div>
</div>

<style>
  :global(.cluster-count-label) {
    color: #070b10;
    font-size: 11px;
    font-weight: 700;
    font-family: inherit;
    pointer-events: none;
  }

  /* ---- MapLibre chrome, restyled to match the dark shell ---- */

  :global(.maplibregl-popup-content) {
    background: rgba(17, 24, 32, 0.92);
    border: 1px solid rgba(38, 49, 61, 0.8);
    border-radius: 10px;
    padding: 8px 10px;
    box-shadow: 0 8px 28px -12px rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(10px);
    font-family: inherit;
  }

  :global(.maplibregl-popup-anchor-bottom .maplibregl-popup-tip) {
    border-top-color: rgba(17, 24, 32, 0.92) !important;
  }
  :global(.maplibregl-popup-anchor-top .maplibregl-popup-tip) {
    border-bottom-color: rgba(17, 24, 32, 0.92) !important;
  }
  :global(.maplibregl-popup-anchor-left .maplibregl-popup-tip) {
    border-right-color: rgba(17, 24, 32, 0.92) !important;
  }
  :global(.maplibregl-popup-anchor-right .maplibregl-popup-tip) {
    border-left-color: rgba(17, 24, 32, 0.92) !important;
  }

  :global(.maplibregl-ctrl-group) {
    background: rgba(17, 24, 32, 0.82) !important;
    border: 1px solid rgba(38, 49, 61, 0.7);
    border-radius: 10px !important;
    overflow: hidden;
    backdrop-filter: blur(12px);
    box-shadow: 0 8px 28px -12px rgba(0, 0, 0, 0.7) !important;
  }

  :global(.maplibregl-ctrl-group button) {
    background: transparent !important;
  }

  :global(.maplibregl-ctrl-group button + button) {
    border-top: 1px solid rgba(38, 49, 61, 0.7) !important;
  }

  :global(.maplibregl-ctrl-group button:hover) {
    background: rgba(79, 168, 224, 0.16) !important;
  }

  /* The control glyphs ship as dark SVGs — invert them for the dark surface. */
  :global(.maplibregl-ctrl-group button .maplibregl-ctrl-icon) {
    filter: invert(1) brightness(1.6);
  }

  :global(.maplibregl-ctrl-attrib) {
    background: rgba(7, 11, 16, 0.6) !important;
    border-radius: 8px;
    font-size: 10px;
  }

  :global(.maplibregl-ctrl-attrib a),
  :global(.maplibregl-ctrl-attrib) {
    color: #5b6874 !important;
  }

  :global(.maplibregl-ctrl-attrib-button) {
    filter: invert(1) brightness(1.4);
  }
</style>