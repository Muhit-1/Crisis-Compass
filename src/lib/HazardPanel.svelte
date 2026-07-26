<script lang="ts">
  import type { GdacsAlert, Quake } from '../types/hazards'
  import { ALERT_COLORS, ALERT_ICONS, quakeColor } from './hazardStyles'
  import { GDACS_TYPE_LABEL } from './api/gdacs'
  import { relativeTime } from './time'
  import Icon from './Icon.svelte'

  interface Props {
    quake?: Quake | null
    alert?: GdacsAlert | null
    onClose: () => void
  }

  let { quake = null, alert = null, onClose }: Props = $props()

  const coords = (lat: number, lng: number) =>
    `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`

  const absoluteTime = (d: Date) =>
    d.toLocaleString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
</script>

<aside
  class="glass absolute top-16 right-3 z-30 max-h-[calc(100vh-9rem)] w-72 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-2xl p-4"
>
  {#if quake}
    <div class="flex items-start justify-between gap-2">
      <h2 class="flex items-center gap-2 text-sm font-semibold text-ink">
        <span style={`color:${quakeColor(quake.magnitude)}`}>
          <Icon name="earthquakes" size={16} />
        </span>
        M{quake.magnitude.toFixed(1)} earthquake
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

    <p class="mt-1 text-[13px] text-muted">{quake.place}</p>

    {#if quake.tsunami}
      <p
        class="mt-2 inline-block rounded-full bg-sev-high px-2 py-0.5 text-[12px] font-semibold tracking-wide text-abyss uppercase"
      >
        Tsunami flag raised
      </p>
    {/if}

    <dl class="mt-3 space-y-1 text-[13px] text-ink">
      <div class="flex justify-between">
        <dt class="text-muted">When</dt>
        <dd class="tabular-nums">{relativeTime(quake.time)}</dd>
      </div>
      <div class="flex justify-between">
        <dt class="text-muted">Local time</dt>
        <dd class="tabular-nums">{absoluteTime(quake.time)}</dd>
      </div>
      <div class="flex justify-between">
        <dt class="text-muted">Depth</dt>
        <dd class="tabular-nums">{quake.depthKm.toFixed(0)} km</dd>
      </div>
      <div class="flex justify-between">
        <dt class="text-muted">Significance</dt>
        <dd class="tabular-nums">{quake.significance}</dd>
      </div>
      {#if quake.pagerAlert}
        <div class="flex justify-between">
          <dt class="text-muted">PAGER alert</dt>
          <dd class="capitalize">{quake.pagerAlert}</dd>
        </div>
      {/if}
      <div class="flex justify-between">
        <dt class="text-muted">Position</dt>
        <dd class="tabular-nums">{coords(quake.lat, quake.lng)}</dd>
      </div>
    </dl>

    <a
      href={quake.url}
      target="_blank"
      rel="noreferrer"
      class="mt-3 inline-flex items-center gap-1 text-[13px] text-accent underline"
    >
      <Icon name="link" size={11} />
      USGS event page
    </a>

    <p class="mt-2 text-[12px] text-faint">Source: USGS · updates every minute</p>
  {:else if alert}
    <div class="flex items-start justify-between gap-2">
      <h2 class="flex items-center gap-2 text-sm font-semibold text-ink">
        <span style={`color:${ALERT_COLORS[alert.alertLevel]}`}>
          <Icon name={ALERT_ICONS[alert.eventType]} size={16} />
        </span>
        {alert.title}
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

    <div class="mt-2 flex flex-wrap items-center gap-1.5">
      <span
        class="rounded-full px-2 py-0.5 text-[12px] font-semibold tracking-wide text-abyss uppercase"
        style={`background-color:${ALERT_COLORS[alert.alertLevel]}`}
      >
        {alert.alertLevel} alert
      </span>
      <span class="text-[12px] text-muted">{GDACS_TYPE_LABEL[alert.eventType]}</span>
      {#if alert.isCurrent}
        <span class="text-[12px] text-accent">ongoing</span>
      {/if}
    </div>

    {#if alert.severityText}
      <p class="mt-2 text-[13px] text-ink">{alert.severityText}</p>
    {/if}

    <dl class="mt-3 space-y-1 text-[13px] text-ink">
      {#if alert.country}
        <div class="flex justify-between gap-3">
          <dt class="shrink-0 text-muted">Affected</dt>
          <dd class="text-right">{alert.country}</dd>
        </div>
      {/if}
      <div class="flex justify-between">
        <dt class="text-muted">From</dt>
        <dd class="tabular-nums">{absoluteTime(alert.from)}</dd>
      </div>
      <div class="flex justify-between">
        <dt class="text-muted">Alert score</dt>
        <dd class="tabular-nums">{alert.alertScore}</dd>
      </div>
      <div class="flex justify-between">
        <dt class="text-muted">Position</dt>
        <dd class="tabular-nums">{coords(alert.lat, alert.lng)}</dd>
      </div>
    </dl>

    <a
      href={alert.reportUrl}
      target="_blank"
      rel="noreferrer"
      class="mt-3 inline-flex items-center gap-1 text-[13px] text-accent underline"
    >
      <Icon name="link" size={11} />
      GDACS report
    </a>

    <p class="mt-2 text-[12px] text-faint">
      Source: GDACS (UN OCHA / EC JRC) — official alert level
    </p>
  {/if}
</aside>
