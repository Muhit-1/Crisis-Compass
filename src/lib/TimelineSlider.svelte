<script lang="ts">
  import { timelineStore, TIMELINE_WINDOW_DAYS } from './timelineStore.svelte'
  import Icon from './Icon.svelte'

  let playing = $state(false)
  let playTimer: ReturnType<typeof setInterval> | null = null

  function formatDay(date: Date): string {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  function stepOlder() {
    timelineStore.setDaysAgo(timelineStore.daysAgo + 1)
  }
  function stepNewer() {
    timelineStore.setDaysAgo(Math.max(0, timelineStore.daysAgo - 1))
  }

  function togglePlay() {
    playing = !playing
    if (playing) {
      playTimer = setInterval(() => {
        if (timelineStore.daysAgo <= 0) {
          timelineStore.setDaysAgo(TIMELINE_WINDOW_DAYS - 1)
        } else {
          stepNewer()
        }
      }, 900)
    } else if (playTimer) {
      clearInterval(playTimer)
      playTimer = null
    }
  }

  $effect(() => {
    return () => {
      if (playTimer) clearInterval(playTimer)
    }
  })
</script>

<div class="pointer-events-none fixed inset-x-0 bottom-4 z-[1000] flex flex-col items-center gap-1">
  <div
    class="pointer-events-auto flex items-center gap-2 rounded-full bg-[#4D4636] px-3 py-1.5 text-white shadow-lg"
  >
    <button
      type="button"
      onclick={togglePlay}
      class="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/10"
      aria-label={playing ? 'Pause' : 'Play'}
    >
      <Icon name={playing ? 'pause' : 'play'} size={13} />
    </button>

    <div class="h-5 w-px bg-white/20"></div>

    <div class="flex items-center gap-1">
      <div class="flex flex-col">
        <button type="button" onclick={stepNewer} aria-label="Step forward a day" class="hover:text-white/70">
          <Icon name="chevronUp" size={11} />
        </button>
        <button type="button" onclick={stepOlder} aria-label="Step back a day" class="hover:text-white/70">
          <Icon name="chevronDown" size={11} />
        </button>
      </div>
      <span class="min-w-[3.2rem] text-center text-xs font-medium tabular-nums">
        {timelineStore.active ? formatDay(timelineStore.selectedDate) : 'Today'}
      </span>
    </div>

    <div class="h-5 w-px bg-white/20"></div>

    <span class="min-w-[3rem] text-center text-xs font-medium tabular-nums text-white/80">
      {timelineStore.active ? `${timelineStore.daysAgo}d ago` : 'Live'}
    </span>

    <div class="h-5 w-px bg-white/20"></div>

    <button
      type="button"
      onclick={() => timelineStore.resetToLive()}
      aria-label="Jump to live"
      class="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/10"
      title="Back to live"
    >
      <Icon name="skipForward" size={13} />
    </button>
  </div>

  {#if timelineStore.active && timelineStore.loading}
    <p class="pointer-events-auto rounded-full bg-[#4D4636]/90 px-3 py-0.5 text-[11px] text-white/80">
      Loading {TIMELINE_WINDOW_DAYS}-day history…
    </p>
  {:else if timelineStore.active && timelineStore.error}
    <p class="pointer-events-auto rounded-full bg-[#C97064] px-3 py-0.5 text-[11px] text-white">
      Couldn't load history: {timelineStore.error}
      <button type="button" class="ml-1 underline" onclick={() => timelineStore.retry()}>Retry</button>
    </p>
  {/if}
</div>