<script lang="ts">
	// A number in the text of an article (an amount, a percentage, a time limit, a date), marked
	// as a defined term is: the text's own colour on a dotted line. Its card says the number in
	// the previous toestand and from when that held; where the text has no earlier one, that it
	// has none. Hover shows the card; a click or a tap holds it open. Escape, a tap outside or a
	// second click close it.
	import FloatingCard from '$lib/components/ui/FloatingCard.svelte';
	import { isEscape } from '$lib/actions/keys';
	import { clickOutside, HOVER_MS, LEAVE_MS } from '$lib/actions/top-layer';
	import { SOORT, stapTekst, vanaf, vorigeStap, type Getal } from '$lib/text/getallen';

	let { getal, children }: { getal: Getal; children: import('svelte').Snippet } = $props();

	const uid = $props.id();

	/** `hover` while the pointer rests on it, `vast` after a click or a tap. */
	let open = $state<null | 'hover' | 'vast'>(null);
	let knop = $state<HTMLElement | null>(null);
	let kaart = $state<HTMLElement | null>(null);
	let timer: ReturnType<typeof setTimeout> | null = null;

	const vorige = $derived(vorigeStap(getal));
	const vorigeTekst = $derived(vorige ? stapTekst(getal.unit, vorige) : null);
	const kop = $derived(SOORT[getal.kind] ?? 'Getal');

	function wacht(fn: () => void, ms: number) {
		if (timer) clearTimeout(timer);
		timer = setTimeout(fn, ms);
	}
	function stop() {
		if (timer) clearTimeout(timer);
		timer = null;
	}
	function sluit() {
		stop();
		open = null;
	}
	function binnen(e: PointerEvent) {
		if (e.pointerType === 'touch') return;
		if (open) return stop();
		wacht(() => (open = 'hover'), HOVER_MS);
	}
	function buiten(e: PointerEvent) {
		if (e.pointerType === 'touch') return;
		if (open === 'vast') return;
		wacht(() => (open = null), open ? LEAVE_MS : 0);
	}
	function klik(e: MouseEvent) {
		e.stopPropagation();
		stop();
		open = open === 'vast' ? null : 'vast';
	}
	function toets(e: KeyboardEvent) {
		if (open && isEscape(e)) {
			e.preventDefault();
			e.stopPropagation();
			sluit();
			knop?.focus();
		}
	}

	// In the top layer while open (actions/top-layer.ts); a tap or click outside closes it.
	$effect(() => {
		if (open) return clickOutside(() => [kaart, knop], sluit);
	});
</script>

<button
	type="button"
	class="getal"
	class:is-open={!!open}
	aria-expanded={!!open}
	aria-controls={open ? `${uid}-kaart` : undefined}
	bind:this={knop}
	onpointerenter={binnen}
	onpointerleave={buiten}
	onclick={klik}
	onkeydown={toets}>{@render children()}</button
>{#if open && knop}<FloatingCard
		kind="list"
		tag="span"
		anchor={knop}
		onclose={sluit}
		bind:element={kaart}
		id="{uid}-kaart"
		role="dialog"
		aria-label={kop}
		tabindex={-1}
		onpointerenter={binnen}
		onpointerleave={buiten}
		onclick={(e) => e.stopPropagation()}
		onkeydown={toets}
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
