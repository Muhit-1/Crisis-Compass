<script lang="ts">
  import { CATEGORY_STYLES } from './categoryStyles'
  import { WEATHER_LAYERS, WEATHER_MODELS, type ModelId, type WeatherLayerKey } from './weatherLayers'
  import { TEMPERATURE_UNITS, WIND_UNITS, unitsStore } from './units.svelte'

  const SHORTCUTS = [
    { what: 'Play / pause', keys: 'Space' },
    { what: 'Step ±1 hour', keys: '← →' },
    { what: 'Step ±1 day', keys: 'Shift + ← →' },
    { what: 'Jump to now', keys: 'N' },
    { what: 'Close panel', keys: 'Esc' },
  ]
  import Icon from './Icon.svelte'
  import type { IconName } from './icons'

  export type Section = 'layers' | 'categories' | 'options'

  interface Props {
    active: Set<string>
    onToggle: (id: string) => void
    showWeatherOnMap: boolean
    onToggleWeatherOnMap: () => void
    worldWeatherLayer: WeatherLayerKey | null
    onSetWorldWeatherLayer: (key: WeatherLayerKey | null) => void
    showIsobars: boolean
    onToggleIsobars: () => void
    showQuakes: boolean
    onToggleQuakes: () => void
    showAlerts: boolean
    onToggleAlerts: () => void
    quakeCount: number
    alertCount: number
    quakeError: string | null
    alertError: string | null
    quakesLoading: boolean
    alertsLoading: boolean
    /** Controlled by App so the map key and the menu can exclude each other. */
    openSection: Section | null
    onSetSection: (section: Section | null) => void
    model: ModelId
    onSetModel: (model: ModelId) => void
  }

  let {
    active,
    onToggle,
    showWeatherOnMap,
    onToggleWeatherOnMap,
    worldWeatherLayer,
    onSetWorldWeatherLayer,
    showIsobars,
    onToggleIsobars,
    showQuakes,
    onToggleQuakes,
    showAlerts,
    onToggleAlerts,
    quakeCount,
    alertCount,
    quakeError,
    alertError,
    quakesLoading,
    alertsLoading,
    openSection,
    onSetSection,
    model,
    onSetModel,
  }: Props = $props()

  /** Right-hand hint on a feed row: count, spinner text, or nothing. */
  function feedBadge(
    on: boolean,
    loading: boolean,
    count: number,
    fallback: string,
  ): string {
    if (!on) return fallback
    if (loading) return '…'
    return count ? String(count) : fallback
  }

  const categories = Object.values(CATEGORY_STYLES).sort((a, b) =>
    a.title.localeCompare(b.title),
  )

  /**
   * An icon rail with a single flyout panel — the map keeps its full width,
   * and only one section is open at a time instead of three stacked accordions
   * competing for space. Which section is open lives in App, so the map key
   * can close the menu and vice versa.
   */
  const RAIL: { id: Section; icon: IconName; label: string }[] = [
    { id: 'layers', icon: 'layers', label: 'Weather layers' },
    { id: 'categories', icon: 'list', label: 'Event categories' },
    { id: 'options', icon: 'sliders', label: 'Options' },
  ]

  function toggleSection(section: Section) {
    onSetSection(openSection === section ? null : section)
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
    if (event.key === 'Escape') onSetSection(null)
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!--
  Pinned to the upper left, with the flyout opening rightward.

  Top-aligned rather than vertically centred: the bottom-left column (ticker,
  legends, map key) grows upward, and a centred rail sat right in its path —
  opening the map key covered the menu.
-->
<!-- z-40: above the bottom-left legend stack, so an open menu is never the thing
     that gets covered. The rail itself sits clear of that stack entirely. -->
<div class="absolute top-28 left-3 z-40 flex items-start gap-2">
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

  {#if openSection}
    <div
      class="glass flex max-h-[calc(100vh-10rem)] w-60 flex-col overflow-hidden rounded-2xl"
    >
      <div class="flex items-center justify-between px-3 pt-2.5 pb-1.5">
        <h2 class="text-[12px] font-semibold tracking-wider text-muted uppercase">
          {RAIL.find((r) => r.id === openSection)?.label}
        </h2>
        <button
          type="button"
          onclick={() => onSetSection(null)}
          class="text-muted transition-colors hover:text-ink"
          aria-label="Close panel"
        >
          <Icon name="close" size={13} />
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-2.5">
        {#if openSection === 'layers'}
          <!--
            One list, not two controls. The base map isn't independently
            selectable any more: picking a weather layer implies the dark map,
            because saturated data over the pastel political map is unreadable.
            "Simple" is just the no-overlay resting state.
          -->
          <div class="flex flex-col gap-0.5">
            <button
              type="button"
              onclick={() => onSetWorldWeatherLayer(null)}
              class={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                worldWeatherLayer === null
                  ? 'bg-accent/20 text-accent'
                  : 'text-ink hover:bg-panel-2'
              }`}
            >
              <Icon name="layers" size={15} />
              <span class="min-w-0 flex-1 truncate">Simple</span>
              <span class="shrink-0 text-[11px] text-faint">Political map</span>
            </button>

            <div class="my-1 h-px bg-edge/60"></div>

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
                  <span class="shrink-0 text-[11px] text-faint">{option.hint}</span>
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
              <span class="shrink-0 text-[11px] text-faint">4 hPa</span>
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

          <p class="mt-2 px-2 text-[12px] leading-relaxed text-faint">
            Weather from Open-Meteo (DWD ICON). Any layer switches the base map to
            the dark one so the data stays readable.
          </p>
        {:else if openSection === 'categories'}
          <!-- Independent hazard feeds, above the EONET category filter. -->
          <p class="mb-1 px-2 text-[12px] font-semibold tracking-wider text-faint uppercase">
            Live feeds
          </p>
          <div class="mb-2 flex flex-col gap-0.5">
            <label
              class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink transition-colors hover:bg-panel-2"
            >
              <input
                type="checkbox"
                checked={showQuakes}
                onchange={onToggleQuakes}
                class="h-3.5 w-3.5 accent-accent"
              />
              <Icon name="earthquakes" size={15} class="text-muted" />
              <span class="min-w-0 flex-1 truncate">Earthquakes</span>
              <span class="shrink-0 text-[11px] text-faint tabular-nums">
                {feedBadge(showQuakes, quakesLoading, quakeCount, 'USGS')}
              </span>
            </label>
            {#if showQuakes && quakeError}
              <p class="px-2 pb-1 text-[12px] leading-snug text-sev-high">{quakeError}</p>
            {/if}

            <label
              class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink transition-colors hover:bg-panel-2"
            >
              <input
                type="checkbox"
                checked={showAlerts}
                onchange={onToggleAlerts}
                class="h-3.5 w-3.5 accent-accent"
              />
              <Icon name="pulse" size={15} class="text-muted" />
              <span class="min-w-0 flex-1 truncate">Disaster alerts</span>
              <span class="shrink-0 text-[11px] text-faint tabular-nums">
                {feedBadge(showAlerts, alertsLoading, alertCount, 'GDACS')}
              </span>
            </label>
            {#if showAlerts && alertError}
              <p class="px-2 pb-1 text-[12px] leading-snug text-sev-high">{alertError}</p>
            {/if}
          </div>

          <div class="mb-1.5 border-t border-edge/60 pt-2"></div>

          <p class="mb-1 px-2 text-[12px] font-semibold tracking-wider text-faint uppercase">
            NASA EONET
          </p>

          <div class="mb-1.5 flex items-center justify-between px-2">
            <span class="text-[12px] text-faint tabular-nums">
              {activeCount}/{categories.length} shown
            </span>
            <div class="flex items-center gap-1.5 text-[12px] font-medium text-muted">
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
          <p class="mt-1 px-2 text-[12px] leading-relaxed text-faint">
            Adds live conditions to each marker's tooltip. Off by default to limit API calls.
          </p>

          <div class="mt-3 border-t border-edge/60 pt-2">
            <p class="mb-1 px-2 text-[11px] font-semibold tracking-wider text-faint uppercase">
              Forecast model
            </p>
            <div class="flex flex-col gap-0.5">
              {#each WEATHER_MODELS as option (option.id)}
                <button
                  type="button"
                  onclick={() => onSetModel(option.id)}
                  class={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                    model === option.id
                      ? 'bg-accent/20 text-accent'
                      : 'text-ink hover:bg-panel-2'
                  }`}
                >
                  <span class="min-w-0 flex-1 truncate">{option.label}</span>
                  <span class="shrink-0 text-[11px] text-faint">{option.hint}</span>
                </button>
              {/each}
            </div>
          </div>

          <div class="mt-3 border-t border-edge/60 pt-2">
            <p class="mb-1 px-2 text-[11px] font-semibold tracking-wider text-faint uppercase">
              Units
            </p>

            <div class="mb-1.5 flex items-center gap-2 px-2">
              <span class="w-20 shrink-0 text-[12px] text-muted">Temperature</span>
              <div class="flex flex-1 gap-1 rounded-lg bg-panel-2/70 p-0.5">
                {#each TEMPERATURE_UNITS as option (option.key)}
                  <button
                    type="button"
                    onclick={() => unitsStore.setTemperature(option.key)}
                    class={`flex-1 rounded-md px-1.5 py-1 text-[12px] font-medium transition-colors ${
                      unitsStore.temperature === option.key
                        ? 'bg-accent/25 text-accent'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    {option.label}
                  </button>
                {/each}
              </div>
            </div>

            <div class="flex items-center gap-2 px-2">
              <span class="w-20 shrink-0 text-[12px] text-muted">Wind</span>
              <div class="flex flex-1 gap-1 rounded-lg bg-panel-2/70 p-0.5">
                {#each WIND_UNITS as option (option.key)}
                  <button
                    type="button"
                    onclick={() => unitsStore.setWind(option.key)}
                    class={`flex-1 rounded-md px-1.5 py-1 text-[12px] font-medium transition-colors ${
                      unitsStore.wind === option.key
                        ? 'bg-accent/25 text-accent'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    {option.label}
                  </button>
                {/each}
              </div>
            </div>
          </div>

          <div class="mt-3 border-t border-edge/60 pt-2">
            <p class="mb-1 px-2 text-[11px] font-semibold tracking-wider text-faint uppercase">
              Shortcuts
            </p>
            <dl class="space-y-0.5 px-2 text-[12px]">
              {#each SHORTCUTS as row (row.keys)}
                <div class="flex items-center justify-between gap-2">
                  <dt class="text-muted">{row.what}</dt>
                  <dd class="shrink-0 font-mono text-[11px] text-faint">{row.keys}</dd>
                </div>
              {/each}
            </dl>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
