<script lang="ts">
	// An office of a ministry (/ambten/jenv/minister): AmbtPagina, as under a portfolio.
	import { page } from '$app/state';
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import { siteTitle } from '$lib/seo/server-head.svelte';
	import AmbtPagina from '$lib/ambten/AmbtPagina.svelte';
	import { seatOf } from '$lib/ambten/ambt';

	let title = $state<string>();
</script>

<RouteKop title={title ? siteTitle(title) : undefined} />
<AmbtPagina seat={seatOf(page.params.ministerie, page.params.post)} bind:title />
