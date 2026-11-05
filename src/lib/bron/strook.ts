// The numbers behind the Tijdstrook: the kind a bron is counted as, its bars per year on a
// scale relative to the busiest year, the years named on the axis as far as they fit, and the
// count of a period in words. One place for the assignment of kind to colour.
import type { Collection } from '$lib/vocabulary';
import { count, joinAnd, textOf } from '$lib/text/words';
import { kindColour } from './kleur';
import { rubriekOf } from './rubrieken';

type StripKind = 'wetten' | 'rechtspraak' | 'kamerstukken' | 'parlement' | 'regering';

/** The order a bar is stacked in, from the base. */
export const STRIP_KINDS: readonly { id: StripKind; colour: string }[] = [
	{ id: 'wetten', colour: kindColour('instruments') },
	{ id: 'rechtspraak', colour: kindColour('judgments') },
	{ id: 'kamerstukken', colour: kindColour('documents') },
	{ id: 'parlement', colour: kindColour('members') },
	{ id: 'regering', colour: kindColour('ministries') }
];

/**
 * The colour of a publication that changes the law: the diamond, in the colour of the wetten.
 * The strip calls it a "publicatie" (besluit 33).
 */
export const CHANGE_COLOUR = kindColour('instruments');

const KIND_OF: Partial<Record<Collection, StripKind>> = {
	instruments: 'wetten',
	articles: 'wetten',
	annexes: 'wetten',
	judgments: 'rechtspraak',
	documents: 'kamerstukken',
	dossiers: 'kamerstukken',
	activities: 'kamerstukken',
	decisions: 'kamerstukken',
	cases: 'kamerstukken',
	commitments: 'kamerstukken',
	members: 'parlement',
	factions: 'parlement',
	committees: 'parlement',
	cabinets: 'regering',
	ministries: 'regering'
};

export const kindOf = (c: Collection): StripKind | null => KIND_OF[c] ?? null;

/**
 * The collection a bron is counted under on the strip: a bewindspersoon is a member in the API,
 * but Regering, not Parlement (`props` tell them apart, as `kindColour` does).
 */
export const countedAs = (
	collection: Collection,
	props?: Record<string, unknown> | null
): Collection =>
	collection === 'members' && rubriekOf(collection, '', props) === 'regering'
		? 'ministries'
		: collection;

/**
 * The day a bron stands on the strip: its own date, and for a publication (Staatsblad, Trb.,
 * Staatscourant) the day it was published, which the API gives as `date_published` (besluit
 * 33, 41). A law keeps no day: its publication would stretch every strip back to 1991.
 */
export function stripDate(
	props: Record<string, unknown> | null | undefined,
	collection: Collection,
	id = ''
): string | null {
	const own = textOf(props?.date);
	if (own) return own;
	const publication =
		collection === 'instruments' &&
		(props?.kind === 'publicatie' || /^instruments\/(stb|trb|stcrt)_/.test(id));
	return publication ? textOf(props?.date_published) : null;
}

/**
 * What a bron is called in the count, in the order of the bar: only a document is a stuk, as in
 * Tonen; an activiteit or a stemming shares the colour of the Kamerstukken, not their name.
 */
const NOUNS = [
	{ id: 'wetten', one: 'wet', many: 'wetten', of: ['instruments'], kind: 'wetten' },
	{ id: 'artikelen', one: 'artikel', many: 'artikelen', of: ['articles'], kind: 'wetten' },
	{ id: 'bijlagen', one: 'bijlage', many: 'bijlagen', of: ['annexes'], kind: 'wetten' },
	{
		id: 'uitspraken',
		one: 'uitspraak',
		many: 'uitspraken',
		of: ['judgments'],
		kind: 'rechtspraak'
	},
	{ id: 'stukken', one: 'stuk', many: 'stukken', of: ['documents'], kind: 'kamerstukken' },
	{ id: 'dossiers', one: 'dossier', many: 'dossiers', of: ['dossiers'], kind: 'kamerstukken' },
	{
		id: 'activiteiten',
		one: 'activiteit',
		many: 'activiteiten',
		of: ['activities'],
		kind: 'kamerstukken'
	},
	{
		id: 'stemmingen',
		one: 'stemming',
		many: 'stemmingen',
		of: ['decisions'],
		kind: 'kamerstukken'
	},
	{ id: 'kamerzaken', one: 'Kamerzaak', many: 'Kamerzaken', of: ['cases'], kind: 'kamerstukken' },
	{
		id: 'toezeggingen',
		one: 'toezegging',
		many: 'toezeggingen',
		of: ['commitments'],
		kind: 'kamerstukken'
	},
	{
		id: 'parlement',
		one: 'parlementsbron',
		many: 'parlementsbronnen',
		of: ['members', 'factions', 'committees'],
		kind: 'parlement'
	},
	{
		id: 'regering',
		one: 'regeringsbron',
		many: 'regeringsbronnen',
		of: ['cabinets', 'ministries'],
		kind: 'regering'
	}
] as const satisfies readonly {
	id: string;
	one: string;
	many: string;
	of: readonly Collection[];
	kind: StripKind;
}[];

type NounId = (typeof NOUNS)[number]['id'];

const nounOf = (c: Collection) =>
	NOUNS.find((d) => (d.of as readonly Collection[]).includes(c)) ?? null;

