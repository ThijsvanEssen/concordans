import { NOT_IN_DATA } from '$lib/text/coverage';
import { capitalize } from '$lib/text/words';
import { korteDatum } from '$lib/text/datum';
import type { Schema } from '$lib/api/types';
import { CHAMBER_NAME } from './chamber';
import { methodPhrase, phasePlace, voteMethod, type PhaseName } from './stages';

// Where a bill stands, per body that handles it, Raad van
// State, Tweede Kamer, Eerste Kamer, and one sentence that says it with a date. Derived from
// the list item only; no field of our own.

type Dossier = Schema<'DossierSummaryDTO'>;
type Detail = Schema<'DossierDetailResponse'>;

/** `unknown`: the source gives no mark, which is not the same as not done. */
type BodyState = 'done' | 'now' | 'open' | 'none' | 'unknown';
export type Body = { name: string; short: string; state: BodyState };
type StandGroup = 'ek' | 'tk' | 'ingediend' | 'afgehandeld' | 'geen';

export type Stand = {
	bodies: [Body, Body, Body];
	/** One sentence, concrete: who, what, when. */
	zin: string;
	group: StandGroup;
	/** The phase at the Tweede Kamer as the sentence names it (`verslag`); null outside it. */
	phase: string | null;
	/** The day the sentence names (ISO); null for none. */
	date: string | null;
};

const phaseOf = (d: Dossier, name: PhaseName) => d.phases?.find((p) => p.name === name);
const dateOf = (d: Dossier, name: PhaseName) => phaseOf(d, name)?.date ?? null;
/** `als hamerstuk` after a word in a sentence, nothing for a vote. */
const spaced = (phrase: string | null) => (phrase ? ` ${phrase}` : '');

export function stand(d: Dossier): Stand | null {
	// A phase is done where the source marks it so, and only there: a later phase does not
	// stand in for an earlier one (Thijs, BE-27). A phase without a mark is not in the data.
	const done = (name: PhaseName) => !!phaseOf(d, name)?.done;
	if (!d.current_phase && !d.tk_decision && !d.ek_outcome) return null;

	const rvs: BodyState = done('Advies Raad van State') ? 'done' : 'unknown';
	const tkDone = !!d.tk_decision || done('Eindtekst') || (d.closed && d.outcome === 'aangenomen');
	const ekDone = !!d.ek_outcome;
	const rejected = d.outcome === 'verworpen';

	const tk: BodyState = tkDone || rejected ? 'done' : 'now';
	const ek: BodyState = ekDone
		? 'done'
		: rejected
			? 'none'
			: tkDone && !d.closed
				? 'now'
				: d.closed
					? 'done'
					: 'open';

	const bodies: [Body, Body, Body] = [
		{ name: 'Raad van State', short: 'RvS', state: rvs },
		{ name: CHAMBER_NAME.TK, short: 'TK', state: tk },
		{ name: CHAMBER_NAME.EK, short: 'EK', state: ek }
	];
	const on = (date: string | null, before: string) => (date ? `${before}${korteDatum(date)}` : '');
	const place = phasePlace(d.current_phase);

	if (d.ek_outcome) {
		const { outcome, date, method } = d.ek_outcome;
		const zin = `${outcome} door de Eerste Kamer${spaced(methodPhrase(method))}, ${korteDatum(date)}.`;
		return { bodies, zin, group: 'afgehandeld', phase: null, date: date ?? null };
	}
	if (rejected || d.closed) {
		const date = d.closed_on ?? null;
		const zin = rejected
			? `Verworpen door de Tweede Kamer${on(date, ', ')}.`
			: `Afgehandeld${on(date, ' ')}.`;
		return { bodies, zin, group: 'afgehandeld', phase: null, date };
	}
	if (tkDone) {
		const date = d.tk_decision?.date ?? dateOf(d, 'Eindtekst');
		const how = spaced(methodPhrase(null, d.tk_decision?.kind));
		const zin = `Door de Tweede Kamer${how} aangenomen${on(date, ' op ')}; bij de Eerste Kamer.`;
		return { bodies, zin, group: 'ek', phase: null, date };
	}
	if (place?.stage === 'tk') {
		const date = dateOf(d, d.current_phase as PhaseName);
		const zin = `Bij de Tweede Kamer: ${place.phrase}${on(date, ', ')}.`;
		return { bodies, zin, group: 'tk', phase: place.phrase, date };
	}
	if (place?.stage === 'submitted') {
		const date = dateOf(d, 'Voorstel van wet') ?? d.opened_on ?? null;
		const advice = rvs === 'done' ? ', met advies van de Raad van State' : '';
		const zin = `Ingediend bij de Tweede Kamer${on(date, ' op ')}${advice}.`;
		return { bodies, zin, group: 'ingediend', phase: null, date };
	}
	return { bodies, zin: d.current_phase ?? '', group: 'geen', phase: null, date: null };
}

