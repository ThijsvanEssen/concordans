// The numbers behind the Tijdstrook: the kind a bron is counted as, its bars per year on a
// scale relative to the busiest year, the years named on the axis as far as they fit, and the
// count of a period in words. One place for the assignment of kind to colour.
import type { Collection } from '$lib/vocabulary';
import { count } from '$lib/text/words';
import { kindColour } from './kleur';

type StripKind = 'wetten' | 'rechtspraak' | 'kamerstukken' | 'parlement';

/** The order a bar is stacked in, from the base; the words as the hover and the count say them. */
export const STRIP_KINDS: readonly {
	id: StripKind;
	one: string;
	many: string;
	colour: string;
}[] = [
	{ id: 'wetten', one: 'wet', many: 'wetten', colour: kindColour('instruments') },
	{ id: 'rechtspraak', one: 'uitspraak', many: 'uitspraken', colour: kindColour('judgments') },
	{ id: 'kamerstukken', one: 'stuk', many: 'stukken', colour: kindColour('documents') },
	{
		id: 'parlement',
		one: 'parlementsbron',
		many: 'parlementsbronnen',
		colour: kindColour('members')
	}
];

/** The colour of a wetswijziging: the diamond, in the colour of the wetten. */
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
	cabinets: 'parlement',
	ministries: 'parlement'
};

export const kindOf = (c: Collection): StripKind | null => KIND_OF[c] ?? null;

/** A bron on the strip: its year as a fraction, its kind; a wetswijziging is named instead. */
export type Stip = { jaar: number; collection: Collection; change?: string };

type Year = {
	jaar: number;
	/** Per kind, in the stacking order. */
	parts: { id: StripKind; n: number }[];
	total: number;
	/** The wetswijzigingen of the year, by name. */
	changes: string[];
};

/** The years from `first` to `last`, each with its bronnen per kind and its changes. */
export function perYear(stippen: readonly Stip[], first: number, last: number): Year[] {
	const years: Year[] = Array.from({ length: last - first + 1 }, (_, i) => ({
		jaar: first + i,
		parts: STRIP_KINDS.map((k) => ({ id: k.id, n: 0 })),
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
		y.total++;
	}
	return years;
}

/** The busiest year in view: the scale of the bars is relative to it, so none overflows. */
export const busiest = (years: readonly Year[]) => Math.max(1, ...years.map((y) => y.total));

/** The sum of the years from `van` to `tot`, per kind, and the changes. */
export function sumPeriod(years: readonly Year[], van: number, tot: number) {
	const per = new Map<StripKind, number>();
	let changes = 0;
	for (const y of years) {
		if (y.jaar < van || y.jaar > tot) continue;
		for (const d of y.parts) per.set(d.id, (per.get(d.id) ?? 0) + d.n);
		changes += y.changes.length;
	}
	return { per, changes };
}

/** "239 uitspraken, 36 stukken": the kinds in the order of the bar, a kind without bronnen left out. */
export function countParts(
	counts: ReadonlyMap<StripKind, number>,
	changes: number
): { text: string; change?: boolean }[] {
	const parts: { text: string; change?: boolean }[] = [];
	for (const k of STRIP_KINDS) {
		const n = counts.get(k.id) ?? 0;
		if (n) parts.push({ text: `${count(n, k.one, k.many)}` });
	}
	if (changes) parts.push({ text: `${count(changes, 'wijziging', 'wijzigingen')}`, change: true });
	return parts;
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
