// What the werkplek does from ⌘K (lib/keys/doen.svelte.ts): its weergaven, its steps, Tonen and
// Relatie. The page hands its state and its ways over (`Werkplek`); the rows
// say in words what each does, and why where it cannot be done here.
import type { Doer, DoRow, Target } from '$lib/keys/doen.svelte';
import type { Parsed, Soort } from '$lib/keys/commands';
import { FILTER_GROUPS, withFilterGroup, type VerbondenFilter } from '$lib/verbonden/filter';
import { LINE_KINDS, type LineKind } from '$lib/graph/line-kind';
import { count } from '$lib/text/words';

export type ViewId = 'omgeving' | 'verband' | 'keten';

export type Werkplek = {
	/** The werkplek is up (else the text of the bron). */
	graph: boolean;
	view: ViewId;
	/** A bron or a netwerk to view: else there is nothing to view three ways. */
	hasBron: boolean;
	/** The bron here, or one chosen, has a keten. */
	chainPossible: boolean;
	/** Two bronnen to compare. */
	verbandPossible: boolean;
	/** The weergave `w`, from the reader too. */
	toView: (w: ViewId) => void;
	/** `target` joins the netwerk, and Verband shows what it shares with the rest. */
	verbandWith: (target: Target) => void;
	/** Where Alt L leads from here: the text, the netwerk, or nowhere (a netwerk without a bron). */
	toggle: 'read' | 'network' | null;
	toggleView: () => void;
	/** Aantal stappen as it stands, and the steps offered (0 only with chosen bronnen). */
	depth: number;
	steps: readonly number[];
	setDepth: (d: number) => void;
	/** Tonen (the bronfilter) and Relatie (the lines off) as they stand. */
	filter: VerbondenFilter;
	linesOff: ReadonlySet<LineKind>;
	/** Both in one step of the address: either left as it is where null. */
	setFilters: (filter: VerbondenFilter | null, linesOff: LineKind[] | null) => void;
	say: (text: string) => void;
};

const LABEL: Record<ViewId, string> = {
	omgeving: 'Omgeving',
	verband: 'Verband',
	keten: 'Keten'
};

const NEEDS_TWO = 'Verband vraagt een tweede bron: typ verband en een bron';

function viewRow(w: Werkplek, to: ViewId, why: string | null): DoRow {
	return {
		id: to,
		label: `Weergave ${LABEL[to]}`,
		word: to,
		now: w.graph && w.view === to,
		...(why ? { why } : { run: () => w.toView(to) })
	};
}

function viewRows(w: Werkplek, p: Parsed, target: Target | null): DoRow[] {
	if (!w.hasBron) return [];
	const id = p.command.id;
	if (id === 'omgeving') return w.graph ? [viewRow(w, 'omgeving', null)] : [];
	if (id === 'keten')
		// `keten awb` opens the Awb's own: the doer of every page (lib/keys/doen-overal.ts).
		return p.rest
			? []
			: [viewRow(w, 'keten', w.chainPossible ? null : 'Keten is er bij een wet of een artikel')];
	if (id !== 'verband') return [];
	if (!p.rest) return [viewRow(w, 'verband', w.verbandPossible ? null : NEEDS_TWO)];
	return [
		target
			? {
					id: 'verband-met',
					label: `Verband met ${target.label}`,
					run: () => w.verbandWith(target)
				}
			: { id: 'verband-met', label: `Verband met ${p.rest}`, why: 'zoekt de bron…', pending: true }
	];
}

const stepsWord = (n: number) => (n === 0 ? 'Alleen gekozen' : count(n, 'stap', 'stappen'));

function stepRows(w: Werkplek, p: Parsed): DoRow[] {
	if (!w.graph) return [];
	if (w.view === 'keten')
		return [{ id: 'stappen', label: 'Aantal stappen', why: 'Keten heeft geen stappen' }];
	const asked = p.command.id === 'gekozen' ? 0 : p.steps;
	const row = (n: number): DoRow => ({
		id: `stappen-${n}`,
		label: stepsWord(n),
		word: n === 0 ? 's0' : `s${n}`,
		now: w.depth === n,
		...(w.steps.includes(n)
			? { run: () => (w.setDepth(n), w.say(stepsWord(n))) }
			: { why: n === 0 ? 'Alleen gekozen vraagt gekozen bronnen' : `Kies ${w.steps.join(', ')}` })
	});
	return asked === undefined ? w.steps.map(row) : [row(asked)];
}

