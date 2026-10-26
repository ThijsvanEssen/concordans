<script lang="ts">
	// Kleine beelden voor de verkenner, in inkt.
	type PictoNaam = 'netwerk' | 'netwerk-o' | 'bewaar' | 'bewaard' | 'tekst' | 'tick';
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
		<!-- Een kring: één bron en zijn buren; open (-o) as a bookmark is open: not yet in the
		     network. -->
		<path d="M6.5 6.6 4.4 4.9M9.7 7.1l2-1.4M7 9.7l-1.3 2.2" fill="none" stroke-width="1.2" />
		<circle cx="8" cy="8" r="2.2" class:vol={naam === 'netwerk'} />
		<circle cx="3.2" cy="3.8" r="1.5" class:vol={naam === 'netwerk'} />
		<circle cx="12.8" cy="4.8" r="1.5" class:vol={naam === 'netwerk'} />
		<circle cx="5" cy="13.2" r="1.5" class:vol={naam === 'netwerk'} />
	{:else if naam === 'bewaar' || naam === 'bewaard'}
		<!-- A bookmark: open to keep, filled once kept. -->
		<path d="M4.5 1.8h7v12.4L8 11.3l-3.5 2.9z" class:vol={naam === 'bewaard'} />
	{:else if naam === 'tekst'}
		<!-- Regels: een kop en drie regels. -->
		<path d="M2.5 3.2h6.5" stroke-width="2" />
		<path d="M2.5 7h11M2.5 10h11M2.5 13h7.5" stroke-width="1.2" />
	{:else if naam === 'tick'}
		<!-- The choice made in a menu: the bundel Bewaar keeps in. -->
		<path d="M3.5 8.4 6.6 11.4 12.5 4.8" fill="none" />
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
