<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import L from "leaflet";
  import "leaflet/dist/leaflet.css";
  import "leaflet.markercluster";
  import "leaflet.markercluster/dist/MarkerCluster.css";
  import "leaflet.markercluster/dist/MarkerCluster.Default.css";

  import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
  import markerIcon from "leaflet/dist/images/marker-icon.png";
  import markerShadow from "leaflet/dist/images/marker-shadow.png";

  import { isPointGeometry } from "../types/eonet";
  import type { EonetEvent } from "../types/eonet";
  import { getCategoryStyle } from "./categoryStyles";
  import { ICONS } from "./icons";

  // Fix Leaflet default icon issue (Vite)
  // @ts-expect-error
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
  });

  interface Props {
    events: EonetEvent[];
    activeCategories: Set<string>;
    onSelectEvent: (event: EonetEvent) => void;
    loading?: boolean;
    error?: string | null;
    onRetry?: () => void;
  }

  let {
    events,
    activeCategories,
    onSelectEvent,
    loading = false,
    error = null,
    onRetry,
  }: Props = $props();

  let mapContainer: HTMLDivElement;
  let map: L.Map | null = null;
  let clusterGroup: L.MarkerClusterGroup | null = null;

  let eventCount = $state(0);

  // =========================
  // Dynamic zoom calculation
  // =========================
  const TILE_SIZE = 256;

  function computeMinZoom(): number {
    if (!mapContainer) return 2;
    const maxDim = Math.max(
      mapContainer.clientWidth,
      mapContainer.clientHeight
    );
    return Math.max(0, Math.ceil(Math.log2(maxDim / TILE_SIZE)));
  }

  let resizeObserver: ResizeObserver | null = null;

  function tooltipIconSvg(color: string, iconKey: keyof typeof ICONS): string {
    return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px">${ICONS[iconKey]}</svg>`;
  }

  function iconFor(event: EonetEvent): L.DivIcon {
    const style = getCategoryStyle(event.categories[0]?.id ?? "");
    return L.divIcon({
      className: "eonet-marker",
      html: `<span class="eonet-marker__dot" style="--marker-color:${style.color}"></span>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
  }

  function renderMarkers() {
    if (!map || !clusterGroup) return;

    clusterGroup.clearLayers();

    let visibleCount = 0;

    for (const event of events) {
      const matchesFilter = event.categories.some((c) =>
        activeCategories.has(c.id)
      );
      if (!matchesFilter) continue;

      const latestGeometry =
        event.geometry[event.geometry.length - 1];

      if (!latestGeometry || !isPointGeometry(latestGeometry)) continue;

      const [lng, lat] = latestGeometry.coordinates;
      const marker = L.marker([lat, lng], { icon: iconFor(event) });

      const style = getCategoryStyle(event.categories[0]?.id ?? "");
      const categoryNames = event.categories.map((c) => c.title).join(", ");

      marker.bindTooltip(
        `<strong>${tooltipIconSvg(
          style.color,
          style.iconName
        )} ${event.title}</strong><br/><span style="color:#8A8473">${categoryNames}</span>`,
        { direction: "top", offset: [0, -8] }
      );

      marker.on("click", () => onSelectEvent(event));

      clusterGroup.addLayer(marker);
      visibleCount++;
    }

    eventCount = visibleCount;
  }

  export function flyTo(event: EonetEvent): void {
    if (!map) return;

    const latestGeometry =
      event.geometry[event.geometry.length - 1];

    if (!latestGeometry || !isPointGeometry(latestGeometry)) return;

    const [lng, lat] = latestGeometry.coordinates;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 4), {
      duration: 1,
    });
  }

  onMount(() => {
    const initialZoom = computeMinZoom();

    map = L.map(mapContainer, {
      center: [20, 0],
      zoom: initialZoom,
      minZoom: initialZoom,
      maxBounds: L.latLngBounds([-90, -180], [90, 180]),
      maxBoundsViscosity: 1.0,
      worldCopyJump: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 18,
      noWrap: true,
    }).addTo(map);

    clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
    });

    map.addLayer(clusterGroup);

    renderMarkers();

    // =========================
    // Resize handling
    // =========================
    resizeObserver = new ResizeObserver(() => {
      if (!map) return;

      const z = computeMinZoom();
      map.setMinZoom(z);

      if (map.getZoom() < z) {
        map.setZoom(z);
      }
    });

    resizeObserver.observe(mapContainer);
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    map?.remove();
  });

  $effect(() => {
    events;
    activeCategories;
    renderMarkers();
  });
</script>

<div class="relative h-full w-full">
  <div bind:this={mapContainer} class="h-full w-full"></div>

  {#if loading}
    <div class="absolute top-4 left-4 z-[1000] rounded-md bg-[#FFFDF8]/95 px-3 py-2 text-sm text-[#33394A] shadow">
      Loading events…
    </div>
  {/if}

  {#if error}
    <div class="absolute top-4 left-4 z-[1000] flex max-w-xs flex-col gap-2 rounded-md bg-[#FFFDF8]/95 px-3 py-2 text-sm text-[#C97064] shadow">
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

  {#if !loading && !error}
    <div class="absolute top-4 left-4 z-[1000] rounded-md bg-[#FFFDF8]/95 px-3 py-2 text-sm text-[#33394A] shadow">
      {eventCount} event{eventCount === 1 ? "" : "s"} shown
    </div>
  {/if}
</div>

<style>
  :global(.eonet-marker__dot) {
    position: relative;
    display: block;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--marker-color);
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.9);
  }

  :global(.eonet-marker__dot::after) {
    content: "";
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    background: var(--marker-color);
    opacity: 0.45;
    animation: eonet-pulse 2.2s ease-out infinite;
  }

  @keyframes eonet-pulse {
    0% {
      transform: scale(0.6);
      opacity: 0.55;
    }
    70% {
      transform: scale(1.8);
      opacity: 0;
    }
    100% {
      transform: scale(1.8);
      opacity: 0;
    }
  }
</style>