const isOn = (w: Werkplek, s: Soort) =>
	s.kind === 'soort'
		? w.filter.bronnen === null || w.filter.bronnen.has(s.id)
		: !w.linesOff.has(s.id);

/** Soort `s` on or off, or alone. */
function switchSoort(w: Werkplek, s: Soort, to: 'on' | 'off' | 'only') {
	if (s.kind === 'relatie') {
		const off = new Set(w.linesOff);
		if (to === 'on') off.delete(s.id);
		else if (to === 'off') off.add(s.id);
		return w.setFilters(null, to === 'only' ? LINE_KINDS.filter((l) => l !== s.id) : [...off]);
	}
	if (to === 'on') return w.setFilters(withFilterGroup(w.filter, s.id), null);
	const bronnen = new Set(to === 'only' ? [s.id] : (w.filter.bronnen ?? FILTER_GROUPS));
	if (to === 'off') bronnen.delete(s.id);
	w.setFilters({ ...w.filter, bronnen }, null);
}

function soortRows(w: Werkplek, p: Parsed): DoRow[] {
	if (!w.graph) return [];
	if (p.command.id === 'alles')
		return [
			{
				id: 'alles',
				label: 'Alle soorten en relaties',
				now: w.filter.bronnen === null && w.linesOff.size === 0,
				run: () => (w.setFilters({ ...w.filter, bronnen: null }, []), w.say('Alles weer zichtbaar'))
			}
		];
	const s = p.soort;
	if (!s) return [];
	if (s.kind === 'relatie' && w.view !== 'omgeving')
		return [
			{ id: 'relatie', label: s.label, why: `Relatie staat in ${LABEL[w.view]} in de zijbalk` }
		];
	const to = p.command.id === 'tonen' ? 'on' : p.command.id === 'zonder' ? 'off' : 'only';
	const label = {
		on: `${s.label} tonen`,
		off: `${s.label} verbergen`,
		only: `Alleen ${s.label.toLowerCase()}`
	}[to];
	return [
		{
			id: `soort-${to}`,
			label,
			now: to === 'only' ? false : isOn(w, s) === (to === 'on'),
			run: () => (switchSoort(w, s, to), w.say(label))
		}
	];
}

/** Before anything is typed: the weergaven with the one that stands, and the way of Alt L. */
function hereRows(w: Werkplek): DoRow[] {
	if (!w.hasBron) return [];
	const rows = w.graph
		? [
				viewRow(w, 'omgeving', null),
				viewRow(w, 'verband', w.verbandPossible ? null : NEEDS_TWO),
				viewRow(w, 'keten', w.chainPossible ? null : 'Keten is er bij een wet of een artikel')
			]
		: w.chainPossible
			? [viewRow(w, 'keten', null)]
			: [];
	if (w.graph && w.view !== 'keten')
		rows.push({
			id: 'stappen',
			label: `Aantal stappen: ${stepsWord(w.depth).toLowerCase()}`,
			word: 's0 – s3',
			fill: 'stappen '
		});
	if (w.toggle)
		rows.push({
			id: 'toggle',
			label: w.toggle === 'read' ? 'Naar de tekst' : 'Naar het netwerk',
			key: 'toggle-view',
			run: w.toggleView
		});
	return rows;
}

/** The doer of the werkplek, reading its state as it is when asked. */
export function werkplekDoer(state: () => Werkplek): Doer {
	return {
		rows: (p, target) => {
			const w = state();
			const arg = p.command.arg;
			if (arg === 'stappen' || p.command.id === 'gekozen') return stepRows(w, p);
			if (arg === 'soort' || p.command.id === 'alles') return soortRows(w, p);
			return viewRows(w, p, target);
		},
		here: () => hereRows(state())
	};
}
