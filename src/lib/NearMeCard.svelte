<script lang="ts">
  import type { WeatherSnapshot } from '../types/weather'
  import Icon from './Icon.svelte'
  import { fromCelsius, fromKmh, TEMPERATURE_SUFFIX, WIND_SUFFIX, unitsStore } from './units.svelte'

  interface Props {
    weather: WeatherSnapshot | null
    weatherLoading: boolean
    nearbyCount: number
    onClear: () => void
  }

  let { weather, weatherLoading, nearbyCount, onClear }: Props = $props()
</script>

<aside class="glass w-64 max-w-[90vw] rounded-2xl p-3">
  <div class="flex items-start justify-between gap-2">
    <h2 class="flex items-center gap-1.5 text-sm font-semibold text-ink">
      <Icon name="compass" size={14} class="text-accent" />
      Near you
    </h2>
    <button
      type="button"
      onclick={onClear}
      class="text-muted transition-colors hover:text-ink"
      aria-label="Exit Near Me mode"
    >
      <Icon name="close" size={13} />
    </button>
  </div>

  <p class="mt-1 text-[13px] text-muted">
    <span class="font-medium text-ink tabular-nums">{nearbyCount}</span>
    event{nearbyCount === 1 ? '' : 's'} within 1,000 km
  </p>

  {#if weatherLoading}
    <p class="mt-2 text-[13px] text-muted">Loading local weather…</p>
  {:else if weather}
    <div class="mt-2 grid grid-cols-2 gap-y-1.5 gap-x-3 text-[13px] text-ink">
      <div class="flex items-center gap-1.5">
        <Icon name="thermometer" size={13} class="text-muted" />
        {Math.round(fromCelsius(weather.temperatureC, unitsStore.temperature))}{TEMPERATURE_SUFFIX[unitsStore.temperature]}
        <span class="text-muted">(feels {Math.round(fromCelsius(weather.feelsLikeC, unitsStore.temperature))}°)</span>
      </div>
      <div class="flex items-center gap-1.5">
        <Icon name="wind" size={13} class="text-muted" />
        {Math.round(fromKmh(weather.windSpeedKph, unitsStore.wind))} {WIND_SUFFIX[unitsStore.wind]}
      </div>
      <div class="flex items-center gap-1.5">
        <Icon name="humidity" size={13} class="text-muted" />
        {weather.humidityPct}% humidity
      </div>
      <div class="flex items-center gap-1.5">
        <Icon name="rain" size={13} class="text-muted" />
        {weather.precipChancePct !== null ? `${weather.precipChancePct}% rain` : 'n/a'}
      </div>
    </div>
  {:else}
    <p class="mt-2 text-[13px] text-muted">Local weather unavailable.</p>
  {/if}
</aside>