<script lang="ts">
	// To the layer Noemt, under all the rest (Thijs, 5 Nov: "Ja, verwijzing"). It comes in late
	// with the wetten that name the law; its place is kept on a phone, so nothing moves for it.
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import { formatCount } from '$lib/text/getal';
	import { plural } from '$lib/text/words';
	import type { ChainLayer } from '$lib/network/chain';

	let { layer, rest = 0 }: { layer?: ChainLayer; rest?: number } = $props();

	/** Those the layer draws and those under its "N andere". */
	const count = $derived((layer?.nodes.length ?? 0) + rest);

	/** The first bron of the layer, in the drawing or the list, whichever shows: in view, focused. */
	function jump(e: MouseEvent) {
		const first = [
			...(e.currentTarget as Element)
				.closest('.chain')!
				.querySelectorAll<HTMLElement>(
					'g.node[data-layer="named"], .list__layer[aria-label="Noemt"] .list__row'
				)
		].find((el) => el.getClientRects().length);
		first?.focus({ preventScroll: true });
		first?.scrollIntoView({ block: 'center', inline: 'center' });
	}
</script>

<span class="mentions-link">
	{#if count}<TekstLink onclick={jump}
			>Genoemd in {formatCount(count)} {plural(count, 'wet', 'wetten')}</TekstLink
		>{/if}
</span>

<style>
	@media (max-width: 768px) {
		/* A row of a finger's 44 px, clear of the target of the link above it. */
		.mentions-link {
			display: flex;
			flex-basis: 100%;
			align-items: center;
			min-height: calc(var(--s-6) + var(--s-3));
			margin-top: var(--s-2);
		}
	}
</style>
