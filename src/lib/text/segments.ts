// A text cut into what CitedText draws: plain runs, citations (a link at the lid or onderdeel
// the source names), defined terms, delegation formulas, and footnote markers between them,
// with the words a verbinding names marked. Offsets are relative to the text.
import type { Schema } from '$lib/api/types';
import { anchorOf, parseQualifier, qualifierOfSpan } from './qualifier';
import { splitsOpNummers } from './meervoud';
import type { Begrip, Definitie } from './begrippen';
import type { DelegatieSpan } from './delegaties';
import type { Bereik, NootMarker } from './voetnoten';

export type Span = Schema<'ArticleCitationSpan'> & { definition_ref?: string | null };

export type Segment = {
	content: string;
	/** Where it starts in the text. */
	van?: number;
	/** A footnote marker, with no content of its own. */
	noot?: NootMarker;
	/** Inside the `bereik`. */
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

const isLink = (seg: Segment) => !!(seg.span || seg.begrip || seg.formule);

/**
 * The text in segments. A term inside a citation is no span of its own (the API leaves it
 * out); where several start at one place the citation goes first, then a delegation formula,
 * then a term. A term without its definition stays text.
 */
export function segmentsOf(
	text: string,
	{
		citations = [],
		begrippen = [],
		definities = new Map(),
		delegaties = []
	}: {
		citations?: Span[];
		begrippen?: Begrip[];
		definities?: Map<string, Definitie>;
		delegaties?: DelegatieSpan[];
	}
): Segment[] {
	const out: Segment[] = [];
	let cursor = 0;
	const rang = (x: object) => ('formule' in x ? 1 : 'begrip' in x ? 2 : 0);
	const sorted = [
		...citations.filter((c) => c.start != null && c.end != null),
		...delegaties.map((d) => ({ start: d.start, end: d.end, formule: d })),
		...begrippen.flatMap((b) => {
			const begrip = definities.get(b.definition_ref);
			return begrip ? [{ ...b, begrip }] : [];
		})
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
}

/**
 * The segments with where each starts, the footnote markers between them and the marked
 * words split off. A plain run is cut where the marked words begin and end; a link is marked
 * whole. A marker stands after the words before it; inside a link, after the link.
 */
export function withMarkers(
	segments: Segment[],
	text: string,
	noten: readonly NootMarker[],
	bereik: Bereik | null
): Segment[] {
	if (noten.length === 0 && !bereik) return segments;
	let van = 0;
	const geplaatst = segments.map((seg) => {
		const at = van;
		van += seg.content.length;
		return { ...seg, van: at };
	});
	const cuts = bereik ? [bereik.start, bereik.end] : [];
	const binnen = (a: number, b: number) => !!bereik && a < bereik.end && b > bereik.start;
	const delen: Segment[] = geplaatst.flatMap((seg) => {
		const eind = seg.van + seg.content.length;
		if (isLink(seg)) return [{ ...seg, gemarkeerd: binnen(seg.van, eind) }];
		const grenzen = [seg.van, ...cuts.filter((c) => c > seg.van && c < eind), eind];
		return grenzen.slice(0, -1).map((a, i) => ({
			content: text.slice(a, grenzen[i + 1]),
			van: a,
			gemarkeerd: binnen(a, grenzen[i + 1])
		}));
	});
	const markers = [...noten].sort((a, b) => (a.at ?? text.length) - (b.at ?? text.length));
	const uit: Segment[] = [];
	let m = 0;
	for (const d of delen) {
		const eind = d.van! + d.content.length;
		const plain = !isLink(d);
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
}
