// What the werkplek does from ⌘K (lib/keys/doen.svelte.ts): its weergaven. The page hands its
// state and its ways over (`Werkplek`); the rows say in words what each does, and why where it
// cannot be done here.
import type { Doer, DoRow, Target } from '$lib/keys/doen.svelte';
import type { Parsed } from '$lib/keys/commands';

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
		rows: (p, target) => viewRows(state(), p, target),
		here: () => hereRows(state())
	};
}
