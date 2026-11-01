<script lang="ts">
	// The block Weergave above the canvas (Design System, Netwerkkeuze): which weergave (Omgeving,
	// Verband, Keten) over the full width of the column, how many steps, and under them what
	// belongs to the weergave chosen, Tonen, Relatie and the rest (`children`, GraphSidebar).
	// Not foldable, and no key of its own: whatever is drawn can be switched in those rows, and
	// what cannot be switched is not shown. One block for all three weergaven.
	//
	// Aantal stappen is the one measure of how far the netwerk reaches: the chosen bronnen and
	// whatever is connected within that many steps (Alleen gekozen: the chosen ones and what ties
	// them). In Verband it is the pair's, in Keten there are no steps.
	import type { Snippet } from 'svelte';
	import { count } from '$lib/text/words';
	import Keuze from '$lib/components/ui/Keuze.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import { formatCount } from '$lib/text/getal';
	import { SOFT_NODE_CAP, type NeighborhoodReach } from '$lib/graph/store/types';
	import CanvasKaart from './CanvasKaart.svelte';

	type View = 'omgeving' | 'verband' | 'keten';

	let {
		view,
		viewSlot,
		depth,
		onDepth,
		withNetwerk = false,
		reach = null,
		children
	}: {
		view: View;
		/** The choice of weergave itself, which the page owns. */
		viewSlot?: Snippet;
		depth: number;
		onDepth: (d: number) => void;
		/** Bronnen are chosen: Alleen gekozen is offered, and the steps reach from all of them. */
		withNetwerk?: boolean;
		/** How far the last neighbourhood reached, and whether the API cut it off. */
		reach?: NeighborhoodReach | null;
		/** What belongs to the weergave: Tonen, Relatie, Periode, Meer. */
		children?: Snippet;
	} = $props();

	const stepsWord = (n: number) => (n === 0 ? 'Alleen gekozen' : count(n, 'stap', 'stappen'));
	// Under the heading Aantal stappen the buttons say only the number; their name keeps the word.
	const stepsLabel = (n: number) => (n === 0 ? 'Gekozen' : String(n));
	const steps = $derived(withNetwerk ? [0, 1, 2, 3] : [1, 2, 3]);
	const withDepth = $derived(view !== 'keten');

	const titles = (d: number) =>
		d === 0 ? 'Alleen de gekozen bronnen en hun onderlinge verbindingen' : undefined;
	// Every step stays open. Where the netwerk is more than the room (SOFT_NODE_CAP places, a
	// folded group one), it shows the most important and says so, in a line the keyboard and a
	// finger read too (C15b); the whole of the direct neighbours, where the API counted them.
	const total = $derived((reach?.buckets ?? []).reduce((sum, b) => sum + b.total, 0));
	const incomplete = $derived(
		depth >= 1 && reach?.capped
			? `${stepsWord(depth)}: de belangrijkste ${formatCount(SOFT_NODE_CAP)}${
					total > SOFT_NODE_CAP ? ` van ±${formatCount(total)}` : ''
				} bronnen. Filter in Tonen voor meer.`
			: null
	);
</script>

<CanvasKaart title="Weergave" class="netwerkkeuze">
	<div class="view-slot">{@render viewSlot?.()}</div>
	{#if withDepth}
		<Sectie title="Aantal stappen" niveau={3} inklapbaar={false}>
			<Keuze
				label="Aantal stappen"
				vol
				waarde={String(depth)}
				opties={steps.map((d) => ({
					waarde: String(d),
					label: stepsLabel(d),
					name: stepsWord(d),
					titel: titles(d)
				}))}
				onSelect={(d) => onDepth(Number(d))}
			/>
			{#if incomplete}<p class="stil why" role="note">{incomplete}</p>{/if}
		</Sectie>
	{/if}
	{@render children?.()}
</CanvasKaart>

<style>
	.why {
		margin: var(--s-2) 0 0;
	}
	.view-slot {
		margin-bottom: var(--s-3);
	}
</style>
