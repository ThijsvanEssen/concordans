// The meta of one edge, read once: the lid it names, where it stands in the citing text, the
// passage and the phrase in it. The row of Verbonden, the card of the canvas and the line on
// the canvas all read it here, so they say the same of one verbinding.
import { parseQualifier } from '$lib/text/qualifier';
import { paragraphCite } from '$lib/text/judgment-cite';
import { formatAnchor } from '$lib/text/anchor';
import {
	metVoetnoot,
	nootAnker,
	stukPlaats,
	voetnootWoord,
	type Bereik
} from '$lib/text/voetnoten';

/** A string with its words, or null: what an API field carries where it carries anything. */
export const text = (value: unknown): string | null =>
	typeof value === 'string' && value.trim() ? value.trim() : null;

/** Derived, not read from the source: a confidence below 1. */
export const isDerived = (confidence: number | null | undefined): boolean =>
	confidence != null && confidence < 1;

/**
 * The lid a verbinding names, read from the phrase the source used
 * ("artikel 300, tweede lid"). Null when it names none.
 * TODO(backend B7, B8, B12): a lookup once the edge meta carries `lid`.
 */
export function lidOfMatch(match: string | null | undefined): string | null {
	if (!match) return null;
	const q = parseQualifier(match);
	return q?.lid ?? null;
}

const paragraphAnchor = (number: string) => formatAnchor({ kind: 'paragraph', number });

const POSITION_PREFIX = /^(r\.o\.|onder|§)\s*/;

/**
 * `r.o. 2.2.2`, `r.o. 2.2.2 en 2.4.1`, `r.o. 2.2.2, 2.4.1 en 19 meer`; `onder` in a
 * conclusion, `§` in a judgment of the EHRM (`paragraphCite`).
 */
export function positionsLabel(positions: string[]): string | null {
	const numbers = positions.map((p) => p.replace(POSITION_PREFIX, ''));
	if (numbers.length === 0) return null;
	const prefix = POSITION_PREFIX.exec(positions[0])?.[0] ?? '';
	if (numbers.length === 1) return prefix + numbers[0];
	if (numbers.length === 2) return `${prefix}${numbers[0]} en ${numbers[1]}`;
	return `${prefix}${numbers[0]}, ${numbers[1]} en ${numbers.length - 2} meer`;
}

/** A place an edge keeps of a judgment's citation, with `edge_meta=passages` (API 0.79.55). */
type EdgePassage = {
	paragraph_id?: unknown;
	paragraph_number?: unknown;
	footnote?: unknown;
	snippet?: unknown;
	text?: unknown;
	start?: unknown;
	end?: unknown;
};

/** Where an edge stands in the citing text, as far as its meta says. */
export type EdgePlace = {
	snippet?: string | null;
	match?: string | null;
	/** The paragraph of the citing text the passage is in: `rov-3.4`. */
	passageAt?: string | null;
	/** The footnote the passage stands in: its anchor (`fn-35`) and its label as printed. */
	noot?: { id: string; label: string | null } | null;
	bereik?: Bereik | null;
	position?: string | null;
};

/**
 * Where an edge stands in the text that cites, from its meta: the first passage a judgment's
 * edge keeps (`passages`, asked where a row shows it), with its note (`r.o. 5.7.6 (voetnoot
 * 35)`); a Kamerstuk's place (`place`): its note, or its section, with the words' offsets.
 * `ecli` is the citing judgment's, where it is known: its r.o. is cited as it cites.
 */
