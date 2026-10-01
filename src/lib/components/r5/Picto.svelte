<script lang="ts">
	// Ontwerpstudie ronde 5 (prototype): kleine beelden voor de verkenner, in inkt.
	export type PictoNaam = 'netwerk' | 'tekst' | 'klik' | 'dubbelklik' | 'plus' | 'sleep' | 'zoek' | 'verbindt';
	let { naam, size = 14 }: { naam: PictoNaam; size?: number } = $props();
</script>

<svg class="picto" width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
	{#if naam === 'netwerk'}
		<g stroke="currentColor" stroke-width="1.2" fill="none"><path d="M8 8 3 3.5M8 8l5-4.5M8 8l-4.5 5M8 8l5 5" /></g>
		<g fill="currentColor"><rect x="6" y="6" width="4" height="4" /><circle cx="3" cy="3" r="2" /><circle cx="13" cy="3" r="2" /><circle cx="3" cy="13" r="2" /><circle cx="13" cy="13" r="2" /></g>
	{:else if naam === 'tekst'}
		<g fill="currentColor"><rect x="1.5" y="2" width="8" height="2" /><rect x="1.5" y="6" width="9" height="1.4" /><rect x="1.5" y="9" width="9" height="1.4" /><rect x="1.5" y="12" width="7" height="1.4" /><circle cx="13.5" cy="7" r="1.4" /><circle cx="13.5" cy="11" r="1.4" /></g>
		<path d="M12 2v13" stroke="currentColor" stroke-width="0.8" opacity="0.5" />
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
