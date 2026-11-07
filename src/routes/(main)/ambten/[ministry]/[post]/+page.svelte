<script lang="ts">
	// An office of a ministry (/ambten/jenv/minister): OfficePage, as under a portfolio.
	import { page } from '$app/state';
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import { siteTitle } from '$lib/seo/server-head.svelte';
	import OfficePage from '$lib/offices/OfficePage.svelte';
	import { seatOf } from '$lib/offices/office';

	let title = $state<string>();
</script>

<RouteKop title={title ? siteTitle(title) : undefined} />
<div class="blad blad--tekst">
	<OfficePage seat={seatOf(page.params.ministry, page.params.post)} bind:title />
</div>
