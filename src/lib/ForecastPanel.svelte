<script lang="ts">
  import { getPointForecast } from './api/weather'
  import type { ForecastHour, PointForecast } from '../types/weather'
  import { compassPoint, describeWeatherCode } from './weatherCodes'
  import Icon from './Icon.svelte'

  interface Props {
    lat: number
    lng: number
    /** Master clock position — drives the marker and the readout. */
    selectedTime: Date
    onClose: () => void
  }

  let { lat, lng, selectedTime, onClose }: Props = $props()

  let forecast = $state<PointForecast | null>(null)
  let loading = $state(false)
  let error = $state<string | null>(null)

  async function load() {
    loading = true
    error = null
    forecast = null
    try {
      forecast = await getPointForecast(lat, lng)
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load forecast'
    } finally {
      loading = false
    }
  }

  // Refetch whenever a different point is picked.
  $effect(() => {
    lat
    lng
    void load()
  })

  /**
   * The chart shows a window around the selected hour rather than all 14 days.
   * At 288px, the full range would be under a pixel per hour and precipitation
   * bars would vanish. Weighted forward, since that's what a forecast is for.
   */
  const WINDOW_BEFORE_H = 24
  const WINDOW_AFTER_H = 72

  const visible = $derived.by<ForecastHour[]>(() => {
    if (!forecast) return []
    const from = selectedTime.getTime() - WINDOW_BEFORE_H * 3_600_000
    const to = selectedTime.getTime() + WINDOW_AFTER_H * 3_600_000
    const inWindow = forecast.hours.filter((h) => {
      const t = h.at.getTime()
      return t >= from && t <= to
    })
    // If the clock sits outside the fetched range, fall back to the whole set
    // rather than rendering an empty chart.
    return inWindow.length > 1 ? inWindow : forecast.hours
  })

  /** Hour nearest the master clock, used for the readout line. */
  const current = $derived.by<ForecastHour | null>(() => {
    if (!forecast?.hours.length) return null
    let best = forecast.hours[0]
    let bestDelta = Infinity
    for (const h of forecast.hours) {
      const d = Math.abs(h.at.getTime() - selectedTime.getTime())
      if (d < bestDelta) {
        bestDelta = d
        best = h
      }
    }
    return best
  })

  // ---- Chart geometry ----
  const W = 288
  const PAD = 5
  const INNER_W = W - PAD * 2
  const TEMP_TOP = 14
  const TEMP_H = 68
  const PRECIP_TOP = 90
  const PRECIP_H = 26
  const AXIS_Y = PRECIP_TOP + PRECIP_H
  const H = 136

  const xAt = (i: number) =>
    visible.length < 2 ? PAD : PAD + (i / (visible.length - 1)) * INNER_W

  const tempRange = $derived.by(() => {
    if (!visible.length) return { min: 0, max: 1 }
    const temps = visible.map((h) => h.temperatureC)
    let min = Math.min(...temps)
    let max = Math.max(...temps)
    if (max - min < 2) {
      min -= 1
      max += 1
    }
    const pad = (max - min) * 0.15
    return { min: min - pad, max: max + pad }
  })

  const yTemp = (v: number) => {
    const { min, max } = tempRange
    return TEMP_TOP + TEMP_H - ((v - min) / (max - min)) * TEMP_H
  }

  const precipMax = $derived(Math.max(1, ...visible.map((h) => h.precipitationMm)))

  const tempPath = $derived(
    visible.length < 2
      ? ''
      : visible
          .map((h, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)} ${yTemp(h.temperatureC).toFixed(1)}`)
          .join(' '),
  )

  const tempArea = $derived(
    tempPath ? `${tempPath} L${xAt(visible.length - 1).toFixed(1)} ${AXIS_Y} L${PAD} ${AXIS_Y} Z` : '',
  )

  const barWidth = $derived(
    visible.length < 2 ? 2 : Math.max(1.2, INNER_W / visible.length - 0.6),
  )

  /** Local midnights inside the window, for day separators and labels. */
  const dayMarks = $derived.by(() =>
    visible
      .map((h, i) => ({ h, i }))
      .filter(({ h }) => h.localIso.slice(11, 13) === '00')
      .map(({ h, i }) => ({
        x: xAt(i),
        label: new Date(`${h.localIso}Z`).toLocaleDateString(undefined, {
          weekday: 'short',
          timeZone: 'UTC',
        }),
      })),
  )

  const markerX = $derived.by(() => {
    if (visible.length < 2) return null
    let bestIndex = 0
    let bestDelta = Infinity
    visible.forEach((h, i) => {
      const d = Math.abs(h.at.getTime() - selectedTime.getTime())
      if (d < bestDelta) {
        bestDelta = d
        bestIndex = i
      }
    })
    return xAt(bestIndex)
  })

  const coords = $derived(
    `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`,
  )

  const localLabel = $derived(
    current
      ? new Date(`${current.localIso}Z`).toLocaleString(undefined, {
          weekday: 'short',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'UTC',
        })
      : '',
  )
</script>

<aside
  class="glass absolute top-16 right-3 z-30 max-h-[calc(100vh-9rem)] w-80 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-2xl p-3.5"
>
  <div class="flex items-start justify-between gap-2">
    <div class="min-w-0">
      <h2 class="text-sm font-semibold text-ink">Forecast</h2>
      <p class="truncate text-[12px] text-muted tabular-nums">
        {coords}{#if forecast}<span class="text-faint"> · {Math.round(forecast.elevationM)} m</span>{/if}
      </p>
    </div>
    <button
      type="button"
      onclick={onClose}
      class="shrink-0 text-muted transition-colors hover:text-ink"
      aria-label="Close forecast"
    >
      <Icon name="close" size={14} />
    </button>
  </div>

  {#if loading}
    <p class="mt-3 text-[13px] text-muted">Loading forecast…</p>
  {:else if error}
    <p class="mt-3 text-[13px] text-sev-high">{error}</p>
    <button
      type="button"
      onclick={load}
      class="mt-1.5 rounded-lg border border-sev-high/60 px-2 py-0.5 text-[13px] text-sev-high transition-colors hover:bg-sev-high hover:text-abyss"
    >
      Retry
    </button>
  {:else if forecast && current}
    {@const info = describeWeatherCode(current.weatherCode)}

    <!-- Conditions at the clock's position -->
    <div class="mt-2.5 flex items-center gap-2.5">
      <Icon name={info.iconName} size={22} class="shrink-0 text-accent" />
      <div class="min-w-0">
        <div class="flex items-baseline gap-1.5">
          <span class="text-xl leading-none font-semibold text-ink tabular-nums">
            {Math.round(current.temperatureC)}°
          </span>
          <span class="truncate text-[12px] text-muted">{info.label}</span>
        </div>
        <p class="mt-0.5 text-[12px] text-faint tabular-nums">
          {localLabel} local · feels {Math.round(current.feelsLikeC)}°
        </p>
      </div>
    </div>

    <div class="mt-2 grid grid-cols-3 gap-x-2 gap-y-1 text-[12px] text-ink">
      <div class="flex items-center gap-1">
        <Icon name="wind" size={12} class="text-muted" />
        <span class="tabular-nums">{Math.round(current.windSpeedKph)}</span>
        <span class="text-faint">{compassPoint(current.windDirectionDeg)}</span>
      </div>
      <div class="flex items-center gap-1">
        <Icon name="rain" size={12} class="text-muted" />
        <span class="tabular-nums">
          {current.precipChancePct !== null ? `${current.precipChancePct}%` : '—'}
        </span>
      </div>
      <div class="flex items-center gap-1">
        <Icon name="cloudsLayer" size={12} class="text-muted" />
        <span class="tabular-nums">{Math.round(current.cloudCoverPct)}%</span>
      </div>
    </div>

    <!-- Meteogram -->
    <svg
      class="mt-2.5 w-full"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Hourly temperature and precipitation forecast"
    >
      <defs>
        <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FF9F4A" stop-opacity="0.34" />
          <stop offset="100%" stop-color="#FF9F4A" stop-opacity="0" />
        </linearGradient>
      </defs>

      {#each dayMarks as mark (mark.x)}
        <line
          x1={mark.x}
          y1={TEMP_TOP - 6}
          x2={mark.x}
          y2={AXIS_Y}
          stroke="#26313D"
          stroke-width="1"
        />
        <text x={mark.x + 3} y={H - 3} font-size="9" fill="#5B6874">{mark.label}</text>
      {/each}

      <line x1={PAD} y1={AXIS_Y} x2={W - PAD} y2={AXIS_Y} stroke="#26313D" stroke-width="1" />

      <!-- Precipitation, drawn upward from the axis -->
      {#each visible as hour, i (hour.localIso)}
        {#if hour.precipitationMm > 0}
          <rect
            x={xAt(i) - barWidth / 2}
            y={AXIS_Y - (hour.precipitationMm / precipMax) * PRECIP_H}
            width={barWidth}
            height={(hour.precipitationMm / precipMax) * PRECIP_H}
            fill="#4FA8E0"
            opacity="0.75"
          />
        {/if}
      {/each}

      {#if tempPath}
        <path d={tempArea} fill="url(#tempFill)" />
        <path
          d={tempPath}
          fill="none"
          stroke="#FF9F4A"
          stroke-width="1.6"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
      {/if}

      {#if markerX !== null}
        <line
          x1={markerX}
          y1={TEMP_TOP - 8}
          x2={markerX}
          y2={AXIS_Y}
          stroke="#E8EEF4"
          stroke-width="1.4"
          stroke-dasharray="2 2"
        />
        <circle cx={markerX} cy={yTemp(current.temperatureC)} r="3" fill="#E8EEF4" />
      {/if}

      <!-- Range labels -->
      <text x={PAD} y={TEMP_TOP - 5} font-size="9" fill="#8595A5">
        {Math.round(tempRange.max)}{forecast.units.temperature}
      </text>
      <text x={W - PAD} y={TEMP_TOP - 5} font-size="9" fill="#8595A5" text-anchor="end">
        max {Math.round(precipMax * 10) / 10}{forecast.units.precipitation}/h
      </text>
    </svg>

    <p class="mt-1 text-[11px] text-faint">
      Hourly · {forecast.timezone} · Open-Meteo
    </p>
  {/if}
</aside>
