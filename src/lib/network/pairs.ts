// Verband as one weergave (DS Verband): every row is a chain from one chosen bron to another,
// also at one step, where its kenmerk (what both name) stands between them. This module reads
// what /api/nodes/shared (one step) and /api/chains (two and three) give, and makes the blocks
// of rows, the Keuze of a pair for three to six bronnen and the words of a step. Pure, so the
// drawing on a wide screen and the list on a phone read one model.
import { formatCount } from '$lib/text/getal';
import { joinAnd } from '$lib/text/words';
import { dossierNummer, dossierNumberLabel, officialNumber } from '$lib/bron/dossier-naam';
import { bothPhrase, joinsAll } from './both-words';
import type { Collection } from '$lib/vocabulary';
import {
	MAX_ROWS,
	countOf,
	type ChainBlock,
	type ChainBron,
	type ChainRow,
	type ChainStep,
	type ChainsState,
	type StepLeg
} from './linkchains';
import type { SharedRow, SharedModel } from './shared';

/** A chosen bron as Verband knows it: written out for the head of its column, short for the Keuze. */
export type PairEnd = {
	id: string;
	name: string;
	short: string;
	collection: Collection | null;
	/** The props of the bron, where its sign depends on them (a European regel). */
	props?: Record<string, unknown> | null;
};

/**
 * A dossier is named by its number ("36496 Wet betaalbare huur", DS Netwerkcanvas, Tekst), so
 * that it never reads as the wet of the same name: in the Keuze, the head of its column and the
 * list alike. Other bronnen keep their name.
 */
export function withDossierNumbers(ends: readonly PairEnd[]): PairEnd[] {
	const withNumber = (e: PairEnd, name: string) => {
		const nummer = officialNumber(
			dossierNummer(e.props, e.id.split('/')[1]) ?? e.id.split('/')[1] ?? ''
		);
		if (!nummer || name.startsWith(nummer)) return name;
		return name === dossierNumberLabel(nummer) ? nummer : `${nummer} ${name}`;
	};
	return ends.map((e) =>
		e.collection === 'dossiers'
			? { ...e, name: withNumber(e, e.name), short: withNumber(e, e.short) }
			: e
	);
}

/** The value of the Keuze that takes every chosen bron. */
export const ALL = 'alle';

/** More options than this are a list, not a row of buttons. */
const MOST_BUTTONS = 4;

const COUNT_WORD = ['', '', 'twee', 'drie', 'vier', 'vijf', 'zes'];

type ChoiceOption = { value: string; label: string; count: number };

/** A pair as the address names it: the ids in the order of the ends, with a comma. */
const pairValue = (a: string, b: string) => `${a},${b}`;

/** The pairs of the ends, in their order. */
const pairsOf = (ends: readonly PairEnd[]): [PairEnd, PairEnd][] =>
	ends.flatMap((a, i) => ends.slice(i + 1).map((b): [PairEnd, PairEnd] => [a, b]));

const hangsAt = (r: SharedRow, ids: readonly string[]) => ids.every((id) => r.at.includes(id));

/** What a pair shares in all (the API's total), from the model. */
const sharedBy = (model: SharedModel, a: string, b: string) =>
	model.pairs.find((p) => p.at.includes(a) && p.at.includes(b))?.total ?? 0;

/** Whether the Keuze is a list: too many options for a row of buttons. */
export const isMenu = (options: readonly ChoiceOption[]) => options.length > MOST_BUTTONS;

/**
 * The Keuze of Verband for three to six chosen bronnen: `Alle drie (6)` and each pair with what
 * it shares in all. Two bronnen have none.
 */
export function options(ends: readonly PairEnd[], model: SharedModel): ChoiceOption[] {
	if (ends.length < 3) return [];
	const all = model.rows.filter((r) =>
		hangsAt(
			r,
			ends.map((e) => e.id)
		)
	).length;
	return [
		{ value: ALL, label: `Alle ${COUNT_WORD[ends.length]}`, count: all },
		...pairsOf(ends).map(([a, b]) => ({
			value: pairValue(a.id, b.id),
			label: `${a.short} en ${b.short}`,
			count: sharedBy(model, a.id, b.id)
		}))
	];
}

