<script lang="ts">
	// Inline text in which the spans the API found are links to the cited bron, at the
	// lid or onderdeel the source names. A term the regulation defines is a reference too:
	// its card says the definition, a click opens the article that gives it (begrippen.ts).
	import BronLink from '$lib/bron/BronLink.svelte';
	import { refOf } from '$lib/bron/href';
	import { isCollection } from '$lib/vocabulary';
	import { definitieKaart, definitieRegel, type Begrip, type Definitie } from '$lib/text/begrippen';
	import type { DelegatieSpan, Gedelegeerd } from '$lib/text/delegaties';
	import GrondslagFormule from './GrondslagFormule.svelte';
	import FootnoteLink from './FootnoteLink.svelte';
	import type { Bereik, NootMarker } from '$lib/text/voetnoten';
	import { nootStand } from '$lib/text/voetnoten.svelte';
	import { ownLawOf, ownArticleAnchor } from '$lib/text/own-article.svelte';
	import { page } from '$app/state';
	import { splitDates } from '$lib/text/datum';
	import { segmentsOf, withMarkers, type Segment, type Span } from '$lib/text/segments';

	let {
		text,
		citations = [],
		begrippen = [],
		definities = new Map(),
		delegaties = [],
		grondslag = null,
		doel = null,
		noten = [],
		bereik = null
	}: {
		text: string;
		/** Offsets are relative to `text`. */
		citations?: Span[];
		/** The defined terms the text uses, offsets relative to `text`. */
		begrippen?: Begrip[];
		/** The definitions by their `ref`. */
		definities?: Map<string, Definitie>;
		/** The delegation formulas in the text, offsets relative to `text`. */
		delegaties?: DelegatieSpan[];
		/** The regulations issued under the article; without it no formula is marked. */
		grondslag?: (() => Promise<Gedelegeerd | null>) | null;
		/** The bron the text is read for (`bwbr0005291_305a`): its citations marked, as a
		 *  passage marks the words that cite it. */
		doel?: string | null;
		/** The footnote markers in the text, `at` relative to it; null at its end. */
		noten?: NootMarker[];
		/** Words to mark: what a verbinding names by its offsets in `text`. */
		bereik?: Bereik | null;
	} = $props();

	const stand = nootStand();
	// In the whole law an article of it is a jump in place, its card as elsewhere.
	const ownLaw = ownLawOf();
	const inPlace = (seg: Segment) => {
		const anchor = ownArticleAnchor(seg.span!.target, ownLaw());
		return anchor ? `${page.url.pathname}${page.url.search}#${encodeURIComponent(anchor)}` : null;
	};

	const shownSegments = $derived(
		withMarkers(
			segmentsOf(text, {
				citations,
				begrippen,
				definities,
				delegaties: grondslag ? delegaties : []
			}),
			text,
			noten,
			bereik
		)
	);

	/** The bron a span cites, or null for a target the front end has no page for. */
	const refOfSpan = (seg: Segment) => {
		const { collection, key } = seg.span!.target;
		return isCollection(collection) ? refOf(collection, key) : null;
	};
</script>

