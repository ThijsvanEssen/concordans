<script lang="ts">
	// A delegation formula in the text of an article ("bij of krachtens algemene maatregel van
	// bestuur"), marked as a defined term is: the text's own colour on a dotted line. Its card
	// names the regulations issued on that grondslag, each with its articles that refer here,
	// or that there is none yet. The regulations are asked once per article, when the pointer
	// or the focus first comes to a formula. Hover shows the card; a click or a tap holds it
	// open. Escape, a tap outside or a second click close it.
	import BronLink from '$lib/bron/BronLink.svelte';
	import { failureText } from '$lib/components/ui/LoadState.svelte';
	import { load } from '$lib/util/load.svelte';
	import { isEscape } from '$lib/actions/keys';
	import { clickOutside, HOVER_MS, LEAVE_MS } from '$lib/actions/top-layer';
	import FloatingCard from '$lib/components/ui/FloatingCard.svelte';
	import {
		artikelKort,
		grondslagKop,
		nogGeen,
		regelingNaam,
		regelingRegel,
		vullingVan,
		type DelegatieSpan,
		type Gedelegeerd
	} from '$lib/text/delegaties';

	let {
		formule,
		laad,
		children
	}: {
		formule: DelegatieSpan;
		/** The regulations under the article, asked once per article (`getDelegated`). */
		laad: () => Promise<Gedelegeerd | null>;
		children: import('svelte').Snippet;
	} = $props();

	const uid = $props.id();

	/** `hover` while the pointer rests on it, `vast` after a click or a tap. */
	let open = $state<null | 'hover' | 'vast'>(null);
	/** Asked when the pointer or the focus first comes; until then nothing is loaded. */
	let gevraagd = $state(false);
	const antwoord = load(
		() => gevraagd,
		(ja) => (ja ? laad() : Promise.resolve(null)),
		'Grondslag'
	);
	let knop = $state<HTMLElement | null>(null);
	let kaart = $state<HTMLElement | null>(null);
	let timer: ReturnType<typeof setTimeout> | null = null;

	/** The regulations that fill the formula; none where the API does not have the article. */
	const regelingen = $derived(
		gevraagd && antwoord.state.status === 'ready'
			? antwoord.state.data
				? (vullingVan(antwoord.state.data, formule.bij) ?? [])
				: []
			: null
	);

	/** Asked once; after a failure again on the next hover or tap. */
	function vraag() {
		if (!gevraagd) gevraagd = true;
		else if (antwoord.state.status === 'error') antwoord.retry();
	}
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
		vraag();
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
		vraag();
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
	class="grondslag"
	class:is-open={!!open}
	aria-expanded={!!open}
	aria-controls={open ? `${uid}-kaart` : undefined}
	bind:this={knop}
	onpointerenter={binnen}
	onpointerleave={buiten}
	onfocus={vraag}
	onclick={klik}
	onkeydown={toets}>{@render children()}</button
>{#if open && knop}<!-- A click on the card stays on it: not the place's menu under it (ArticleText). --><FloatingCard
		kind="list"
		tag="span"
		anchor={knop}
		onclose={sluit}
		bind:element={kaart}
		id="{uid}-kaart"
		role="dialog"
		aria-label={grondslagKop(formule)}
		tabindex={-1}
		onpointerenter={binnen}
		onpointerleave={buiten}
		onclick={(e) => e.stopPropagation()}
		onkeydown={toets}
		><span class="kaart__kop">{grondslagKop(formule)}</span
		>{#if antwoord.state.status === 'error'}<span class="kaart__stil" role="alert"
				>{failureText('De regelingen', antwoord.state.error)}</span
			>{:else if regelingen === null}<span class="kaart__stil">Regelingen laden…</span
			>{:else if regelingen.length === 0}<span class="kaart__leeg">{nogGeen(formule)}</span
			>{:else}{#each regelingen as r (r.instrument.key)}{@const regel = regelingRegel(r)}<span
					class="kaart__regeling"
					><BronLink preview={false} ref={`instruments/${r.instrument.key}`} class="kaart__naam"
						>{regelingNaam(r)}</BronLink
					>{#if regel}<span class="kaart__regel">{regel}</span>{/if}{#if r.articles?.length}<span
							class="kaart__artikelen"
							>{#each r.articles as a (a.key)}<span class="kaart__plek"
									><BronLink preview={false} ref={`articles/${a.key}`} class="kaart__artikel"
										>{artikelKort(a)}</BronLink
									></span
								>{/each}</span
						>{/if}</span
				>{/each}{/if}</FloatingCard
	>{/if}

<style>
	/* The formula: as a defined term, the text's own colour on a dotted line. */
	.grondslag {
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
		text-underline-offset: 3px;
	}
	.grondslag:hover,
	.grondslag:focus-visible,
	.grondslag.is-open {
		text-decoration-color: var(--ink);
	}
	.grondslag:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	.kaart__kop {
		font-size: var(--t-label);
		color: var(--ink-3);
	}
	.kaart__leeg {
		font-size: var(--t-body-2);
		line-height: var(--lh-snug);
		color: var(--ink);
	}
	.kaart__stil {
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.kaart__regeling {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
	}
	.kaart__regeling :global(a.kaart__naam) {
		font-size: var(--t-body-2);
		font-weight: 600;
		line-height: var(--lh-snug);
		color: var(--ink);
	}
	.kaart__regeling :global(a.kaart__naam:hover),
	.kaart__artikelen :global(a.kaart__artikel:hover) {
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	.kaart__regel,
	.kaart__artikelen {
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
		color: var(--ink-2);
	}
	/* The articles as a list in the text: `art. 3, art. 2`, wrapping between them. */
	.kaart__artikelen {
		display: flex;
		flex-wrap: wrap;
		column-gap: var(--s-1);
	}
	.kaart__plek:not(:last-child)::after {
		content: ',';
	}
	.kaart__artikelen :global(a.kaart__artikel) {
		color: var(--ink);
	}
</style>
