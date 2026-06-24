<script lang="ts">
  import MapView from './lib/MapView.svelte'
</script>

<div class="flex h-screen w-screen flex-col bg-[#FAF6EC]">
  <header
    class="flex items-center justify-between border-b border-[#E8E0CC] bg-[#FFFDF8] px-4 py-2"
  >
    <h1 class="text-base font-semibold text-[#33394A]">🧭 Crisis Compass</h1>
    <span class="text-xs text-[#8A8473]">Live natural events — NASA EONET</span>
  </header>

  <main class="relative flex-1">
    <MapView />
  </main>
</div>
