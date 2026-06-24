<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import L from 'leaflet'
  import 'leaflet/dist/leaflet.css'

  // Vite doesn't resolve Leaflet's default marker icon URLs out of the box —
  // without this fix markers render as broken images.
  import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
  import markerIcon from 'leaflet/dist/images/marker-icon.png'
  import markerShadow from 'leaflet/dist/images/marker-shadow.png'

  import { getEvents } from './api/eonet'
  import { isPointGeometry } from '../types/eonet'
  import type { EonetEvent } from '../types/eonet'

  // @ts-expect-error - _getIconUrl exists at runtime but isn't in the public types
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
  })

  let mapContainer: HTMLDivElement
  let map: L.Map | null = null
  let markers: L.Marker[] = []

  let loading = $state(true)
  let error = $state<string | null>(null)
  let eventCount = $state(0)

  function plotEvents(events: EonetEvent[]) {
    if (!map) return

    markers.forEach((m) => m.remove())
    markers = []

    for (const event of events) {
      // Use the most recent geometry entry — moving/growing events (storms,
      // fires) have a history; we only care about "where is it now" in Phase 1.
      const latestGeometry = event.geometry[event.geometry.length - 1]
      if (!latestGeometry || !isPointGeometry(latestGeometry)) continue

      const [lng, lat] = latestGeometry.coordinates
      const marker = L.marker([lat, lng]).addTo(map)

      const categoryNames = event.categories.map((c) => c.title).join(', ')
      marker.bindPopup(
        `<strong>${event.title}</strong><br/>${categoryNames}<br/><span style="color:#8A8473">${new Date(
          latestGeometry.date,
        ).toLocaleDateString()}</span>`,
      )

      markers.push(marker)
    }

    eventCount = markers.length
  }

  onMount(async () => {
    map = L.map(mapContainer, {
      center: [20, 0],
      zoom: 2,
      worldCopyJump: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map)

    try {
      const events = await getEvents({ status: 'open' })
      plotEvents(events)
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load events'
    } finally {
      loading = false
    }
  })

  onDestroy(() => {
    map?.remove()
  })
</script>

<div class="relative h-full w-full">
  <div bind:this={mapContainer} class="h-full w-full"></div>

  {#if loading}
    <div
      class="absolute top-4 left-4 z-[1000] rounded-md bg-[#FFFDF8]/95 px-3 py-2 text-sm text-[#33394A] shadow"
    >
      Loading events…
    </div>
  {/if}

  {#if error}
    <div
      class="absolute top-4 left-4 z-[1000] rounded-md bg-[#FFFDF8]/95 px-3 py-2 text-sm text-[#C97064] shadow"
    >
      Couldn't load events: {error}
    </div>
  {/if}

  {#if !loading && !error}
    <div
      class="absolute top-4 left-4 z-[1000] rounded-md bg-[#FFFDF8]/95 px-3 py-2 text-sm text-[#33394A] shadow"
    >
      {eventCount} active events (EONET live)
    </div>
  {/if}
</div>