export function plaatsVanEdge(meta: Record<string, unknown>, ecli: string | null): EdgePlace {
	const passages = Array.isArray(meta.passages) ? (meta.passages as EdgePassage[]) : [];
	const p = passages[0];
	if (p && typeof p.snippet === 'string' && p.snippet) {
		const nr = text(p.paragraph_number);
		const label = text(p.footnote);
		const start = typeof p.start === 'number' ? p.start : null;
		const end = typeof p.end === 'number' ? p.end : null;
		const words = start != null && end != null && end > start ? p.snippet.slice(start, end) : null;
		const own = positionsLabel(
			passages
				.map((q) => text(q.paragraph_number))
				.filter((x): x is string => !!x)
				.filter((x, i, all) => all.indexOf(x) === i)
				.map((x) => paragraphCite(ecli, x))
		);
		return {
			snippet: p.snippet,
			match: words ?? text(p.text),
			passageAt: nr ? paragraphAnchor(nr) : text(p.paragraph_id),
			noot: label ? { id: nootAnker(label), label } : null,
			// The note goes with the place it is in: the first passage's, the others after it.
			...(label && nr
				? { position: metVoetnoot(paragraphCite(ecli, nr), label) }
				: own
					? { position: own }
					: label
						? { position: voetnootWoord(label) }
						: {})
		};
	}
	const place = stukPlaats(meta);
	if (place?.part === 'footnote')
		return {
			noot: { id: place.at, label: place.label },
			bereik: place.bereik,
			...(place.label ? { position: voetnootWoord(place.label) } : {})
		};
	if (place?.part === 'text') return { passageAt: place.at, bereik: place.bereik };
	return {};
}

/**
 * Where an edge stands in its source, from its meta: the light meta of a node's response
 * gives the numbers of the paragraphs (`paragraphs: ["6", "7"]`), one mention its own
 * (`paragraph_number`, `paragraph_id`). `r.o. 6 en 7` and the anchor of the first, so the
 * line, the card and its Lees open where the row does.
 */
export function plaatsVanMeta(
	meta: Record<string, unknown> | null | undefined,
	ecli: string | null
): { position: string | null; at: string | null } {
	const m = meta ?? {};
	const numbers = Array.isArray(m.paragraphs)
		? m.paragraphs.filter((p): p is string => typeof p === 'string' && !!p)
		: [];
	const one = text(m.paragraph_number);
	const all = numbers.length ? numbers : one ? [one] : [];
	return {
		position: positionsLabel(all.map((nr) => paragraphCite(ecli, nr))),
		at: text(m.paragraph_id) ?? (all[0] ? paragraphAnchor(all[0]) : null)
	};
}

/** What an edge's meta says of the verbinding, for its row, its card and its line. */
export type EdgeReading = {
	/** The lid of the cited article: `2`. */
	lid: string | null;
	/** The phrase that cites: `artikel 3:2, tweede lid`. */
	match: string | null;
	/** The passage the phrase stands in. */
	snippet: string | null;
	/** Where in the citing text: `r.o. 6 en 7`, `r.o. 5.7.6 (voetnoot 35)`. */
	position: string | null;
	/** The anchor in the citing text: the note, the passage, or the first paragraph. */
	at: string | null;
	passageAt: string | null;
	noot: { id: string; label: string | null } | null;
	bereik: Bereik | null;
	/** Why the edge exists, as the pipeline wrote it. */
	reason: string | null;
};

/**
 * One edge's meta, read once. `direction` is the edge's as seen from the cited end: inbound
 * where the other end cites, so the phrase names the cited article's lid. `citingEcli` is the
 * citing judgment's, where it is one: its r.o. is cited as it cites.
 */
export function readEdge(
	meta: Record<string, unknown> | null | undefined,
	{ direction, citingEcli }: { direction: 'inbound' | 'outbound'; citingEcli: string | null }
): EdgeReading {
	const m = meta ?? {};
	const phrase = text(m.raw_match) ?? text(m.qualifier);
	const lid =
		(Array.isArray(m.leden) && text(m.leden[0])) ||
		text(m.lid) ||
		(direction === 'inbound' ? lidOfMatch(phrase) : null);
	const place = plaatsVanEdge(m, citingEcli);
	const paragraphs = plaatsVanMeta(m, citingEcli);
	return {
		lid,
		match: place.match ?? phrase,
		snippet: place.snippet ?? text(m.snippet),
		position: place.position ?? paragraphs.position,
		at: place.noot?.id ?? place.passageAt ?? paragraphs.at,
		passageAt: place.passageAt ?? null,
		noot: place.noot ?? null,
		bereik: place.bereik ?? null,
		reason: text(m.reason)
	};
}