/**
 * The choice shown: what the address says if it names one of the options, else Alle drie when
 * those rows exist, else the first pair. Two bronnen are one pair.
 */
export function resolveChoice(
	asked: string | null,
	ends: readonly PairEnd[],
	model: SharedModel | null
): string {
	const pairs = pairsOf(ends).map(([a, b]) => pairValue(a.id, b.id));
	if (ends.length < 3) return pairs[0] ?? '';
	if (asked === ALL) return ALL;
	const given = asked?.split(',').sort().join(',');
	const named = pairs.find((p) => p.split(',').sort().join(',') === given);
	if (named) return named;
	const hasAll =
		!!model &&
		model.rows.some((r) =>
			hangsAt(
				r,
				ends.map((e) => e.id)
			)
		);
	return hasAll ? ALL : pairs[0];
}

/** The pair a choice names, in the order of the ends; null for Alle. */
export const pairOf = (choice: string): [string, string] | null =>
	choice === ALL || !choice ? null : (choice.split(',') as [string, string]);

/** `één stap`, `twee stappen`: a length in words. */
export const stepsText = (n: number) =>
	['', 'één stap', 'twee stappen', 'drie stappen'][n] ?? `${n} stappen`;

type How = SharedRow['how'][number];

const legOf = (h: How | undefined, side: 'start' | 'end'): StepLeg => ({
	relation: h?.relation ?? null,
	from: h?.from ?? null,
	// Toward the row is toward the kenmerk: at the end of the leg to it, at the start of the leg from it.
	arrow: !h ? null : (h.toward === 'row') === (side === 'end') ? 'end' : 'start'
});

/** How a kenmerk joins the chosen bronnen, in words: `noemt beide`, `beide lid van`. */
function namesBoth(row: SharedRow, ats: readonly string[]): string {
	const hows = ats.map((id) => row.how.find((h) => h.bron === id)).filter((h): h is How => !!h);
	const phrases = new Set(
		hows.map((h) => bothPhrase(h.relation, row.collection, h.toward === 'row', ats.length))
	);
	// One phrase where every chosen bron is joined alike; where they differ, none claims more.
	if (phrases.size === 1) return [...phrases][0];
	return joinsAll(ats.length);
}

const bronOf = (e: PairEnd): ChainBron => ({ id: e.id, name: e.name, collection: e.collection });

/** A shared bron as the kenmerk of a row of one step. */
function sharedBron(r: SharedRow): ChainBron {
	return { id: r.id, name: r.name, collection: r.collection, node: r.node };
}

/** One step through what the chosen bronnen share: the row of a Kamerstuk, an uitspraak. */
function oneStep(r: SharedRow, left: PairEnd, right: PairEnd, extra: readonly PairEnd[]): ChainRow {
	const via = sharedBron(r);
	const ats = [left, right, ...extra].map((e) => e.id);
	const text = namesBoth(r, ats);
	const how = (id: string) => r.how.find((h) => h.bron === id);
	return {
		id: r.id,
		bronnen: [bronOf(left), bronOf(right)],
		steps: [
			{
				from: bronOf(left),
				to: bronOf(right),
				via,
				text,
				phone: text,
				weight: null,
				legs: [legOf(how(left.id), 'end'), legOf(how(right.id), 'start')],
				pair: joinAnd([left.name, right.name])
			}
		],
		also: extra.map((e) => ({ bron: bronOf(e), leg: legOf(how(e.id), 'start') }))
	};
}

/** The step between the two chosen bronnen themselves: a line, no kenmerk. */
function directStep(d: SharedModel['direct'][number], left: PairEnd, right: PairEnd): ChainRow {
	const toRight = d.to === right.id;
	const step: ChainStep = {
		from: bronOf(left),
		to: bronOf(right),
		via: null,
		text: d.verb,
		phone: d.text,
		weight: null,
		legs: [
			{
				relation: d.relation,
				from: (toRight ? left : right).collection,
				arrow: toRight ? 'end' : 'start'
			}
		],
		pair: joinAnd([left.name, right.name])
	};
	return { id: `direct~${d.from}~${d.to}`, bronnen: [bronOf(left), bronOf(right)], steps: [step] };
}

