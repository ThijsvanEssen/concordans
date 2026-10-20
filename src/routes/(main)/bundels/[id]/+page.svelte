<script lang="ts">
	// A bundel on a page of its own (/bundels/<id>): the research on one page, its question at the
	// top, what it holds under it, to read and to print (A4, MapView and MapGroups say what
	// stays on paper). The bundel is read from this browser; another has none by this id.
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import { siteTitle } from '$lib/seo/server-head.svelte';
	import { kaart } from '$lib/map/map.svelte';
	import MapView from '$lib/map/MapView.svelte';
	import { BUNDLES_PATH } from '$lib/map/page';

	const shown = $derived(kaart.mappen.find((m) => m.id === page.params.id));
</script>

<RouteKop title={shown ? siteTitle(shown.naam) : undefined} />

<div class="blad blad--tekst bundel-blad">
	<nav class="stub-eyebrow" aria-label="Hoort bij"><a href={BUNDLES_PATH}>Bundels</a></nav>
	{#if shown}
		<MapView m={shown} standalone />
	{:else if browser}
		<!-- Only where the browser's bundels are read: a page served without them says nothing. -->
		<header class="blad__kop"><h1 class="blad__titel">Bundel</h1></header>
		<p class="stil">Geen bundel met dit adres in deze browser.</p>
	{/if}
</div>

<style>
	/* On paper, A4: the page alone, without the bar and the footer (the way back: frame.css). */
	@media print {
		@page {
			size: A4;
			margin: 20mm 18mm;
		}
		/* Above the bar's and the footer's own rule: the page that holds a bundel. */
		:global(body:has(.bundel-blad) .topbar),
		:global(body:has(.bundel-blad) .foot) {
			display: none;
		}
		:global(body:has(.bundel-blad) .blad-hoogte) {
			min-height: 0;
		}
		.bundel-blad {
			max-width: none;
			padding: 0;
		}
		.bundel-blad > :global(*) {
			max-width: none;
		}
		.bundel-blad :global(a) {
			color: inherit;
			text-decoration: none;
		}
		.bundel-blad :global(h1),
		.bundel-blad :global(h2),
		.bundel-blad :global(h3) {
			break-after: avoid;
		}
	}
</style>