{#snippet plain(content: string)}{#each splitDates(content) as d, k (k)}{#if d.date}<span
				class="date">{d.text}</span
			>{:else}{d.text}{/if}{/each}{/snippet}
{#snippet stuk(seg: Segment)}{#if seg.formule && grondslag}<GrondslagFormule
			formule={seg.formule}
			laad={grondslag}>{@render plain(seg.content)}</GrondslagFormule
		>{:else if seg.begrip}<BronLink
			ref={`articles/${seg.begrip.article_key}`}
			voorbeeld={definitieKaart(seg.begrip)}
			class="begrip">{@render plain(seg.content)}</BronLink
		>{:else if seg.span && refOfSpan(seg)}{#if doel && seg.span.target.key === doel}<mark
				class="doel"
				><BronLink ref={refOfSpan(seg)!} at={seg.at} class="cited"
					>{@render plain(seg.content)}</BronLink
				></mark
			>{:else}<BronLink
				ref={refOfSpan(seg)!}
				at={seg.at}
				href={inPlace(seg)}
				extra={seg.span.definition_ref && definities.get(seg.span.definition_ref)
					? definitieRegel(definities.get(seg.span.definition_ref)!)
					: null}
				class="cited">{@render plain(seg.content)}</BronLink
			>{/if}{:else}{@render plain(seg.content)}{/if}{/snippet}
{#each shownSegments as seg, i (i)}{#if seg.noot}<sup
			class="noot-ref"
			id={seg.noot.anchor ?? undefined}
			>{#if seg.noot.href}<FootnoteLink
					marker={{ ...seg.noot, href: seg.noot.href }}
				/>{:else if stand}<button
					type="button"
					class="noot-ref__knop"
					class:is-open={stand.open === seg.noot.id}
					aria-expanded={stand.open === seg.noot.id}
					aria-label="Voetnoot {seg.noot.label}"
					onclick={() => stand.wissel(seg.noot!.id)}>{seg.noot.label}</button
				>{:else}{seg.noot.label}{/if}</sup
		>{:else if seg.gemarkeerd}<mark class="bereik">{@render stuk(seg)}</mark>{:else}{@render stuk(
			seg
		)}{/if}{/each}

<style>
	/* A date stays on one line, and its month is not hyphenated (hyphens: auto breaks past a
	   no-break space). */
	.date {
		white-space: nowrap;
		hyphens: manual;
	}
	/* The citation of the bron the text is read for, as a passage marks it. */
	.doel {
		background: var(--wassing);
		color: inherit;
	}
	/* The words a verbinding names, as a passage marks them. */
	.bereik {
		background: var(--wassing);
		color: inherit;
	}
	/* A footnote marker: its label raised, a tap opens the note in place (a judgment, a
	   Kamerstuk) or shows it in a card (an article, FootnoteLink). */
	.noot-ref {
		font-size: 0.7em;
		line-height: 0;
	}
	.noot-ref :global(.noot-ref__knop) {
		padding: 0 var(--s-1);
		border: 0;
		border-radius: var(--r-1);
		background: none;
		font: inherit;
		color: var(--ink-2);
		cursor: pointer;
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 2px;
	}
	.noot-ref:global(.is-landed) :global(.noot-ref__knop),
	.noot-ref :global(.noot-ref__knop.is-open) {
		color: var(--ink);
		background: var(--wassing);
	}
	/* Only for a pointer that hovers: a tap leaves no hover behind on a phone. */
	@media (hover: hover) {
		.noot-ref :global(.noot-ref__knop:hover) {
			color: var(--ink);
			background: var(--wassing);
		}
	}
	.noot-ref :global(.noot-ref__knop:focus-visible) {
		outline: 2px solid var(--focus);
		outline-offset: 1px;
	}
	/* A defined term: quieter than a citation, the text's own colour on a dotted line. */
	:global(a.begrip) {
		color: inherit;
		text-decoration: underline;
		text-decoration-style: dotted;
		text-decoration-color: var(--ink-3);
		text-underline-offset: 3px;
	}
	:global(a.begrip:hover),
	:global(a.begrip:focus-visible) {
		text-decoration-color: var(--ink);
	}
	/* The link lives in BronLink; its look is the text's own. It takes no room of its own: a
	   text with its links breaks its lines where the text without them does (the first paint
	   of an article's address, $lib/first-paint); the tint on hover reaches past it. */
	:global(a.cited) {
		color: var(--ink);
		text-decoration: underline;
		text-decoration-style: dotted;
		text-underline-offset: 3px;
		border-radius: var(--r-1);
		transition:
			background var(--dur-1) var(--ease),
			box-shadow var(--dur-1) var(--ease);
	}
	:global(a.cited:hover),
	:global(a.cited:focus-visible) {
		background: var(--wassing);
		box-shadow: 0 0 0 1px var(--wassing);
		text-decoration-style: solid;
	}
</style>
