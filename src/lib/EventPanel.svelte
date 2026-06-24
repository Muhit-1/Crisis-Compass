<script lang="ts">
  import { getCurrentWeather } from './api/weather'
  import { isPointGeometry } from '../types/eonet'
  import type { EonetEvent } from '../types/eonet'
  import type { WeatherSnapshot } from '../types/weather'
  import { getCategoryStyle } from './categoryStyles'
  import { computeSeverity, SEVERITY_COLORS, SEVERITY_LABELS } from './severity'
  import Icon from './Icon.svelte'

  interface Props {
    event: EonetEvent
    onClose: () => void
  }

  let { event, onClose }: Props = $props()

  let weather = $state<WeatherSnapshot | null>(null)
  let weatherLoading = $state(false)
  let weatherError = $state<string | null>(null)

  const latestGeometry = $derived(event.geometry[event.geometry.length - 1])
  const coords = $derived(
    latestGeometry && isPointGeometry(latestGeometry) ? latestGeometry.coordinates : null,
  )
  const primaryStyle = $derived(getCategoryStyle(event.categories[0]?.id ?? ''))
  // Recomputes automatically once `weather` resolves, refining the estimate with live conditions.
  const severity = $derived(computeSeverity(event, weather))

  async function loadWeather() {
    if (!coords) return
    const [lng, lat] = coords
    weatherLoading = true
    weatherError = null
    try {
      weather = await getCurrentWeather(lat, lng)
    } catch (err) {
      weatherError = err instanceof Error ? err.message : 'Failed to load weather'
    } finally {
      weatherLoading = false
    }
  }

  // Re-fetch weather whenever a different event is selected.
  $effect(() => {
    event
    weather = null
    weatherError = null
    loadWeather()
  })
</script>

<aside
  class="absolute top-4 right-4 z-[1000] w-72 max-w-[90vw] rounded-lg border border-[#E8E0CC] bg-[#FFFDF8] p-4 shadow-lg"
>
  <div class="flex items-start justify-between gap-2">
    <h2 class="flex items-center gap-2 text-sm font-semibold text-[#33394A]">
      <span
        class="relative inline-flex h-5 w-5 items-center justify-center"
        style={`--sev-color:${SEVERITY_COLORS[severity.level]}`}
      >
        <span class="severity-ring"></span>
        <span style={`color:${primaryStyle.color}`} class="relative">
          <Icon name={primaryStyle.iconName} size={16} />
        </span>
      </span>
      {event.title}
    </h2>
    <button
      type="button"
      onclick={onClose}
      class="text-[#8A8473] hover:text-[#33394A]"
      aria-label="Close"
    >
      <Icon name="close" size={14} />
    </button>
  </div>

  <p class="mt-1 text-xs text-[#8A8473]">
    {event.categories.map((c) => c.title).join(', ')}
  </p>

  <div class="mt-2 flex items-center gap-1.5">
    <span
      class="rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase"
      style={`background-color:${SEVERITY_COLORS[severity.level]}`}
    >
      {SEVERITY_LABELS[severity.level]} risk
    </span>
    <span class="text-[10px] text-[#8A8473]">estimate, not official</span>
  </div>
  <p class="mt-1 text-[11px] text-[#8A8473]">{severity.reasons.join(' · ')}</p>

  <dl class="mt-3 space-y-1 text-xs text-[#33394A]">
    <div class="flex justify-between">
      <dt class="text-[#8A8473]">Status</dt>
      <dd>{event.closed ? 'Closed' : 'Open'}</dd>
    </div>
    {#if latestGeometry}
      <div class="flex justify-between">
        <dt class="text-[#8A8473]">Last updated</dt>
        <dd>{new Date(latestGeometry.date).toLocaleDateString()}</dd>
      </div>
    {/if}
  </dl>

  {#if event.description}
    <p class="mt-3 text-xs text-[#33394A]">{event.description}</p>
  {/if}

  <div class="mt-4 border-t border-[#E8E0CC] pt-3">
    <h3 class="text-xs font-semibold text-[#33394A]">Current weather on-site</h3>
    {#if event.closed}
      <p class="mt-0.5 text-[10px] text-[#8A8473]">
        This event is closed — showing today's weather, not conditions from when it occurred.
      </p>
    {/if}

    {#if weatherLoading}
      <p class="mt-1 text-xs text-[#8A8473]">Loading weather…</p>
    {:else if weatherError}
      <p class="mt-1 text-xs text-[#C97064]">{weatherError}</p>
      <button
        type="button"
        onclick={loadWeather}
        class="mt-1 rounded border border-[#C97064] px-2 py-0.5 text-xs text-[#C97064] hover:bg-[#C97064] hover:text-white"
      >
        Retry
      </button>
    {:else if weather}
      <ul class="mt-1 space-y-1 text-xs text-[#33394A]">
        <li class="flex items-center gap-1.5">
          <Icon name="thermometer" size={13} class="text-[#8A8473]" />
          {weather.temperatureC}°C
        </li>
        <li class="flex items-center gap-1.5">
          <Icon name="wind" size={13} class="text-[#8A8473]" />
          {weather.windSpeedKph} km/h wind
        </li>
        <li class="flex items-center gap-1.5">
          <Icon name="rain" size={13} class="text-[#8A8473]" />
          {weather.precipitationMm} mm precipitation
        </li>
        {#if weather.uvIndex !== null}
          <li class="flex items-center gap-1.5">
            <Icon name="sun" size={13} class="text-[#8A8473]" />
            UV index {weather.uvIndex}
          </li>
        {/if}
      </ul>
    {:else}
      <p class="mt-1 text-xs text-[#8A8473]">No coordinate data for this event.</p>
    {/if}
  </div>

  {#if event.sources.length}
    <div class="mt-4 border-t border-[#E8E0CC] pt-3">
      <h3 class="text-xs font-semibold text-[#33394A]">Sources</h3>
      <ul class="mt-1 space-y-0.5 text-xs">
        {#each event.sources as source}
          <li class="flex items-center gap-1">
            <Icon name="link" size={11} class="text-[#7FA8C9]" />
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              class="text-[#7FA8C9] underline"
            >
              {source.id}
            </a>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</aside>

<style>
  .severity-ring {
    position: absolute;
    inset: -3px;
    border-radius: 9999px;
    border: 1.5px solid var(--sev-color);
  }

  .severity-ring::after {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: 9999px;
    border: 1.5px solid var(--sev-color);
    opacity: 0.6;
    animation: severity-pulse 2.4s ease-out infinite;
  }

  @keyframes severity-pulse {
    0% {
      transform: scale(0.85);
      opacity: 0.6;
    }
    100% {
      transform: scale(1.6);
      opacity: 0;
    }
  }
</style>

