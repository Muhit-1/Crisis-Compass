<script lang="ts">
  import Icon from './Icon.svelte'

  const PROFILE_URL = 'https://github.com/muhit-1'
</script>

<!--
  Cleared of MapLibre's own controls, which own the bottom-right corner: the
  zoom group ends 70px up, so this starts at 88px. Opens in a new tab so it
  never navigates away from a view someone has scrubbed to.
-->
<a
  href={PROFILE_URL}
  target="_blank"
  rel="noreferrer noopener"
  class="credit glass group absolute right-3 bottom-[5.5rem] z-30 flex items-center gap-2.5 rounded-full py-2.5 pr-5 pl-4"
  title="View muhit-1 on GitHub"
>
  <span class="text-muted transition-colors group-hover:text-accent">
    <Icon name="github" size={18} />
  </span>
  <span class="text-[15px] font-semibold text-ink">muhit-1</span>
  <span
    class="text-[13px] text-faint transition-colors group-hover:text-muted"
  >
    GitHub
  </span>
</a>

<style>
  .credit {
    transition:
      transform 160ms ease,
      border-color 160ms ease,
      box-shadow 160ms ease;
  }

  .credit:hover {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--color-accent) 55%, transparent);
    box-shadow:
      0 10px 30px -12px rgba(0, 0, 0, 0.8),
      0 0 0 1px color-mix(in srgb, var(--color-accent) 25%, transparent);
  }

  .credit:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .credit,
    .credit:hover {
      transition: none;
      transform: none;
    }
  }
</style>
