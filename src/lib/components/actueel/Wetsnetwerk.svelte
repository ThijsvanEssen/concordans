<script lang="ts">
	// The network of the last passed bill as the small network of Verbonden draws it (Netwerk
	// tonen): the changed article in its law, one step out, the dossier as a hull with whom
	// leads it (home-network). Read only: a bron opens the real network with it. The drawing is a chunk of
	// its own, asked after the first paint of the page; if it does not come, the line under it
	// is still the way in.
	import { goto } from '$app/navigation';
	import { onMount, type Component } from 'svelte';
	import { report } from '$lib/api/errors';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { exploreHref } from '$lib/bron/address';
	import { langeDatum } from '$lib/text/datum';
	import { CHAMBER_NAME } from '$lib/components/parliamentary/chamber';
	import type { Sketch } from '$lib/verbonden/sketch';
	import type { Schets } from './wetsnetwerk';

	type TekeningProps = {
		sketch: Sketch;
		name: string;
		onSingle: (id: string) => void;
		onGroup: (id: string) => void;
	};
	let { schets }: { schets: Schets } = $props();

	const k = $derived(schets.kandidaat);
	let kaart = $state.raw<{ Tekening: Component<TekeningProps>; sketch: Sketch } | 'fout' | null>(
		null
	);

	let weg = false;
	let fout = $state.raw<unknown>(null);
	function laad() {
		kaart = null;
		Promise.all([import('$lib/verbonden/NetworkSketch.svelte'), import('./home-network')])
			.then(async ([ns, sn]) => {
				const sketch = await sn.homeNetwork(schets);
				if (weg) return;
				kaart = { Tekening: ns.default, sketch };
			})
			.catch((e) => {
				report('Wetsnetwerk', e);
				if (weg) return;
				fout = e;
				kaart = 'fout';
			});
	}
	onMount(() => {
		laad();
		return () => (weg = true);
	});

	/** A bron of the drawing opens in the real network, with the article it hangs on. */
	function open(id: string) {
		goto(exploreHref(new URLSearchParams({ netwerk: `${schets.centrum.id},${id}` })));
	}
	const alles = () => goto(schets.exploreHref);
</script>

<figure class="wetsnetwerk">
	<div class="kaart">
		{#if kaart && kaart !== 'fout'}
			{@const Tekening = kaart.Tekening}
			<Tekening sketch={kaart.sketch} name={schets.centrum.naam} onSingle={open} onGroup={alles} />
		{:else if kaart === 'fout'}
			<LoadState state={{ status: 'error', error: fout }} what="Het netwerk" retry={laad} />
		{/if}
	</div>
	<figcaption>
		<span>Aangenomen door de {CHAMBER_NAME[k.kamer]}, {langeDatum(k.datum)}</span>
		<a class="verkenner" href={schets.exploreHref}>Open in netwerk</a>
	</figcaption>
</figure>

<style>
	.wetsnetwerk {
		display: flex;
		flex-direction: column;
		margin: 0;
	}
	/* The room of the drawing while its chunk comes, so nothing under it drops. */
	.kaart {
		display: flex;
		flex: 1;
		flex-direction: column;
		justify-content: center;
		min-height: 300px;
	}
	.kaart :global(.sketch) {
		margin: 0;
	}
	/* The count of the legend is for Verbonden; here the drawing speaks for itself. */
	.kaart :global(.caption) {
		display: none;
	}
	figcaption {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--s-2) var(--s-4);
		margin-top: var(--s-4);
		padding-top: var(--s-3);
		border-top: 1px solid var(--rule);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.verkenner {
		font-weight: 600;
		color: var(--ink);
	}
	/* A finger: the link as high as a Knop. */
	@media (pointer: coarse), (max-width: 768px) {
		.verkenner {
			display: inline-flex;
			align-items: center;
			min-height: var(--veld-h-raak);
		}
	}
</style>
