<script lang="ts">
  import { getCurrentWeather } from "./api/weather";
  import { isPointGeometry } from "../types/eonet";
  import type { EonetEvent } from "../types/eonet";
  import type { WeatherSnapshot } from "../types/weather";
  import { getCategoryStyle } from "./categoryStyles";
  import {
    computeSeverity,
    matchGdacsAlert,
    SEVERITY_COLORS,
    SEVERITY_LABELS,
  } from "./severity";
  import { hazardsStore } from "./hazardsStore.svelte";
  import Icon from "./Icon.svelte";

  interface Props {
    event: EonetEvent;
    onClose: () => void;
  }

  let { event, onClose }: Props = $props();

  let weather = $state<WeatherSnapshot | null>(null);
  let weatherLoading = $state(false);
  let weatherError = $state<string | null>(null);

  const latestGeometry = $derived(event.geometry[event.geometry.length - 1]);
  const coords = $derived(
    latestGeometry && isPointGeometry(latestGeometry)
      ? latestGeometry.coordinates
      : null,
  );
  const primaryStyle = $derived(
    getCategoryStyle(event.categories[0]?.id ?? ""),
  );
  // Upgrades itself as data arrives: refines with live weather, and switches to
  // the official GDACS level outright if this incident turns out to be tracked.
  const gdacsAlert = $derived(matchGdacsAlert(event, hazardsStore.alerts));
  const severity = $derived(computeSeverity(event, weather, gdacsAlert));

  async function loadWeather() {
    if (!coords) return;
    const [lng, lat] = coords;
    weatherLoading = true;
    weatherError = null;
    try {
      weather = await getCurrentWeather(lat, lng);
    } catch (err) {
      weatherError =
        err instanceof Error ? err.message : "Failed to load weather";
    } finally {
      weatherLoading = false;
    }
  }

  // Re-fetch weather whenever a different event is selected.
  $effect(() => {
    event;
    weather = null;
    weatherError = null;
    loadWeather();
  });
</script>


<!-- Offset from the top so it clears the floating header. The icon rail lives
     on the left, so the right edge is free. -->
<aside
  class="glass absolute top-16 right-3 z-30 max-h-[calc(100vh-9rem)] w-72 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-2xl p-4"
>
  <div class="flex items-start justify-between gap-2">
    <h2 class="flex items-center gap-2 text-sm font-semibold text-ink">
      <span
        class="relative inline-flex h-5 w-5 shrink-0 items-center justify-center"
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
      class="shrink-0 text-muted transition-colors hover:text-ink"
      aria-label="Close"
    >
      <Icon name="close" size={14} />
    </button>
  </div>

  <p class="mt-1 text-[13px] text-muted">
    {event.categories.map((c) => c.title).join(", ")}
  </p>

  <div class="mt-2 flex flex-wrap items-center gap-1.5">
    <span
      class="rounded-full px-2 py-0.5 text-[12px] font-semibold tracking-wide text-abyss uppercase"
      style={`background-color:${SEVERITY_COLORS[severity.level]}`}
    >
      {SEVERITY_LABELS[severity.level]} risk
    </span>
    {#if severity.official}
      <span
        class="rounded-full border border-accent/50 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-accent uppercase"
      >
        GDACS official
      </span>
    {:else}
      <span class="text-[12px] text-muted">estimate, not official</span>
    {/if}
  </div>
  <p class="mt-1 text-[12px] text-muted">{severity.reasons.join(" · ")}</p>

  {#if severity.source}
    <a
      href={severity.source.reportUrl}
      target="_blank"
      rel="noreferrer"
      class="mt-1 inline-flex items-center gap-1 text-[12px] text-accent underline"
    >
      <Icon name="link" size={11} />
      GDACS report
    </a>
  {/if}

  <dl class="mt-3 space-y-1 text-[13px] text-ink">
    <div class="flex justify-between">
      <dt class="text-muted">Status</dt>
      <dd>{event.closed ? "Closed" : "Open"}</dd>
    </div>
    {#if latestGeometry}
      <div class="flex justify-between">
        <dt class="text-muted">Last updated</dt>
        <dd>{new Date(latestGeometry.date).toLocaleDateString()}</dd>
      </div>
    {/if}
  </dl>

  {#if event.description}
    <p class="mt-3 text-[13px] text-ink">{event.description}</p>
  {/if}

  <div class="mt-4 border-t border-edge pt-3">
    <h3 class="text-[13px] font-semibold text-ink">
      Current weather on-site
    </h3>
    {#if event.closed}
      <p class="mt-0.5 text-[12px] text-muted">
        This event is closed — showing today's weather, not conditions from when
        it occurred.
      </p>
    {/if}

    {#if weatherLoading}
      <p class="mt-1 text-[13px] text-muted">Loading weather…</p>
    {:else if weatherError}
      <p class="mt-1 text-[13px] text-sev-high">{weatherError}</p>
      <button
        type="button"
        onclick={loadWeather}
        class="mt-1 rounded border border-sev-high px-2 py-0.5 text-[13px] text-sev-high hover:bg-sev-high hover:text-abyss"
      >
        Retry
      </button>
    {:else if weather}
      <div class="mt-1 grid grid-cols-2 gap-y-1 gap-x-3 text-[13px] text-ink">
        <div class="flex items-center gap-1.5">
          <Icon name="thermometer" size={13} class="text-muted" />
          {Math.round(weather.temperatureC)}°C
          <span class="text-muted"
            >(feels {Math.round(weather.feelsLikeC)}°)</span
          >
        </div>
        <div class="flex items-center gap-1.5">
          <Icon name="wind" size={13} class="text-muted" />
          {Math.round(weather.windSpeedKph)} km/h
        </div>
        <div class="flex items-center gap-1.5">
          <Icon name="humidity" size={13} class="text-muted" />
          {weather.humidityPct}% humidity
        </div>
        <div class="flex items-center gap-1.5">
          <Icon name="rain" size={13} class="text-muted" />
          {weather.precipChancePct !== null
            ? `${weather.precipChancePct}% rain chance`
            : "n/a"}
        </div>
      </div>
      {#if weather.uvIndex !== null}
        <p class="mt-1 flex items-center gap-1.5 text-[13px] text-ink">
          <Icon name="sun" size={13} class="text-muted" />
          UV index {weather.uvIndex}
        </p>
      {/if}
    {:else}
      <p class="mt-1 text-[13px] text-muted">
        No coordinate data for this event.
      </p>
    {/if}
  </div>

  {#if event.sources.length}
    <div class="mt-4 border-t border-edge pt-3">
      <h3 class="text-[13px] font-semibold text-ink">Sources</h3>
      <ul class="mt-1 space-y-0.5 text-[13px]">
        {#each event.sources as source}
          <li class="flex items-center gap-1">
            <Icon name="link" size={11} class="text-accent" />
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              class="text-accent underline"
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
    content: "";
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