/** The mark of a box, as Uitkomst draws it. */
type Mark = 'ja' | 'nee' | 'nu' | 'open' | 'klaar';
/** A box of the bar: the body, its mark and word, and a line with the day under it. */
export type Box = { body: string; mark: Mark; word: string; line: string };

const box = (body: string, mark: Mark, word: string, ...line: (string | null)[]): Box => ({
	body,
	mark,
	word,
	line: line.filter(Boolean).join(', ')
});

/**
 * The stand of a bill as three boxes, in the order of the procedure; none without a stand.
 * Works on a list item and on the detail, whose Eerste Kamer says where the bill is.
 */
export function boxesOf(d: Dossier | Detail): Box[] {
	const st = stand(d);
	if (!st) return [];
	const [rvs, tk, ek] = st.bodies;

	const advice =
		rvs.state === 'done'
			? box(
					rvs.name,
					'klaar',
					'Advies',
					'Uitgebracht',
					korteDatum(dateOf(d, 'Advies Raad van State'))
				)
			: // No mark in the source: not in the data, which is not "not yet".
				box(rvs.name, 'open', 'Advies', capitalize(NOT_IN_DATA));

	const tweede = d.tk_decision
		? box(
				tk.name,
				'ja',
				'Aangenomen',
				korteDatum(d.tk_decision.date),
				voteMethod(null, d.tk_decision.kind)
			)
		: d.outcome === 'verworpen'
			? box(tk.name, 'nee', 'Verworpen', korteDatum(d.closed_on))
			: tk.state === 'done'
				? box(tk.name, 'ja', 'Aangenomen', korteDatum(dateOf(d, 'Eindtekst')))
				: st.group === 'ingediend'
					? box(tk.name, 'nu', 'Ingediend', korteDatum(st.date))
					: box(tk.name, 'nu', 'In behandeling', capitalize(st.phase ?? ''), korteDatum(st.date));

	let eerste: Box;
	if (d.ek_outcome) {
		const { outcome, date, method } = d.ek_outcome;
		const mark = outcome === 'Verworpen' ? 'nee' : 'ja';
		eerste = box(ek.name, mark, outcome, korteDatum(date), voteMethod(method));
	} else if (ek.state === 'now') {
		// Where the bill is, as eerstekamer.nl heads its list (API 0.76); else its step.
		const senate = 'senate' in d ? d.senate : null;
		const step = senate?.progress?.find((s) => s.state === 'geblokt')?.phase;
		const where = senate?.status ?? step ?? 'Sinds aanneming door de Tweede Kamer';
		eerste = box(ek.name, 'nu', 'In behandeling', where);
	} else if (ek.state === 'none') {
		eerste = box(ek.name, 'open', 'Niet aan de orde', 'Verworpen door de Tweede Kamer');
	} else {
		eerste = box(ek.name, 'open', 'Nog niet', 'Na de Tweede Kamer');
	}
	return [advice, tweede, eerste];
}
