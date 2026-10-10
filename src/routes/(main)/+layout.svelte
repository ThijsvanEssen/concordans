<script lang="ts">
	import type { Snippet } from 'svelte';
	import SiteFooter from '$lib/components/layout/SiteFooter.svelte';
	let { children }: { children?: Snippet } = $props();
</script>

<!-- At least a screen high, so the footer starts under the fold: when the server's page gives
     way to the app, or a list is still on its way, the footer does not jump into view (live,
     10 Oct: 0.22 to 0.37 of layout shift on every page, all of it the footer). -->
<div class="blad-hoogte">{@render children?.()}</div>
<SiteFooter />

<style>
	.blad-hoogte {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		min-height: 100dvh;
	}
</style>
