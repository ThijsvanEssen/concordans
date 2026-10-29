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
	import { NEIGHBORHOOD_CAP, type NeighborhoodReach } from '$lib/graph/store/types';
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
	const steps = $derived(withNetwerk ? [0, 1, 2, 3] : [1, 2, 3]);
	const withDepth = $derived(view !== 'keten');

	// Steps that add nothing, as the API cut the neighbourhood off at its cap.
	const cap = $derived(reach?.cap ?? NEIGHBORHOOD_CAP);
	const beyondCap = (d: number) => !!reach?.capped && d > reach.depth;
	const reason = (d: number) => (beyondCap(d) ? `Maximaal ${cap} bronnen getoond.` : null);
	const titles = (d: number) =>
		d === 0 ? 'Alleen de gekozen bronnen en hun onderlinge verbindingen' : undefined;
	// Why a step is off, said under the buttons where a finger and the keyboard read it (C15b):
	// only with 2 or 3 steps chosen and the cap really reached, else it reads as the reason
	// bronnen are drawn bare. The greyed step keeps its reason as a title.
	const stepReason = $derived(
		depth >= 2 && reach?.capped ? (steps.map(reason).find((r) => r) ?? null) : null
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
					label: stepsWord(d),
					uit: !!reason(d),
					titel: reason(d) ?? titles(d)
				}))}
				onSelect={(d) => onDepth(Number(d))}
			/>
			{#if stepReason}<p class="stil why" role="note">{stepReason}</p>{/if}
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
