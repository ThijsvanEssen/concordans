<script lang="ts">
	// Ontwerpstudie ronde 5 (prototype): kleine beelden voor de verkenner, in inkt.
	export type PictoNaam = 'netwerk' | 'tekst' | 'klik' | 'dubbelklik' | 'plus' | 'sleep' | 'zoek' | 'verbindt';
	let { naam, size = 14 }: { naam: PictoNaam; size?: number } = $props();
</script>

<svg class="picto" width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
	{#if naam === 'netwerk'}
		<!-- Een bron in het midden, verbonden met drie andere soorten: blad, cirkel, driehoek. -->
		<g stroke="currentColor" stroke-width="1.1" fill="none"><path d="M8 8 3.2 3.4M8 8l4.9-4.4M8 8v4.6" /></g>
		<g fill="currentColor"><rect x="5.9" y="5.9" width="4.2" height="4.2" /><path d="M1.2 1h3l1.2 1.2v3.6H1.2z" /><circle cx="13.2" cy="3.2" r="2.1" /><path d="M8 11.6 10.4 15.5H5.6z" /></g>
	{:else if naam === 'tekst'}
		<!-- Een blad met tekstregels; in de kantlijn de verbindingen. -->
		<path d="M1.5 1h9v14h-9z" fill="none" stroke="currentColor" stroke-width="1.2" />
		<g fill="currentColor"><rect x="3.2" y="3.5" width="5.6" height="1.3" /><rect x="3.2" y="6.3" width="5.6" height="1" /><rect x="3.2" y="8.6" width="5.6" height="1" /><rect x="3.2" y="10.9" width="4" height="1" /><circle cx="13.3" cy="5" r="1.3" /><circle cx="13.3" cy="9" r="1.3" /></g>
	{:else if naam === 'klik'}
		<path d="M5 2v10l2.6-2.4L9.4 14l1.8-.8-1.8-4.3H13z" fill="currentColor" />
	{:else if naam === 'dubbelklik'}
		<path d="M5 3v9l2.4-2.2L9 13.6l1.6-.7-1.6-3.9H12z" fill="currentColor" />
		<path d="M2 3.5a5 5 0 0 1 1.5-2.2M1 6a7.5 7.5 0 0 1 1-3.3" stroke="currentColor" stroke-width="1" fill="none" />
	{:else if naam === 'plus'}
		<circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.4" /><path d="M8 4.5v7M4.5 8h7" stroke="currentColor" stroke-width="1.6" />
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
</style>
