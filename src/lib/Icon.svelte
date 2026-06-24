<script lang="ts">
  import { ICONS, type IconName } from './icons'

  interface Props {
    name: IconName
    size?: number
    strokeWidth?: number
    class?: string
  }

  let { name, size = 16, strokeWidth = 1.7, class: className = '' }: Props = $props()
</script>

<svg
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  class={className}
  aria-hidden="true"
  focusable="false"
>
  {@html ICONS[name]}
</svg>
