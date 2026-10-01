<script lang="ts">
	// Ontwerpstudie ronde 5 (prototype): kleine beelden voor de verkenner, in inkt.
	export type PictoNaam = 'netwerk' | 'tekst' | 'klik' | 'dubbelklik' | 'plus' | 'sleep' | 'zoek' | 'verbindt' | 'omgeving';
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
	{#if naam === 'netwerk'}
		<!-- Ronde 6: drie bronnen en hun verbindingen, met de tekens van regel en uitspraak. -->
		<path d="M7 6.4 4.4 10.6M9 6.4l2.6 4.2M5.6 12.6h4.8" fill="none" stroke-width="1.2" />
		<rect x="6.1" y="1.6" width="3.8" height="3.8" class="vol" />
		<circle cx="3.4" cy="12.6" r="2" class="vol" />
		<circle cx="12.6" cy="12.6" r="2" class="vol" />
	{:else if naam === 'tekst'}
		<!-- Ronde 6: een blad met een omgevouwen hoek en drie regels. -->
		<path d="M3.5 1.5h6l3 3v10h-9z" fill="none" />
		<path d="M9.5 1.5v3h3" fill="none" />
		<path d="M5.7 8h4.6M5.7 10.5h4.6M5.7 13h2.8" fill="none" stroke-width="1.2" />
	{:else if naam === 'klik'}
		<path d="M5 2v10l2.6-2.4L9.4 14l1.8-.8-1.8-4.3H13z" fill="currentColor" />
	{:else if naam === 'dubbelklik'}
		<path d="M5 3v9l2.4-2.2L9 13.6l1.6-.7-1.6-3.9H12z" fill="currentColor" />
		<path d="M2 3.5a5 5 0 0 1 1.5-2.2M1 6a7.5 7.5 0 0 1 1-3.3" stroke="currentColor" stroke-width="1" fill="none" />
	{:else if naam === 'plus'}
		<circle cx="8" cy="8" r="6.3" fill="none" /><path d="M8 5v6M5 8h6" fill="none" />
	{:else if naam === 'omgeving'}
		<!-- Ronde 6: één bron met de kring eromheen die een dubbelklik toont. -->
		<circle cx="8" cy="8" r="2.4" class="vol" />
		<circle cx="8" cy="8" r="6.2" fill="none" stroke-dasharray="2 2.2" />
	{:else if naam === 'sleep'}
		<path d="M8 1.5v13M1.5 8h13M8 1.5 6 3.5M8 1.5l2 2M8 14.5l-2-2M8 14.5l2-2M1.5 8l2-2M1.5 8l2 2M14.5 8l-2-2M14.5 8l-2 2" stroke="currentColor" stroke-width="1.2" fill="none" />
	{:else if naam === 'zoek'}
		<circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="m10.4 10.4 4 4" stroke="currentColor" stroke-width="1.6" />
	{:else}
		<g stroke="currentColor" stroke-width="1.2"><path d="M2.5 8h11" /></g>
		<g fill="currentColor"><rect x="1" y="6" width="4" height="4" /><rect x="11" y="6" width="4" height="4" /></g>
		<circle cx="8" cy="8" r="2.2" fill="var(--paper)" stroke="currentColor" stroke-width="1.3" />
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
