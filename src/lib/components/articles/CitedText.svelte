<script lang="ts">
	// Inline text in which the spans the API found are links to the cited bron, at the
	// lid or onderdeel the source names. A term the regulation defines is a reference too:
	// its card says the definition, a click opens the article that gives it (begrippen.ts).
	import type { Schema } from '$lib/api/types';
	import BronLink from '$lib/bron/BronLink.svelte';
	import { refOf } from '$lib/bron/href';
	import { anchorOf, parseQualifier, qualifierOfSpan } from '$lib/text/qualifier';
	import { isCollection } from '$lib/vocabulary';
	import { definitieKaart, definitieRegel, type Begrip, type Definitie } from '$lib/text/begrippen';
	import { splitsOpNummers } from '$lib/text/meervoud';
	import type { DelegatieSpan, Gedelegeerd } from '$lib/text/delegaties';
	import GrondslagFormule from './GrondslagFormule.svelte';

	type Span = Schema<'ArticleCitationSpan'> & { definition_ref?: string | null };

	let {
		text,
		citations = [],
		begrippen = [],
		definities = new Map(),
		delegaties = [],
		grondslag = null,
		doel = null
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
	} = $props();

	type Segment = {
		content: string;
		span?: Span;
		at?: string | null;
		begrip?: Definitie;
		formule?: DelegatieSpan;
	};

	/** Each article once, where the API gives a span twice for it. */
	const uniekeDoelen = (spans: Span[]) =>
		spans.filter((c, i) => spans.findIndex((d) => d.target.id === c.target.id) === i);

	/** How much of what follows a span is read for a qualifier ("…, tweede lid,"). */
	const FOLLOWING = 80;

	const segments = $derived.by<Segment[]>(() => {
		const out: Segment[] = [];
		let cursor = 0;
		// A term inside a citation is no span of its own (the API leaves it out); where several
		// start at one place the citation goes first, then a delegation formula, then a term.
		const rang = (x: object) => ('formule' in x ? 1 : 'begrip' in x ? 2 : 0);
		const sorted = [
			...citations.filter((c) => c.start != null && c.end != null),
			...(grondslag ? delegaties.map((d) => ({ start: d.start, end: d.end, formule: d })) : []),
			...begrippen.map((b) => ({ ...b, begrip: definities.get(b.definition_ref) }))
		].sort((a, b) => a.start! - b.start! || rang(a) - rang(b));
		for (const item of sorted) {
			if (item.start! < cursor) continue;
			if (item.start! > cursor) out.push({ content: text.slice(cursor, item.start!) });
			if ('formule' in item) {
				out.push({ content: text.slice(item.start, item.end), formule: item.formule });
				cursor = item.end;
				continue;
			}
			if ('begrip' in item) {
				if (!item.begrip) continue;
				out.push({ content: text.slice(item.start, item.end), begrip: item.begrip });
				cursor = item.end;
				continue;
			}
			const span = item;
			const content = text.slice(span.start!, span.end!);
			// One span for several articles ("art. 2 en 8 EVRM"): a link at each number.
			const zelfde = citations.filter(
				(c) =>
					c.start === span.start &&
					c.end === span.end &&
					c.target.collection === 'articles' &&
					c.target.id !== span.target.id
			);
			const delen =
				zelfde.length > 0 && span.target.collection === 'articles'
					? splitsOpNummers(content, [span, ...uniekeDoelen(zelfde)])
					: null;
			if (delen) {
				for (const d of delen)
					out.push({
						content: content.slice(d.van, d.tot),
						span: d.span ?? undefined,
						at: d.span ? anchorOf(qualifierOfSpan(d.span)) : null
					});
				cursor = span.end!;
				continue;
			}
			// The API names the lid on the span (0.5); before that it is read from the text.
			const at =
				span.target.collection === 'articles'
					? anchorOf(
							qualifierOfSpan(span) ??
								parseQualifier(content, text.slice(span.end!, span.end! + FOLLOWING))
						)
					: null;
			out.push({ content, span, at });
			cursor = span.end!;
		}
		if (cursor < text.length) out.push({ content: text.slice(cursor) });
		return out;
	});

	/** The bron a span cites, or null for a target the front end has no page for. */
	const refOfSpan = (seg: Segment) => {
		const { collection, key } = seg.span!.target;
		return isCollection(collection) ? refOf(collection, key) : null;
	};
</script>

{#each segments as seg, i (i)}{#if seg.formule && grondslag}<GrondslagFormule
			formule={seg.formule}
			laad={grondslag}>{seg.content}</GrondslagFormule
		>{:else if seg.begrip}<BronLink
			ref={`articles/${seg.begrip.article_key}`}
			voorbeeld={definitieKaart(seg.begrip)}
			class="begrip">{seg.content}</BronLink
		>{:else if seg.span && refOfSpan(seg)}{#if doel && seg.span.target.key === doel}<mark
				class="doel"
				><BronLink ref={refOfSpan(seg)!} at={seg.at} class="cited">{seg.content}</BronLink></mark
			>{:else}<BronLink
				ref={refOfSpan(seg)!}
				at={seg.at}
				extra={seg.span.definition_ref && definities.get(seg.span.definition_ref)
					? definitieRegel(definities.get(seg.span.definition_ref)!)
					: null}
				class="cited">{seg.content}</BronLink
			>{/if}{:else}{seg.content}{/if}{/each}

<style>
	/* The citation of the bron the text is read for, as a passage marks it. */
	.doel {
		background: var(--wassing);
		color: inherit;
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
	/* The link lives in BronLink; its look is the text's own. */
	:global(a.cited) {
		color: var(--ink);
		text-decoration: underline;
		text-decoration-style: dotted;
		text-underline-offset: 3px;
		padding: 0 1px;
		border-radius: var(--r-1);
		transition: background var(--dur-1) var(--ease);
	}
	:global(a.cited:hover),
	:global(a.cited:focus-visible) {
		background: var(--wassing);
		text-decoration-style: solid;
	}
</style>
