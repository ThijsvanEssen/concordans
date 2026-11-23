<script lang="ts">
	// A number in the text of an article (an amount, a percentage, a time limit, a date), marked
	// as a defined term is: the text's own colour on a dotted line. Its card says the number in
	// the previous toestand and from when that held; where the text has no earlier one, that it
	// has none. Hover or focus shows the card after a moment, a first tap shows it on touch, a
	// second tap or Escape or a tap outside closes it (HoverCard, cardCloser).
	import FloatingCard from '$lib/components/ui/FloatingCard.svelte';
	import { HoverCard, cardCloser } from '$lib/actions/hover-card.svelte';
	import { SOORT, stapTekst, vanaf, vorigeStap, type Getal } from '$lib/text/amounts';

	let { getal, children }: { getal: Getal; children: import('svelte').Snippet } = $props();

	const uid = $props.id();
	const hover = new HoverCard(() => true);
	let knop = $state<HTMLElement | null>(null);
	let kaart = $state<HTMLElement | null>(null);

	const vorige = $derived(vorigeStap(getal));
	const vorigeTekst = $derived(vorige ? stapTekst(getal.unit, vorige) : null);
	const kop = $derived(SOORT[getal.kind] ?? 'Getal');
	const inside = (t: EventTarget | null) =>
		t instanceof Node && (!!knop?.contains(t) || !!kaart?.contains(t));

	$effect(() => {
		if (!hover.open) return;
		return cardCloser({
			anchor: () => knop,
			card: () => kaart,
			close: () => hover.close(),
			readable: true
		});
	});
</script>

<button
	type="button"
	class="getal"
	class:is-open={hover.open}
	aria-expanded={hover.open}
	aria-controls={hover.open ? `${uid}-kaart` : undefined}
	bind:this={knop}
	onpointerenter={(e) => {
		hover.pointer(e.pointerType);
		hover.enter();
	}}
	onpointerleave={() => hover.leave()}
	onpointerdown={(e) => hover.pointer(e.pointerType)}
	onfocus={() => hover.enter()}
	onblur={(e) => {
		// Focus that leaves for the card stays; for nowhere (a tap elsewhere) too.
		if (e.relatedTarget === null || inside(e.relatedTarget)) return;
		hover.close();
	}}
	onclick={(e) => {
		// A click on the text is not the menu of its place (ArticleText).
		e.stopPropagation();
		hover.tap();
	}}
	onkeydown={() => hover.keys()}>{@render children()}</button
>{#if hover.open && knop}<FloatingCard
		kind="list"
		tag="span"
		anchor={knop}
		onclose={() => hover.close()}
		bind:element={kaart}
		id="{uid}-kaart"
		role="dialog"
		aria-label={kop}
		tabindex={-1}
		onpointerenter={() => hover.enter()}
		onpointerleave={() => hover.leave()}
		onclick={(e) => e.stopPropagation()}
		><span class="kaart__kop">{kop}, vorige toestand</span>{#if vorige && vorigeTekst}<span
				class="kaart__waarde">{vorigeTekst}</span
			>{#if vanaf(vorige)}<span class="kaart__vanaf">{vanaf(vorige)}</span>{/if}{:else}<span
				class="kaart__vanaf">Geen eerdere toestand</span
			>{/if}</FloatingCard
	>{/if}

<style>
	.getal {
		display: inline;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: inherit;
		text-align: inherit;
		cursor: pointer;
		text-decoration: underline;
		text-decoration-style: dotted;
		text-decoration-color: var(--ink-3);
		text-underline-offset: var(--onderstreping);
	}
	.getal:hover,
	.getal:focus-visible,
	.getal.is-open {
		text-decoration-color: var(--ink);
		background: var(--wassing);
	}
	.getal:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	.kaart__kop {
		font-size: var(--t-label);
		color: var(--ink-3);
	}
	.kaart__waarde {
		font-size: var(--t-body-2);
		font-weight: 600;
		line-height: var(--lh-snug);
		color: var(--ink);
	}
	.kaart__vanaf {
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
		color: var(--ink-2);
	}
</style>
