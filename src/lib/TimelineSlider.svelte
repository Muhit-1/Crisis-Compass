<script lang="ts">
  import { timelineStore, TIMELINE_WINDOW_DAYS } from './timelineStore.svelte'
  import Icon from './Icon.svelte'

  function formatDay(date: Date): string {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  // Slider runs left (oldest, 29 days ago) -> right (today / Live), which
  // reads naturally with the "← Timeline ... →" framing from the project plan.
  const sliderMax = TIMELINE_WINDOW_DAYS - 1
  const sliderValue = $derived(sliderMax - timelineStore.daysAgo)

  function handleInput(e: Event) {
    const value = Number((e.target as HTMLInputElement).value)
    timelineStore.setDaysAgo(sliderMax - value)
  }
</script>

<div
  class="flex items-center gap-3 border-t border-[#E8E0CC] bg-[#FFFDF8] px-4 py-2 text-xs text-[#33394A]"
>
  <span class="hidden shrink-0 items-center gap-1 text-[#8A8473] sm:flex">
    <Icon name="pulse" size={13} />
    Last {TIMELINE_WINDOW_DAYS} days
  </span>

  <input
    type="range"
    min="0"
    max={sliderMax}
    value={sliderValue}
    oninput={handleInput}
    class="flex-1 accent-[#33394A]"
    aria-label="Scrub the last 30 days of events"
  />

  <div class="flex w-32 shrink-0 items-center justify-end gap-2">
    {#if timelineStore.active}
      <span class="font-medium">{formatDay(timelineStore.selectedDate)}</span>
      <button
        type="button"
        onclick={() => timelineStore.resetToLive()}
        class="rounded border border-[#E8E0CC] px-2 py-0.5 font-medium text-[#33394A] hover:bg-[#FAF6EC]"
      >
        Back to live
      </button>
    {:else}
      <span class="flex items-center gap-1 font-medium text-[#C97064]">
        <span class="relative flex h-1.5 w-1.5">
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C97064] opacity-60"
          ></span>
          <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#C97064]"></span>
        </span>
        Live
      </span>
    {/if}
  </div>
</div>

{#if timelineStore.active && timelineStore.loading}
  <p class="border-t border-[#E8E0CC] bg-[#FFFDF8] px-4 py-1 text-xs text-[#8A8473]">
    Loading {TIMELINE_WINDOW_DAYS}-day history…
  </p>
{:else if timelineStore.active && timelineStore.error}
  <p class="border-t border-[#E8E0CC] bg-[#FFFDF8] px-4 py-1 text-xs text-[#C97064]">
    Couldn't load history: {timelineStore.error}
    <button type="button" class="ml-1 underline" onclick={() => timelineStore.retry()}>
      Retry
    </button>
  </p>
{/if}
