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
		networkOn && !hasSelection
			? 'Kies eerst een bron in het netwerk.'
			: beyondCap(d)
				? `Maximaal ${cap} bronnen getoond; een stap verder voegt niets toe.`
				: null;
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
			</Sectie>
		{/if}
	{/if}
	{@render children?.()}
</CanvasKaart>

<style>
	.view-slot {
		margin-bottom: var(--s-3);
	}
</style>
