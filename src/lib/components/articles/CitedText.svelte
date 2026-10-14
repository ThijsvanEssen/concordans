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
	import type { Bereik, NootMarker } from '$lib/text/voetnoten';
	import { nootStand } from '$lib/text/voetnoten.svelte';

	type Span = Schema<'ArticleCitationSpan'> & { definition_ref?: string | null };

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

	type Segment = {
		content: string;
		/** Where it starts in `text`. */
		van?: number;
		/** A footnote marker, with no content of its own. */
		noot?: NootMarker;
		/** Inside `bereik`. */
		gemarkeerd?: boolean;
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

	/** Where each segment starts, the markers between them and the marked words split off. */
	const stukken = $derived.by<Segment[]>(() => {
		if (noten.length === 0 && !bereik) return segments;
		let van = 0;
		const geplaatst = segments.map((seg) => {
			const at = van;
			van += seg.content.length;
			return { ...seg, van: at };
		});
		// A plain run cut where the marked words begin and end; a link is marked whole.
		const cuts = bereik ? [bereik.start, bereik.end] : [];
		const binnen = (a: number, b: number) => !!bereik && a < bereik.end && b > bereik.start;
		const delen: Segment[] = geplaatst.flatMap((seg) => {
			const eind = seg.van! + seg.content.length;
			if (seg.span || seg.begrip || seg.formule)
				return [{ ...seg, gemarkeerd: binnen(seg.van!, eind) }];
			const grenzen = [seg.van!, ...cuts.filter((c) => c > seg.van! && c < eind), eind];
			return grenzen.slice(0, -1).map((a, i) => ({
				content: text.slice(a, grenzen[i + 1]),
				van: a,
				gemarkeerd: binnen(a, grenzen[i + 1])
			}));
		});
		// A marker after the words before it; inside a link or a run, after it or cut there.
		const markers = [...noten].sort((a, b) => (a.at ?? text.length) - (b.at ?? text.length));
		const uit: Segment[] = [];
		let m = 0;
		for (const d of delen) {
			const eind = d.van! + d.content.length;
			const plain = !d.span && !d.begrip && !d.formule;
			let rest = d;
			while (m < markers.length && (markers[m].at ?? text.length) < eind) {
				const at = Math.max(markers[m].at ?? text.length, rest.van!);
				if (plain && at > rest.van!) {
					uit.push({ ...rest, content: text.slice(rest.van!, at) });
					rest = { ...rest, van: at, content: text.slice(at, eind) };
				} else if (!plain && at > rest.van!) break;
				uit.push({ content: '', noot: markers[m] });
				m++;
			}
			if (rest.content) uit.push(rest);
			while (m < markers.length && (markers[m].at ?? text.length) <= eind && !plain) {
				uit.push({ content: '', noot: markers[m] });
				m++;
			}
		}
		for (; m < markers.length; m++) uit.push({ content: '', noot: markers[m] });
		return uit;
	});

	/** The bron a span cites, or null for a target the front end has no page for. */
	const refOfSpan = (seg: Segment) => {
		const { collection, key } = seg.span!.target;
		return isCollection(collection) ? refOf(collection, key) : null;
	};
</script>

{#snippet stuk(seg: Segment)}{#if seg.formule && grondslag}<GrondslagFormule
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
			>{/if}{:else}{seg.content}{/if}{/snippet}
{#each stukken as seg, i (i)}{#if seg.noot}<sup class="noot-ref"
			>{#if stand}<button
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
	/* A footnote marker: its label raised, a tap opens the note in place. */
	.noot-ref {
		font-size: 0.7em;
		line-height: 0;
	}
	.noot-ref__knop {
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
	.noot-ref__knop:hover,
	.noot-ref__knop.is-open {
		color: var(--ink);
		background: var(--wassing);
	}
	.noot-ref__knop:focus-visible {
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
