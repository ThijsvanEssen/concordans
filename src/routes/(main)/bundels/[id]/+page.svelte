<script lang="ts">
	// A bundel on a page of its own (/bundels/<id>): the place to work in it, to read it and
	// to print it (MapView, A4). The bundel is read from this browser; another has none by
	// this id.
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import { siteTitle } from '$lib/seo/server-head.svelte';
	import { kaart } from '$lib/map/map.svelte';
	import MapView from '$lib/map/MapView.svelte';
	import { BUNDLES_PATH, takeUnnamed } from '$lib/map/page';

	const shown = $derived(kaart.mappen.find((m) => m.id === page.params.id));
</script>

<RouteKop title={shown ? siteTitle(shown.naam) : undefined} />

<div class="blad blad--tekst">
	<nav class="stub-eyebrow" aria-label="Hoort bij"><a href={BUNDLES_PATH}>Bundels</a></nav>
	{#if shown}
		{#key shown.id}
			<MapView m={shown} named={!takeUnnamed(shown.id)} />
		{/key}
	{:else if browser}
		<!-- Only where the browser's bundels are read: a page served without them says nothing. -->
		<header class="blad__kop"><h1 class="blad__titel">Bundel</h1></header>
		<p class="stil">Geen bundel met dit adres in deze browser.</p>
	{/if}
</div>
