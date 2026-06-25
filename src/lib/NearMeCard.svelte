<script lang="ts">
  import type { WeatherSnapshot } from '../types/weather'
  import Icon from './Icon.svelte'

  interface Props {
    weather: WeatherSnapshot | null
    weatherLoading: boolean
    nearbyCount: number
    onClear: () => void
  }

  let { weather, weatherLoading, nearbyCount, onClear }: Props = $props()
</script>

<aside class="absolute bottom-4 left-4 z-[1000] w-64 max-w-[90vw] rounded-lg border border-[#E8E0CC] bg-[#FFFDF8] p-3 shadow-lg">
  <div class="flex items-start justify-between gap-2">
    <h2 class="flex items-center gap-1.5 text-sm font-semibold text-[#33394A]">
      <Icon name="compass" size={14} />
      Near you
    </h2>
    <button type="button" onclick={onClear} class="text-[#8A8473] hover:text-[#33394A]" aria-label="Exit Near Me mode">
      <Icon name="close" size={13} />
    </button>
  </div>

  <p class="mt-1 text-xs text-[#33394A]">
    {nearbyCount} event{nearbyCount === 1 ? '' : 's'} within 1,000 km
  </p>

  {#if weatherLoading}
    <p class="mt-2 text-xs text-[#8A8473]">Loading local weather…</p>
  {:else if weather}
    <div class="mt-2 grid grid-cols-2 gap-y-1 gap-x-3 text-xs text-[#33394A]">
      <div class="flex items-center gap-1.5">
        <Icon name="thermometer" size={13} class="text-[#8A8473]" />
        {Math.round(weather.temperatureC)}°C
        <span class="text-[#8A8473]">(feels {Math.round(weather.feelsLikeC)}°)</span>
      </div>
      <div class="flex items-center gap-1.5">
        <Icon name="wind" size={13} class="text-[#8A8473]" />
        {Math.round(weather.windSpeedKph)} km/h
      </div>
      <div class="flex items-center gap-1.5">
        <Icon name="humidity" size={13} class="text-[#8A8473]" />
        {weather.humidityPct}% humidity
      </div>
      <div class="flex items-center gap-1.5">
        <Icon name="rain" size={13} class="text-[#8A8473]" />
        {weather.precipChancePct !== null ? `${weather.precipChancePct}% rain` : 'n/a'}
      </div>
    </div>
  {:else}
    <p class="mt-2 text-xs text-[#8A8473]">Local weather unavailable.</p>
  {/if}
</aside>