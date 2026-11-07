<script lang="ts">
	// An office under a portfolio (/ambten/-/minister/werk-en-participatie): AmbtPagina.
	import { page } from '$app/state';
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import { siteTitle } from '$lib/seo/server-head.svelte';
	import AmbtPagina from '$lib/ambten/AmbtPagina.svelte';
	import { seatOf } from '$lib/ambten/ambt';

	let title = $state<string>();
</script>

<RouteKop title={title ? siteTitle(title) : undefined} />
<AmbtPagina
	seat={seatOf(page.params.ministerie, page.params.post, page.params.portefeuille)}
	bind:title
/>