const inWords = (counts: ReadonlyMap<NounId, number>) =>
	NOUNS.filter((d) => counts.get(d.id)).map((d) => count(counts.get(d.id)!, d.one, d.many));

/** "1 wet, 200 artikelen en 1 stuk zonder datum": what has no day, by what it is. */
export function undatedText(collections: readonly Collection[]): string | null {
	const n = new Map<NounId, number>();
	for (const c of collections) {
		const noun = nounOf(c);
		if (noun) n.set(noun.id, (n.get(noun.id) ?? 0) + 1);
	}
	const items = inWords(n);
	return items.length ? `${joinAnd(items)} zonder datum` : null;
}

/** A bron on the strip: its year as a fraction, its kind; a wetswijziging is named instead. */
export type Stip = { jaar: number; collection: Collection; change?: string };

type Year = {
	jaar: number;
	/** Per kind, in the stacking order. */
	parts: { id: StripKind; n: number }[];
	/** What they are called, with the colour of their kind: the card of the year says these. */
	words: { id: NounId; text: string; colour: string }[];
	counts: Map<NounId, number>;
	total: number;
	/** The wetswijzigingen of the year, by name. */
	changes: string[];
};

/** The years from `first` to `last`, each with its bronnen per kind and its changes. */
export function perYear(stippen: readonly Stip[], first: number, last: number): Year[] {
	const years: Year[] = Array.from({ length: last - first + 1 }, (_, i) => ({
		jaar: first + i,
		parts: STRIP_KINDS.map((k) => ({ id: k.id, n: 0 })),
		words: [],
		counts: new Map(),
		total: 0,
		changes: []
	}));
	for (const s of stippen) {
		const y = years[Math.floor(s.jaar) - first];
		if (!y) continue;
		if (s.change !== undefined) {
			y.changes.push(s.change);
			continue;
		}
		const kind = kindOf(s.collection);
		if (!kind) continue;
		y.parts.find((d) => d.id === kind)!.n++;
		const noun = nounOf(s.collection);
		if (noun) y.counts.set(noun.id, (y.counts.get(noun.id) ?? 0) + 1);
		y.total++;
	}
	for (const y of years) {
		y.words = NOUNS.filter((d) => y.counts.get(d.id)).map((d) => ({
			id: d.id,
			text: count(y.counts.get(d.id)!, d.one, d.many),
			colour: STRIP_KINDS.find((k) => k.id === d.kind)!.colour
		}));
	}
	return years;
}

/** The busiest year in view: the scale of the bars is relative to it, so none overflows. */
export const busiest = (years: readonly Year[]) => Math.max(1, ...years.map((y) => y.total));

/** The sum of the years from `van` to `tot`, per name, and the changes. */
export function sumPeriod(years: readonly Year[], van: number, tot: number) {
	const per = new Map<NounId, number>();
	let changes = 0;
	for (const y of years) {
		if (y.jaar < van || y.jaar > tot) continue;
		for (const [id, n] of y.counts) per.set(id, (per.get(id) ?? 0) + n);
		changes += y.changes.length;
	}
	return { per, changes };
}

/** "239 uitspraken, 36 stukken, 4 stemmingen": in the order of the bar, a name without bronnen left out. */
export function countParts(
	counts: ReadonlyMap<NounId, number>,
	changes: number
): { text: string; change?: boolean }[] {
	const parts: { text: string; change?: boolean }[] = inWords(counts).map((text) => ({ text }));
	if (changes) parts.push({ text: `${count(changes, 'publicatie', 'publicaties')}`, change: true });
	return parts;
}

/**
 * The count of a phone at rest, whole on its one line: "189 bronnen, 4 zonder datum". The Blad
 * has it by kind (`countParts`, `undatedText`).
 */
export function shortCount(
	counts: ReadonlyMap<NounId, number>,
	changes: number,
	undated: readonly Collection[]
): string {
	const dated = [...counts.values()].reduce((a, b) => a + b, changes);
	const without = undated.filter(nounOf).length;
	return [
		...(dated ? [count(dated, 'bron', 'bronnen')] : []),
		...(without ? [`${without} zonder datum`] : [])
	].join(', ');
}

type AxisYear = { jaar: number; align: 'start' | 'mid' | 'end' };

/**
 * The years named under the bars: the first and the last always, between them every second,
 * fifth, tenth year (as far as the width allows), never two names touching. `width` is the
 * band in pixels, `label` the width of a year.
 */
export function axisYears(first: number, last: number, width: number, label = 30, gap = 8) {
	const span = last - first + 1;
	if (span <= 0) return [];
	const column = width / span;
	const stepOf = [1, 2, 5, 10, 20, 50, 100].find((s) => s * column >= label + gap) ?? 100;
	const out: AxisYear[] = [{ jaar: first, align: 'start' }];
	if (last === first) return out;
	const lastLeft = width - label;
	for (let j = first + stepOf; j < last; j += stepOf) {
		const mid = (j - first + 0.5) * column;
		if (mid - label / 2 < label + gap) continue;
		if (mid + label / 2 > lastLeft - gap) continue;
		out.push({ jaar: j, align: 'mid' });
	}
	out.push({ jaar: last, align: 'end' });
	return out;
}
