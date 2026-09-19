<script lang="ts">
  import type { Snippet } from 'svelte';
  import SiteFooter from '$lib/components/layout/SiteFooter.svelte';
  let { children }: { children?: Snippet } = $props();
</script>

{@render children?.()}
<SiteFooter />