/** The block Eén stap of a choice: the direct steps first, then what is shared, the most cited first. */
export function oneStepBlock(o: {
	ends: readonly PairEnd[];
	model: SharedModel;
	choice: string;
	/** Whether a filter of the strip leaves a shared bron out. */
	keep: (r: SharedRow) => boolean;
	/** A filter narrows: the count is what is left, not the API's total. */
	narrowed: boolean;
}): ChainBlock {
	const { ends, model, choice } = o;
	const pair = pairOf(choice);
	const [left, right, ...extra] = pair
		? pair.map((id) => ends.find((e) => e.id === id)!)
		: [...ends];
	const members = pair ? [left, right] : ends;
	const shared = model.rows.filter(
		(r) =>
			hangsAt(
				r,
				members.map((e) => e.id)
			) && o.keep(r)
	);
	const direct = pair
		? model.direct.filter((d) => d.at.includes(left.id) && d.at.includes(right.id))
		: [];
	const rows = [
		...direct.map((d) => directStep(d, left, right)),
		...shared.map((r) => oneStep(r, left, right, pair ? [] : extra))
	];
	const known = pair ? sharedBy(model, left.id, right.id) + direct.length : rows.length;
	const total = o.narrowed ? rows.length : Math.max(known, rows.length);
	return {
		steps: 1,
		title: 'Eén stap',
		rows: rows.slice(0, MAX_ROWS),
		total,
		complete: true,
		count: countOf(Math.min(rows.length, MAX_ROWS), total, true)
	};
}

/** What Verband draws: the heads of its columns and the blocks of its rows. */
export type PairDrawing = {
	left: PairEnd;
	right: PairEnd;
	/** Bronnen beyond the second, drawn as a second end under the right one (Alle drie). */
	extra: PairEnd[];
	blocks: ChainBlock[];
	/** Blocks of two and three steps still to come, or failed: the page says it. */
	pending: number[];
};

export function drawing(o: {
	ends: readonly PairEnd[];
	model: SharedModel;
	choice: string;
	steps: number;
	chains: ChainsState | null;
	keep: (r: SharedRow) => boolean;
	narrowed: boolean;
}): PairDrawing {
	const pair = pairOf(o.choice);
	const [left, right, ...extra] = pair
		? pair.map((id) => o.ends.find((e) => e.id === id)!)
		: [...o.ends];
	const first = oneStepBlock(o);
	const more = pair && o.chains?.status === 'ready' ? o.chains.model.blocks : [];
	const wanted = pair ? Array.from({ length: Math.max(0, o.steps - 1) }, (_, i) => i + 2) : [];
	return {
		left,
		right,
		extra: pair ? [] : extra,
		blocks: [first, ...more],
		pending: o.chains?.status === 'ready' ? [] : wanted
	};
}

/** The name of the drawing, which says its first ketens in words (for a screen reader). */
export function drawingLabel(d: PairDrawing): string {
	const names = [d.left, d.right, ...d.extra].map((e) => e.name);
	const rows = d.blocks.flatMap((b) => b.rows.map((r) => ({ r, b })));
	const head = `Ketens tussen ${joinAnd(names)}`;
	if (rows.length === 0) return head;
	const said = rows.slice(0, 5).map(({ r, b }) => {
		const steps = stepsText(b.steps);
		const between = r.steps
			.flatMap((s) => (s.via ? [s.via.name] : []))
			.concat(r.bronnen.slice(1, -1).map((x) => x.name));
		return `${steps}, ${between.length ? between.join(', ') : r.steps[0]?.text}`;
	});
	const more = rows.length - said.length;
	return `${head}: ${said.join('; ')}${more > 0 ? `; en ${formatCount(more)} meer` : ''}`;
}

/** The ids a row holds: its bronnen and the kenmerken between them, for marking a row. */
export const rowIds = (r: ChainRow): string[] => [
	...r.bronnen.map((b) => b.id),
	...r.steps.flatMap((s) => (s.via ? [s.via.id] : []))
];
