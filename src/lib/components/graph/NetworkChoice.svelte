<script lang="ts">
	// The card Weergave and legend above the canvas (Design System, Netwerkkeuze): which weergave
	// (Omgeving, Verband, Keten), how many steps, and the key to what the canvas shows, the four
	// kinds and the lines drawn. One card for all three weergaven. The filters (which kinds and
	// relations show) are the strip below it.
	import type { Snippet } from 'svelte';
	import { count } from '$lib/text/words';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { kindColour } from '$lib/bron/kleur';
	import Keuze from '$lib/components/ui/Keuze.svelte';
	import { isOpen, zetOpen } from '$lib/components/ui/dicht.svelte';
	import { NEIGHBORHOOD_CAP, type NeighborhoodReach } from '$lib/graph/store/types';
	import type { Collection, Relation } from '$lib/vocabulary';
	import CanvasKaart from './CanvasKaart.svelte';
	import LineSample from './LineSample.svelte';
	import { drawnLineKinds } from './line-kind';

	type View = 'omgeving' | 'verband' | 'keten';

	let {
		view,
		viewSlot,
		depth,
		onDepth,
		networkOn = false,
		hasSelection = false,
		reach = null,
		empty = false,
		relations = {},
		refersFrom = []
	}: {
		view: View;
		/** The choice of weergave itself, which the page owns. */
		viewSlot?: Snippet;
		depth: number;
		onDepth: (d: number) => void;
		/** With a netwerk, a depth adds context around the selection instead of setting the view. */
		networkOn?: boolean;
		hasSelection?: boolean;
		/** How far the last neighbourhood reached, and whether the API cut it off. */
		reach?: NeighborhoodReach | null;
		/** No bron chosen yet. */
		empty?: boolean;
		/** The relations on the canvas, and the kinds the drawn citations start at. */
		relations?: Partial<Record<Relation, number>>;
		refersFrom?: Collection[];
	} = $props();

	const KEY = 'netwerk:keuze';
	const WORDS: Record<View, string> = { omgeving: 'Omgeving', verband: 'Verband', keten: 'Keten' };
	const STEPS = [1, 2, 3];
	const stepsWord = (n: number) => count(n, 'stap', 'stappen');
	const KINDS: { label: string; collection: Collection }[] = [
		{ label: 'Wet', collection: 'instruments' },
		{ label: 'Parlement', collection: 'documents' },
		{ label: 'Personen', collection: 'members' },
		{ label: 'Rechtspraak', collection: 'judgments' }
	];

	const open = $derived(isOpen(KEY, true));
	const withDepth = $derived(view !== 'keten' && !empty);
	const chosen = $derived(
		empty ? '' : withDepth && !networkOn ? `${WORDS[view]}, ${stepsWord(depth)}` : WORDS[view]
	);
	const lines = $derived(drawnLineKinds(relations, refersFrom));

	// Steps that add nothing, as the API cut the neighbourhood off at its cap.
	const cap = $derived(reach?.cap ?? NEIGHBORHOOD_CAP);
	const beyondCap = (d: number) => !networkOn && !!reach?.capped && d > reach.depth;
	const reason = (d: number) =>
		networkOn && !hasSelection
			? 'Kies eerst een bron in het netwerk.'
			: beyondCap(d)
				? `Maximaal ${cap} bronnen getoond; een stap verder voegt niets toe.`
				: null;
</script>

<CanvasKaart
	title="Weergave"
	label="Weergave en legenda"
	class="netwerkkeuze"
	{open}
	onToggle={() => zetOpen(KEY, !open)}
>
	{#snippet samenvatting()}{#if chosen}<span class="choice-summary">{chosen}</span>{/if}{/snippet}
	{#if empty}
		<section class="block">
			<p class="stil">Nog geen bron gekozen</p>
		</section>
	{:else}
		<section class="block">
			<div class="view-slot">{@render viewSlot?.()}</div>
		</section>
		{#if withDepth}
			<section class="block">
				<h3 class="blok__label">Aantal stappen</h3>
				<Keuze
					label="Aantal stappen"
					vol
					waarde={networkOn ? null : String(depth)}
					opties={STEPS.map((d) => ({
						waarde: String(d),
						label: stepsWord(d),
						uit: !!reason(d),
						titel: reason(d) ?? undefined
					}))}
					onSelect={(d) => onDepth(Number(d))}
				/>
			</section>
		{/if}
	{/if}
	<section class="block">
		<h3 class="blok__label">Soort</h3>
		<ul class="kinds">
			{#each KINDS as s (s.label)}
				<li>
					<KindGlyph
						collection={s.collection}
						size={12}
						colour={kindColour(s.collection)}
					/>{s.label}
				</li>
			{/each}
		</ul>
	</section>
	{#if lines.length > 0}
		<section class="block">
			<h3 class="blok__label">Lijnen</h3>
			<ul class="lijnen">
				{#each lines as k (k.id)}
					<li><LineSample relation={k.sample.relation} from={k.sample.from} />{k.label}</li>
				{/each}
			</ul>
		</section>
	{/if}
</CanvasKaart>

<style>
	.choice-summary {
		font-size: var(--t-micro);
		color: var(--ink-3);
		white-space: nowrap;
	}
	.block {
		padding: var(--s-2) 0 var(--s-3);
		border-top: 1px solid var(--rule);
	}
	.block:first-child {
		border-top: 0;
		padding-top: 0;
	}
	.block:last-child {
		padding-bottom: 0;
	}
	.blok__label {
		margin: 0 0 var(--s-2);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
	}
	.kinds,
	.lijnen {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--s-1) var(--s-3);
	}
	.kinds {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	li {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		min-width: 0;
		font-size: var(--t-micro);
		line-height: 18px;
		color: var(--ink-2);
	}
	@media (pointer: coarse), (max-width: 768px) {
		li {
			font-size: var(--t-meta);
			line-height: 22px;
		}
	}
</style>
