<script lang="ts">
	// Kleine beelden voor de verkenner, in inkt.
	type PictoNaam =
		| 'netwerk'
		| 'netwerk-o'
		| 'bewaar'
		| 'bewaard'
		| 'tekst'
		| 'plus'
		| 'omgeving'
		| 'tick';
	let { naam, size = 14 }: { naam: PictoNaam; size?: number } = $props();
</script>

<svg
	class="picto"
	width={size}
	height={size}
	viewBox="0 0 16 16"
	fill="none"
	stroke="currentColor"
	stroke-width="1.4"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if naam === 'netwerk' || naam === 'netwerk-o'}
		<!-- Drie bronnen en hun verbindingen, met de tekens van regel en uitspraak; open (-o)
		     as a bookmark is open: not yet in the network. -->
		<path d="M7 6.4 4.4 10.6M9 6.4l2.6 4.2M5.6 12.6h4.8" fill="none" stroke-width="1.2" />
		<rect x="6.1" y="1.6" width="3.8" height="3.8" class:vol={naam === 'netwerk'} />
		<circle cx="3.4" cy="12.6" r="2" class:vol={naam === 'netwerk'} />
		<circle cx="12.6" cy="12.6" r="2" class:vol={naam === 'netwerk'} />
	{:else if naam === 'bewaar' || naam === 'bewaard'}
		<!-- A bookmark: open to keep, filled once kept. -->
		<path d="M4.5 1.8h7v12.4L8 11.3l-3.5 2.9z" class:vol={naam === 'bewaard'} />
	{:else if naam === 'tekst'}
		<!-- Een blad met een omgevouwen hoek en drie regels. -->
		<path d="M3.5 1.5h6l3 3v10h-9z" fill="none" />
		<path d="M9.5 1.5v3h3" fill="none" />
		<path d="M5.7 8h4.6M5.7 10.5h4.6M5.7 13h2.8" fill="none" stroke-width="1.2" />
	{:else if naam === 'tick'}
		<!-- The choice made in a menu: the bundel Bewaar keeps in. -->
		<path d="M3.5 8.4 6.6 11.4 12.5 4.8" fill="none" />
	{:else if naam === 'plus'}
		<circle cx="8" cy="8" r="6.3" fill="none" /><path d="M8 5v6M5 8h6" fill="none" />
	{:else}
		<!-- omgeving: één bron met de kring eromheen die een dubbelklik toont. -->
		<circle cx="8" cy="8" r="2.4" class="vol" />
		<circle cx="8" cy="8" r="6.2" fill="none" stroke-dasharray="2 2.2" />
	{/if}
</svg>

<style>
	.picto {
		flex: none;
		color: currentColor;
	}
	.vol {
		fill: currentColor;
		stroke: none;
	}
</style>
