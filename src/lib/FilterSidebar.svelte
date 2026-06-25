<script lang="ts">
  import { CATEGORY_STYLES } from './categoryStyles'
  import { WEATHER_LAYER_OPTIONS, type WeatherLayerKey } from './weatherLayers'
  import Icon from './Icon.svelte'

  interface Props {
    active: Set<string>
    onToggle: (id: string) => void
    showWeatherOnMap: boolean
    onToggleWeatherOnMap: () => void
    worldWeatherLayer: WeatherLayerKey | null
    onSetWorldWeatherLayer: (key: WeatherLayerKey | null) => void
  }

  let {
    active,
    onToggle,
    showWeatherOnMap,
    onToggleWeatherOnMap,
    worldWeatherLayer,
    onSetWorldWeatherLayer,
  }: Props = $props()

  const categories = Object.values(CATEGORY_STYLES).sort((a, b) =>
    a.title.localeCompare(b.title),
  )

  let categoriesOpen = $state(true)
  let tooltipWeatherOpen = $state(true)
  let worldWeatherOpen = $state(true)

  const allActive = $derived(categories.every((c) => active.has(c.id)))
  const noneActive = $derived(categories.every((c) => !active.has(c.id)))

  function selectAll() {
    for (const c of categories) if (!active.has(c.id)) onToggle(c.id)
  }
  function selectNone() {
    for (const c of categories) if (active.has(c.id)) onToggle(c.id)
  }

  function toggleWorldWeather() {
    onSetWorldWeatherLayer(worldWeatherLayer ? null : 'temp_new')
  }
</script>

<nav class="flex w-52 shrink-0 flex-col gap-3 overflow-y-auto border-r border-[#E8E0CC] bg-[#FFFDF8] p-3">
  <section>
    <div class="flex items-center justify-between">
      <button
        type="button"
        onclick={() => (categoriesOpen = !categoriesOpen)}
        class="flex items-center gap-1 text-xs font-semibold tracking-wide text-[#8A8473] uppercase"
      >
        Categories
        <Icon name={categoriesOpen ? 'chevronUp' : 'chevronDown'} size={12} />
      </button>
      <div class="flex items-center gap-1 text-[10px] font-medium text-[#8A8473]">
        <button type="button" onclick={selectAll} disabled={allActive} class="hover:text-[#33394A] disabled:opacity-40">
          All
        </button>
        <span>·</span>
        <button type="button" onclick={selectNone} disabled={noneActive} class="hover:text-[#33394A] disabled:opacity-40">
          None
        </button>
      </div>
    </div>

    {#if categoriesOpen}
      <div class="mt-1.5 flex flex-col gap-0.5">
        {#each categories as category (category.id)}
          <label class="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-[#33394A] hover:bg-[#FAF6EC]">
            <input
              type="checkbox"
              checked={active.has(category.id)}
              onchange={() => onToggle(category.id)}
              class="accent-[#33394A]"
            />
            <span style={`color:${category.color}`}><Icon name={category.iconName} size={15} /></span>
            <span class="truncate">{category.title}</span>
          </label>
        {/each}
      </div>
    {/if}
  </section>

  <!-- World weather map overlay (OpenWeatherMap raster tiles, whole-globe) -->
  <section class="border-t border-[#E8E0CC] pt-3">
    <button
      type="button"
      onclick={() => (worldWeatherOpen = !worldWeatherOpen)}
      class="flex w-full items-center justify-between text-xs font-semibold tracking-wide text-[#8A8473] uppercase"
    >
      World Weather Map
      <Icon name={worldWeatherOpen ? 'chevronUp' : 'chevronDown'} size={12} />
    </button>

    {#if worldWeatherOpen}
      <label class="mt-1.5 flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-[#33394A] hover:bg-[#FAF6EC]">
        <input
          type="checkbox"
          checked={worldWeatherLayer !== null}
          onchange={toggleWorldWeather}
          class="accent-[#33394A]"
        />
        <Icon name="thermometer" size={15} class="text-[#8A8473]" />
        <span>Show on map</span>
      </label>

      {#if worldWeatherLayer !== null}
        <div class="mt-1 flex flex-col gap-0.5 pl-2">
          {#each WEATHER_LAYER_OPTIONS as option (option.key)}
            <label class="flex cursor-pointer items-center gap-2 rounded px-2 py-0.5 text-xs text-[#33394A] hover:bg-[#FAF6EC]">
              <input
                type="radio"
                name="world-weather-layer"
                checked={worldWeatherLayer === option.key}
                onchange={() => onSetWorldWeatherLayer(option.key)}
                class="accent-[#33394A]"
              />
              <span>{option.label}</span>
            </label>
          {/each}
        </div>
      {/if}

      <p class="mt-1 px-2 text-[10px] text-[#8A8473]">
        Live global overlay from OpenWeatherMap — separate from the per-event weather below.
      </p>
    {/if}
  </section>

  <!-- Per-marker weather tooltip (Open-Meteo, on hover) -->
  <section class="border-t border-[#E8E0CC] pt-3">
    <button
      type="button"
      onclick={() => (tooltipWeatherOpen = !tooltipWeatherOpen)}
      class="flex w-full items-center justify-between text-xs font-semibold tracking-wide text-[#8A8473] uppercase"
    >
      Event Weather Tooltip
      <Icon name={tooltipWeatherOpen ? 'chevronUp' : 'chevronDown'} size={12} />
    </button>

    {#if tooltipWeatherOpen}
      <label class="mt-1.5 flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-[#33394A] hover:bg-[#FAF6EC]">
        <input
          type="checkbox"
          checked={showWeatherOnMap}
          onchange={onToggleWeatherOnMap}
          class="accent-[#33394A]"
        />
        <Icon name="thermometer" size={15} class="text-[#8A8473]" />
        <span>Show on hover</span>
      </label>
      <p class="mt-0.5 px-2 text-[10px] text-[#8A8473]">
        Adds live conditions to each marker's tooltip. Off by default to limit API calls.
      </p>
    {/if}
  </section>
</nav>