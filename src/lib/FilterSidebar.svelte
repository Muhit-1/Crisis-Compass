<script lang="ts">
  import { CATEGORY_STYLES } from './categoryStyles'
  import Icon from './Icon.svelte'

  interface Props {
    active: Set<string>
    onToggle: (id: string) => void
    showWeatherOnMap: boolean
    onToggleWeatherOnMap: () => void
  }

  let { active, onToggle, showWeatherOnMap, onToggleWeatherOnMap }: Props = $props()

  const categories = Object.values(CATEGORY_STYLES)

  let categoriesOpen = $state(true)
  let weatherOpen = $state(true)
</script>

<nav class="flex w-52 shrink-0 flex-col gap-3 overflow-y-auto border-r border-[#E8E0CC] bg-[#FFFDF8] p-3">
  <section>
    <button
      type="button"
      onclick={() => (categoriesOpen = !categoriesOpen)}
      class="flex w-full items-center justify-between text-xs font-semibold tracking-wide text-[#8A8473] uppercase"
    >
      Categories
      <Icon name={categoriesOpen ? 'chevronUp' : 'chevronDown'} size={12} />
    </button>

    {#if categoriesOpen}
      <div class="mt-1 flex flex-col gap-1">
        {#each categories as category (category.id)}
          <label class="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-[#33394A] hover:bg-[#FAF6EC]">
            <input
              type="checkbox"
              checked={active.has(category.id)}
              onchange={() => onToggle(category.id)}
              class="accent-[#33394A]"
            />
            <span style={`color:${category.color}`}><Icon name={category.iconName} size={15} /></span>
            <span>{category.title}</span>
          </label>
        {/each}
      </div>
    {/if}
  </section>

  <section class="border-t border-[#E8E0CC] pt-3">
    <button
      type="button"
      onclick={() => (weatherOpen = !weatherOpen)}
      class="flex w-full items-center justify-between text-xs font-semibold tracking-wide text-[#8A8473] uppercase"
    >
      Weather
      <Icon name={weatherOpen ? 'chevronUp' : 'chevronDown'} size={12} />
    </button>

    {#if weatherOpen}
      <label class="mt-1 flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-[#33394A] hover:bg-[#FAF6EC]">
        <input
          type="checkbox"
          checked={showWeatherOnMap}
          onchange={onToggleWeatherOnMap}
          class="accent-[#33394A]"
        />
        <Icon name="thermometer" size={15} class="text-[#8A8473]" />
        <span>Show weather on map</span>
      </label>
      <p class="mt-0.5 px-2 text-[10px] text-[#8A8473]">
        Adds live conditions to each marker's tooltip. Off by default to limit API calls.
      </p>
    {/if}
  </section>
</nav>