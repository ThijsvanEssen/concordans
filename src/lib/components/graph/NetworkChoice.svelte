<script lang="ts">
	// The block Weergave above the canvas (Design System, Netwerkkeuze): which weergave (Omgeving,
	// Verband, Keten) over the full width of the column, how many steps, and under them what
	// belongs to the weergave chosen, Tonen, Relatie and the rest (`children`, GraphSidebar).
	// Not foldable, and no key of its own: whatever is drawn can be switched in those rows, and
	// what cannot be switched is not shown. One block for all three weergaven.
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
		networkOn = false,
		hasSelection = false,
		reach = null,
		empty = false,
		stepsOff = null,
		children
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
		/** Why the steps are off whatever the weergave (Verband with one bron): said in a line. */
		stepsOff?: string | null;
		/** What belongs to the weergave: Tonen, Relatie, Periode, Meer. */
		children?: Snippet;
	} = $props();

	const STEPS = [1, 2, 3];
	const stepsWord = (n: number) => count(n, 'stap', 'stappen');
	const withDepth = $derived(view !== 'keten' && !empty);

	// Steps that add nothing, as the API cut the neighbourhood off at its cap.
	const cap = $derived(reach?.cap ?? NEIGHBORHOOD_CAP);
	const beyondCap = (d: number) => !networkOn && !!reach?.capped && d > reach.depth;
	const reason = (d: number) =>
		stepsOff
			? stepsOff
			: networkOn && !hasSelection
				? 'Kies eerst een bron in het netwerk.'
				: beyondCap(d)
					? `Maximaal ${cap} bronnen getoond; een stap verder voegt niets toe.`
					: null;
	/** Why a step is off, said where a finger and the keyboard read it, not in a title alone (C15b). */
	const stepReason = $derived(STEPS.map(reason).find((r) => r !== null) ?? null);
</script>

<CanvasKaart title="Weergave" class="netwerkkeuze">
	{#if empty}
		<p class="stil">Nog geen bron gekozen</p>
	{:else}
		<div class="view-slot">{@render viewSlot?.()}</div>
		{#if withDepth}
			<Sectie title="Aantal stappen" niveau={3} inklapbaar={false}>
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
				{#if stepReason}<p class="stil why" role="note">{stepReason}</p>{/if}
			</Sectie>
		{/if}
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
