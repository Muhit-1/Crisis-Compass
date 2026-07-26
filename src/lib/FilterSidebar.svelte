<script lang="ts">
  import { CATEGORY_STYLES } from './categoryStyles'
  import { WEATHER_LAYERS, type WeatherLayerKey } from './weatherLayers'
  import { BASEMAP_OPTIONS, type BasemapKey } from './basemaps'
  import Icon from './Icon.svelte'
  import type { IconName } from './icons'

  interface Props {
    active: Set<string>
    onToggle: (id: string) => void
    showWeatherOnMap: boolean
    onToggleWeatherOnMap: () => void
    worldWeatherLayer: WeatherLayerKey | null
    onSetWorldWeatherLayer: (key: WeatherLayerKey | null) => void
    basemap: BasemapKey
    onSetBasemap: (key: BasemapKey) => void
    showIsobars: boolean
    onToggleIsobars: () => void
  }

  let {
    active,
    onToggle,
    showWeatherOnMap,
    onToggleWeatherOnMap,
    worldWeatherLayer,
    onSetWorldWeatherLayer,
    basemap,
    onSetBasemap,
    showIsobars,
    onToggleIsobars,
  }: Props = $props()

  const categories = Object.values(CATEGORY_STYLES).sort((a, b) =>
    a.title.localeCompare(b.title),
  )

  /**
   * The sidebar is now an icon rail pinned to the right edge with a single
   * flyout panel — the map keeps its full width, and only one section is open
   * at a time instead of three stacked accordions competing for space.
   */
  type Section = 'layers' | 'categories' | 'options'

  const RAIL: { id: Section; icon: IconName; label: string }[] = [
    { id: 'layers', icon: 'layers', label: 'Weather layers' },
    { id: 'categories', icon: 'list', label: 'Event categories' },
    { id: 'options', icon: 'sliders', label: 'Options' },
  ]

  let openSection = $state<Section | null>(null)

  function toggleSection(section: Section) {
    openSection = openSection === section ? null : section
  }

  const allActive = $derived(categories.every((c) => active.has(c.id)))
  const noneActive = $derived(categories.every((c) => !active.has(c.id)))
  const activeCount = $derived(categories.filter((c) => active.has(c.id)).length)

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

  // Rows shown for visual parity with reference weather sites (Zoom.earth-style
  // layer picker) but not yet backed by a free data source in this app. Kept
  // visible-but-disabled rather than hidden, so the menu reads the same way
  // at a glance and it's obvious these are "not wired up", not "missing".
  interface PlaceholderLayer {
    label: string
    iconName: IconName
  }
  const PLACEHOLDERS: PlaceholderLayer[] = [
    { label: 'Satellite', iconName: 'satellite' },
    { label: 'Radar', iconName: 'radar' },
  ]

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') openSection = null
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="absolute top-1/2 right-3 z-30 flex -translate-y-1/2 items-start gap-2">
  {#if openSection}
    <div
      class="glass flex max-h-[70vh] w-60 flex-col overflow-hidden rounded-2xl"
    >
      <div class="flex items-center justify-between px-3 pt-2.5 pb-1.5">
        <h2 class="text-[11px] font-semibold tracking-wider text-muted uppercase">
          {RAIL.find((r) => r.id === openSection)?.label}
        </h2>
        <button
          type="button"
          onclick={() => (openSection = null)}
          class="text-muted transition-colors hover:text-ink"
          aria-label="Close panel"
        >
          <Icon name="close" size={13} />
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-2.5">
        {#if openSection === 'layers'}
          <div class="mb-2 px-2">
            <p class="mb-1 text-[10px] font-semibold tracking-wider text-faint uppercase">
              Base map
            </p>
            <div class="flex gap-1 rounded-lg bg-panel-2/70 p-0.5">
              {#each BASEMAP_OPTIONS as option (option.key)}
                <button
                  type="button"
                  onclick={() => onSetBasemap(option.key)}
                  title={option.description}
                  class={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                    basemap === option.key
                      ? 'bg-accent/25 text-accent'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  {option.label}
                </button>
              {/each}
            </div>
          </div>

          <p class="mb-1 px-2 text-[10px] font-semibold tracking-wider text-faint uppercase">
            Weather overlay
          </p>
          <div class="flex flex-col gap-0.5">
            {#each WEATHER_LAYERS as option (option.key)}
              <button
                type="button"
                onclick={() => selectWeatherLayer(option.key)}
                class={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                  worldWeatherLayer === option.key
                    ? 'bg-accent/20 text-accent'
                    : 'text-ink hover:bg-panel-2'
                }`}
              >
                <Icon name={option.iconName} size={15} />
                <span class="min-w-0 flex-1 truncate">{option.label}</span>
                {#if option.hint}
                  <span class="shrink-0 text-[9px] text-faint">{option.hint}</span>
                {/if}
              </button>
            {/each}
          </div>

          <div class="mt-2 border-t border-edge/60 pt-2">
            <label
              class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink transition-colors hover:bg-panel-2"
            >
              <input
                type="checkbox"
                checked={showIsobars}
                onchange={onToggleIsobars}
                class="h-3.5 w-3.5 accent-accent"
              />
              <Icon name="pressure" size={15} class="text-muted" />
              <span class="min-w-0 flex-1 truncate">Pressure isobars</span>
              <span class="shrink-0 text-[9px] text-faint">4 hPa</span>
            </label>

            {#each PLACEHOLDERS as layer (layer.label)}
              <div
                class="flex cursor-not-allowed items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-faint"
                title="Not available on the free tier yet"
              >
                <Icon name={layer.iconName} size={15} />
                <span class="truncate">{layer.label}</span>
              </div>
            {/each}
          </div>

          <p class="mt-2 px-2 text-[10px] leading-relaxed text-faint">
            Global overlay from Open-Meteo (DWD ICON model). Wind shows speed with
            direction arrows.
          </p>
        {:else if openSection === 'categories'}
          <div class="mb-1.5 flex items-center justify-between px-2">
            <span class="text-[10px] text-faint tabular-nums">
              {activeCount}/{categories.length} shown
            </span>
            <div class="flex items-center gap-1.5 text-[10px] font-medium text-muted">
              <button
                type="button"
                onclick={selectAll}
                disabled={allActive}
                class="transition-colors hover:text-ink disabled:opacity-40"
              >
                All
              </button>
              <span class="text-faint">·</span>
              <button
                type="button"
                onclick={selectNone}
                disabled={noneActive}
                class="transition-colors hover:text-ink disabled:opacity-40"
              >
                None
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-0.5">
            {#each categories as category (category.id)}
              <label
                class={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                  active.has(category.id)
                    ? 'bg-panel-2 text-ink'
                    : 'text-muted hover:bg-panel-2/60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={active.has(category.id)}
                  onchange={() => onToggle(category.id)}
                  class="h-3.5 w-3.5 accent-accent"
                />
                <span style={`color:${category.color}`}>
                  <Icon name={category.iconName} size={15} />
                </span>
                <span class="truncate">{category.title}</span>
              </label>
            {/each}
          </div>
        {:else}
          <label
            class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink transition-colors hover:bg-panel-2"
          >
            <input
              type="checkbox"
              checked={showWeatherOnMap}
              onchange={onToggleWeatherOnMap}
              class="h-3.5 w-3.5 accent-accent"
            />
            <Icon name="thermometer" size={15} class="text-muted" />
            <span>Weather on hover</span>
          </label>
          <p class="mt-1 px-2 text-[10px] leading-relaxed text-faint">
            Adds live conditions to each marker's tooltip. Off by default to limit API calls.
          </p>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Icon rail -->
  <nav class="glass flex flex-col gap-1 rounded-2xl p-1.5">
    {#each RAIL as item (item.id)}
      <button
        type="button"
        onclick={() => toggleSection(item.id)}
        aria-label={item.label}
        aria-pressed={openSection === item.id}
        title={item.label}
        class={`relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
          openSection === item.id
            ? 'bg-accent/20 text-accent'
            : 'text-muted hover:bg-panel-2 hover:text-ink'
        }`}
      >
        <Icon name={item.icon} size={17} />
        {#if item.id === 'layers' && worldWeatherLayer}
          <span class="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-accent"></span>
        {/if}
      </button>
    {/each}
  </nav>
</div>
