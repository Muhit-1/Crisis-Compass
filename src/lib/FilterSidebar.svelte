<script lang="ts">
  import { CATEGORY_STYLES } from './categoryStyles'
  import Icon from './Icon.svelte'

  interface Props {
    active: Set<string>
    onToggle: (id: string) => void
  }

  let { active, onToggle }: Props = $props()

  const categories = Object.values(CATEGORY_STYLES)
</script>

<nav
  class="flex w-44 shrink-0 flex-col gap-1 overflow-y-auto border-r border-[#E8E0CC] bg-[#FFFDF8] p-3"
>
  <h2 class="mb-1 text-xs font-semibold tracking-wide text-[#8A8473] uppercase">Categories</h2>
  {#each categories as category (category.id)}
    <label
      class="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-[#33394A] hover:bg-[#FAF6EC]"
    >
      <input
        type="checkbox"
        checked={active.has(category.id)}
        onchange={() => onToggle(category.id)}
        class="accent-[#33394A]"
      />
      <span style={`color:${category.color}`}>
        <Icon name={category.iconName} size={15} />
      </span>
      <span>{category.title}</span>
    </label>
  {/each}
</nav>
