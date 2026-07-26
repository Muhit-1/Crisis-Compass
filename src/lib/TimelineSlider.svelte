<script lang="ts">
  import { timelineStore, TIMELINE_WINDOW_DAYS } from './timelineStore.svelte'
  import Icon from './Icon.svelte'

  const store = timelineStore

  function addHours(date: Date, hours: number): Date {
    return new Date(date.getTime() + hours * 3_600_000)
  }

  /** Position of an hour-offset along the track, as a percentage. */
  function pct(offset: number): number {
    const span = store.maxOffset - store.minOffset
    if (span <= 0) return 0
    return ((offset - store.minOffset) / span) * 100
  }

  const nowPct = $derived(pct(0))
  const valuePct = $derived(pct(store.hourOffset))

  /** Highlight the span between "now" and wherever the user has scrubbed to. */
  const fillLeft = $derived(Math.min(nowPct, valuePct))
  const fillWidth = $derived(Math.abs(valuePct - nowPct))

  /** Local-midnight boundaries across the window, for day labels under the track. */
  const dayTicks = $derived.by(() => {
    const ticks: { offset: number; label: string }[] = []
    const end = addHours(store.baseHour, store.maxOffset).getTime()

    const cursor = addHours(store.baseHour, store.minOffset)
    cursor.setHours(24, 0, 0, 0) // first local midnight inside the window

    while (cursor.getTime() <= end) {
      ticks.push({
        offset: Math.round((cursor.getTime() - store.baseHour.getTime()) / 3_600_000),
        label: cursor.toLocaleDateString(undefined, { weekday: 'short' }),
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    return ticks
  })

  const absoluteLabel = $derived(
    store.selectedTime.toLocaleString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }),
  )

  const relativeLabel = $derived.by(() => {
    // Read the snapped offset, not the raw slider position, so the two lines
    // of the readout can never disagree.
    const h = store.effectiveOffset
    if (h === 0) return 'now'
    const sign = h > 0 ? '+' : '−'
    const abs = Math.abs(h)
    if (abs < 24) return `${sign}${abs}h`
    const days = Math.floor(abs / 24)
    const hours = abs % 24
    return hours === 0 ? `${sign}${days}d` : `${sign}${days}d ${hours}h`
  })

  function onScrub(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    store.setOffset(Number(input.value))
  }

  function handleKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

    if (event.key === ' ') {
      event.preventDefault()
      store.togglePlay()
    }
  }

  $effect(() => () => store.pause())
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex flex-col items-center gap-1.5">
  {#if store.runError}
    <p class="glass pointer-events-auto rounded-full px-3 py-1 text-[12px] text-sev-high">
      Weather model unavailable: {store.runError}
      <button type="button" class="ml-1 underline" onclick={() => store.retryRun()}>Retry</button>
    </p>
  {:else if store.isPast && store.loading}
    <p class="glass pointer-events-auto rounded-full px-3 py-1 text-[12px] text-muted">
      Loading {TIMELINE_WINDOW_DAYS}-day event history…
    </p>
  {:else if store.isPast && store.error}
    <p class="glass pointer-events-auto rounded-full px-3 py-1 text-[12px] text-sev-high">
      Couldn't load history: {store.error}
      <button type="button" class="ml-1 underline" onclick={() => store.retry()}>Retry</button>
    </p>
  {/if}

  <div
    class="glass pointer-events-auto w-[min(880px,calc(100vw-1.5rem))] rounded-2xl px-3 py-2"
  >
    <div class="flex items-center gap-3">
      <button
        type="button"
        onclick={() => store.togglePlay()}
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent transition-colors hover:bg-accent/25"
        aria-label={store.playing ? 'Pause' : 'Play forecast'}
        title={store.playing ? 'Pause (space)' : 'Play (space)'}
      >
        <Icon name={store.playing ? 'pause' : 'play'} size={14} />
      </button>

      <div class="flex shrink-0 items-center text-muted">
        <button
          type="button"
          onclick={() => store.step(-24)}
          class="rounded p-1 transition-colors hover:text-ink"
          aria-label="Back one day"
          title="Back one day"
        >
          <Icon name="chevronDown" size={13} />
        </button>
        <button
          type="button"
          onclick={() => store.step(-1)}
          class="rounded px-1 py-1 text-[12px] font-semibold transition-colors hover:text-ink"
          aria-label="Back one hour"
          title="Back one hour"
        >
          1h
        </button>
        <button
          type="button"
          onclick={() => store.step(1)}
          class="rounded px-1 py-1 text-[12px] font-semibold transition-colors hover:text-ink"
          aria-label="Forward one hour"
          title="Forward one hour"
        >
          1h
        </button>
        <button
          type="button"
          onclick={() => store.step(24)}
          class="rounded p-1 transition-colors hover:text-ink"
          aria-label="Forward one day"
          title="Forward one day"
        >
          <Icon name="chevronUp" size={13} />
        </button>
      </div>

      <!-- Scrubber -->
      <div class="relative min-w-0 flex-1 pb-3.5">
        <div class="pointer-events-none absolute inset-x-0 top-[9px] h-1 rounded-full bg-edge"></div>

        <div
          class="pointer-events-none absolute top-[9px] h-1 rounded-full bg-accent/55"
          style={`left:${fillLeft}%;width:${fillWidth}%`}
        ></div>

        {#each dayTicks as tick (tick.offset)}
          <div
            class="pointer-events-none absolute top-[7px] h-2 w-px bg-faint"
            style={`left:${pct(tick.offset)}%`}
          ></div>
          <span
            class="pointer-events-none absolute top-[17px] -translate-x-1/2 text-[11px] whitespace-nowrap text-faint"
            style={`left:${pct(tick.offset)}%`}
          >
            {tick.label}
          </span>
        {/each}

        <!-- "now" divider between observed past and forecast -->
        <div
          class="pointer-events-none absolute top-[4px] h-[11px] w-0.5 -translate-x-1/2 rounded-full bg-ink"
          style={`left:${nowPct}%`}
          title="Now"
        ></div>

        <input
          class="scrub relative w-full"
          type="range"
          min={store.minOffset}
          max={store.maxOffset}
          step="1"
          value={store.hourOffset}
          oninput={onScrub}
          aria-label="Forecast time"
          aria-valuetext={`${absoluteLabel} (${relativeLabel})`}
        />
      </div>

      <div class="shrink-0 text-right">
        <div class="text-[13px] font-medium whitespace-nowrap tabular-nums">{absoluteLabel}</div>
        <div
          class={`text-[12px] tabular-nums ${store.isLive ? 'text-accent' : 'text-muted'}`}
        >
          {relativeLabel}
          {#if store.isForecast}<span class="text-faint"> · forecast</span>{/if}
        </div>
      </div>

      <button
        type="button"
        onclick={() => store.resetToLive()}
        disabled={store.isLive}
        class="flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium transition-colors disabled:opacity-40 enabled:hover:bg-accent/20 enabled:hover:text-accent"
        aria-label="Jump to now"
        title="Jump to now"
      >
        <Icon name="skipForward" size={12} />
        Live
      </button>
    </div>
  </div>
</div>

<style>
  /* Native range input with its own track hidden — the visible track, day
     ticks and "now" marker are drawn as siblings behind it, so only the thumb
     comes from the input itself. */
  .scrub {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    height: 20px;
    margin: 0;
    cursor: pointer;
  }

  .scrub::-webkit-slider-runnable-track {
    height: 20px;
    background: transparent;
  }

  .scrub::-moz-range-track {
    height: 20px;
    background: transparent;
  }

  .scrub::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    height: 14px;
    width: 14px;
    margin-top: 3px;
    border-radius: 9999px;
    background: var(--color-ink);
    border: 2px solid var(--color-accent);
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.6);
  }

  .scrub::-moz-range-thumb {
    height: 14px;
    width: 14px;
    border-radius: 9999px;
    background: var(--color-ink);
    border: 2px solid var(--color-accent);
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.6);
  }

  .scrub:focus-visible::-webkit-slider-thumb {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .scrub:focus-visible::-moz-range-thumb {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
</style>
