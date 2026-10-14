import { lowerFirst } from '$lib/text/words';
import { korteDatum } from '$lib/text/datum';
import type { Schema } from '$lib/api/types';

// Where a bill stands, per body that handles it, Raad van
// State, Tweede Kamer, Eerste Kamer, and one sentence that says it with a date. Derived from
// the list item only; no field of our own.

type Dossier = Schema<'DossierSummaryDTO'>;

/** `unknown`: the source gives no mark, which is not the same as not done. */
export type BodyState = 'done' | 'now' | 'open' | 'none' | 'unknown';
export type Body = { name: string; short: string; state: BodyState };
export type StandGroup = 'ek' | 'tk' | 'ingediend' | 'afgehandeld' | 'geen';

export type Stand = {
	bodies: [Body, Body, Body];
	/** One sentence, concrete: who, what, when. */
	zin: string;
	group: StandGroup;
};

const TK_PHASES = [
	'Verslag',
	'Nota n.a.v. het verslag',
	'Nota van wijziging / Amendement',
	'Stemmingen'
];
const SUBMITTED = ['Voorstel van wet', 'Memorie van toelichting', 'Advies Raad van State'];

/** `28 sep. 2026`; see `$lib/text/datum`. */

/** A phase as a sentence names it. */
const PHASE_ZIN: Record<string, string> = {
	Verslag: 'verslag',
	'Nota n.a.v. het verslag': 'nota naar aanleiding van het verslag',
	'Nota van wijziging / Amendement': 'nota van wijziging',
	Stemmingen: 'stemmingen'
};

export function stand(d: Dossier): Stand | null {
	const phases = d.phases ?? [];
	// A phase is done where the source marks it so, and only there: a later phase does not
	// stand in for an earlier one (Thijs, BE-27). A phase without a mark is not in the data.
	const done = (name: string) => !!phases.find((p) => p.name === name)?.done;
	const dateOf = (name: string | null | undefined) =>
		phases.find((p) => p.name === name)?.date ?? null;
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
		{ name: 'Tweede Kamer', short: 'TK', state: tk },
		{ name: 'Eerste Kamer', short: 'EK', state: ek }
	];

	let zin: string;
	let group: StandGroup;
	if (d.ek_outcome) {
		const how = d.ek_outcome.method === 'Hamerstuk' ? ' als hamerstuk' : '';
		zin = `${d.ek_outcome.outcome} door de Eerste Kamer${how}, ${korteDatum(d.ek_outcome.date)}.`;
		group = 'afgehandeld';
	} else if (rejected) {
		zin = `Verworpen door de Tweede Kamer${d.closed_on ? `, ${korteDatum(d.closed_on)}` : ''}.`;
		group = 'afgehandeld';
	} else if (d.closed) {
		zin = `Afgehandeld${d.closed_on ? ` ${korteDatum(d.closed_on)}` : ''}.`;
		group = 'afgehandeld';
	} else if (tkDone) {
		const when = d.tk_decision?.date ?? dateOf('Eindtekst');
		const how = d.tk_decision?.kind?.includes('zonder stemming') ? ' zonder stemming' : '';
		zin = `Door de Tweede Kamer${how} aangenomen${when ? ` op ${korteDatum(when)}` : ''}; bij de Eerste Kamer.`;
		group = 'ek';
	} else if (d.current_phase && TK_PHASES.includes(d.current_phase)) {
		const when = dateOf(d.current_phase);
		zin = `Bij de Tweede Kamer: ${PHASE_ZIN[d.current_phase] ?? lowerFirst(d.current_phase)}${when ? `, ${korteDatum(when)}` : ''}.`;
		group = 'tk';
	} else if (d.current_phase && SUBMITTED.includes(d.current_phase)) {
		const when = dateOf('Voorstel van wet') ?? d.opened_on;
		zin = `Ingediend bij de Tweede Kamer${when ? ` op ${korteDatum(when)}` : ''}${rvs === 'done' ? ', met advies van de Raad van State' : ''}.`;
		group = 'ingediend';
	} else {
		zin = d.current_phase ?? '';
		group = 'geen';
	}
	return { bodies, zin, group };
}
