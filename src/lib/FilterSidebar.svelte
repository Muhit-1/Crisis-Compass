<script lang="ts">
  import { CATEGORY_STYLES } from './categoryStyles'
  import { WEATHER_LAYER_OPTIONS, type WeatherLayerKey } from './weatherLayers'
  import Icon from './Icon.svelte'
  import type { IconName } from './icons'

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
  let weatherMapsOpen = $state(true)
  let tooltipWeatherOpen = $state(true)

  const allActive = $derived(categories.every((c) => active.has(c.id)))
  const noneActive = $derived(categories.every((c) => !active.has(c.id)))

  function selectAll() {
    for (const c of categories) if (!active.has(c.id)) onToggle(c.id)
  }
  function selectNone() {
    for (const c of categories) if (active.has(c.id)) onToggle(c.id)
  }

  /** Clicking the already-active layer turns the overlay off — single-select with toggle-off. */
  function selectWeatherLayer(key: WeatherLayerKey) {
    onSetWorldWeatherLayer(worldWeatherLayer === key ? null : key)
  }

  const LAYER_ICON: Record<WeatherLayerKey, IconName> = {
    temp_new: 'thermometer',
    clouds_new: 'cloudsLayer',
    precipitation_new: 'rain',
    wind_new: 'wind',
  }

  // Rows shown for visual parity with reference weather sites (Zoom.earth-style
  // layer picker) but not yet backed by a free data source in this app. Kept
  // visible-but-disabled rather than hidden, so the menu reads the same way
  // at a glance and it's obvious these are "not wired up", not "missing".
  interface PlaceholderLayer {
    label: string
    iconName: IconName
  }
  const TOP_PLACEHOLDERS: PlaceholderLayer[] = [
    { label: 'Satellite', iconName: 'satellite' },
    { label: 'Radar', iconName: 'radar' },
  ]
  const BOTTOM_PLACEHOLDERS: PlaceholderLayer[] = [
    { label: 'Humidity', iconName: 'humidity' },
    { label: 'Pressure', iconName: 'pressure' },
  ]
</script>

<nav class="flex w-56 shrink-0 flex-col gap-3 overflow-y-auto border-r border-[#E8E0CC] bg-[#FFFDF8] p-3">
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
          <label
            class={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors ${
              active.has(category.id)
                ? 'bg-[#FAF6EC] text-[#33394A]'
                : 'text-[#8A8473] hover:bg-[#FAF6EC]'
            }`}
          >
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

  <!-- Weather maps — styled after Zoom.earth's left-hand layer picker:
       a flat list of layers, icon-led, single active selection highlighted. -->
  <section class="border-t border-[#E8E0CC] pt-3">
    <button
      type="button"
      onclick={() => (weatherMapsOpen = !weatherMapsOpen)}
      class="flex w-full items-center justify-between text-xs font-semibold tracking-wide text-[#8A8473] uppercase"
    >
      Weather Maps
      <Icon name={weatherMapsOpen ? 'chevronUp' : 'chevronDown'} size={12} />
    </button>

    {#if weatherMapsOpen}
      <div class="mt-1.5 flex flex-col gap-0.5">
        {#each TOP_PLACEHOLDERS as layer (layer.label)}
          <div
            class="flex cursor-not-allowed items-center gap-2 rounded-md px-2 py-1 text-sm text-[#C9C2AC]"
            title="Not available on the free tier yet"
          >
            <Icon name={layer.iconName} size={15} />
            <span class="truncate">{layer.label}</span>
          </div>
        {/each}

        {#each WEATHER_LAYER_OPTIONS as option (option.key)}
          <button
            type="button"
            onclick={() => selectWeatherLayer(option.key)}
            class={`flex items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors ${
              worldWeatherLayer === option.key
                ? 'bg-[#33394A] text-white'
                : 'text-[#33394A] hover:bg-[#FAF6EC]'
            }`}
          >
            <Icon name={LAYER_ICON[option.key]} size={15} />
            <span class="truncate">{option.label}</span>
          </button>
        {/each}

        {#each BOTTOM_PLACEHOLDERS as layer (layer.label)}
          <div
            class="flex cursor-not-allowed items-center gap-2 rounded-md px-2 py-1 text-sm text-[#C9C2AC]"
            title="Not available on the free tier yet"
          >
            <Icon name={layer.iconName} size={15} />
            <span class="truncate">{layer.label}</span>
          </div>
        {/each}
      </div>

      <p class="mt-1.5 px-2 text-[10px] text-[#8A8473]">
        Live global overlay from Open-Meteo (DWD ICON model) — separate from the per-event weather below.
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
      <label class="mt-1.5 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm text-[#33394A] hover:bg-[#FAF6EC]">
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