import type { Schema } from '$lib/api/types';

// A dossier's kind, phases and outcome as the Tweede Kamer gives them (API 0.52): the kind
// is the `Zaak.Soort` of the zaak that carries it, the phases the eight of the curated list,
// each done only when a paper, an activity or a decision marks it. No names of our own.

type Dossier = Schema<'DossierSummaryDTO'>;

export type Phase = Schema<'DossierPhaseDTO'>;
export type Outcome = NonNullable<Dossier['outcome']>;

/** The kinds of dossier, as the Kamer writes them, in the order the filter lists them. */
export const DOSSIER_KINDS = [
	'Wetgeving',
	'Initiatiefwetgeving',
	'Begroting',
	'Verdrag',
	'Initiatiefnota',
	'PKB/Structuurvisie'
] as const;

/** A dossier of letters and motions has no kind: it is listed as one of the others. */
export const NO_KIND_LABEL = 'Overige dossiers';

/** The phases of a bill, in the order of the curated list. */
export const PHASES = [
	'Voorstel van wet',
	'Memorie van toelichting',
	'Advies Raad van State',
	'Verslag',
	'Nota n.a.v. het verslag',
	'Nota van wijziging / Amendement',
	'Stemmingen',
	'Eindtekst'
] as const;

/** A phase in the width of one step of the bar; the full name is its title. */
export const PHASE_SHORT: Record<string, string> = {
	'Voorstel van wet': 'Voorstel',
	'Memorie van toelichting': 'MvT',
	'Advies Raad van State': 'Advies RvS',
	Verslag: 'Verslag',
	'Nota n.a.v. het verslag': 'Nota',
	'Nota van wijziging / Amendement': 'Wijziging',
	Stemmingen: 'Stemmingen',
	Eindtekst: 'Eindtekst'
};

export const OUTCOME_LABEL: Record<Outcome, string> = {
	aangenomen: 'Aangenomen',
	verworpen: 'Verworpen'
};

export const isOutcome = (value: unknown): value is Outcome =>
	typeof value === 'string' && Object.hasOwn(OUTCOME_LABEL, value);

export const isPhase = (value: unknown): value is (typeof PHASES)[number] =>
	typeof value === 'string' && (PHASES as readonly string[]).includes(value);

/** The track of API 0.51 and before, as a link from then names it in `?track=`. */
const OLD_TRACK: Record<string, string> = {
	wetsvoorstel: 'Wetgeving',
	initiatiefwetsvoorstel: 'Initiatiefwetgeving',
	begroting: 'Begroting',
	verdrag: 'Verdrag',
	initiatiefnota: 'Initiatiefnota',
	structuurvisie: 'PKB/Structuurvisie'
};

/** The stage of API 0.51 and before, as a link from then names it in `?stage=`. */
const OLD_STAGE: Record<string, string> = {
	wetsvoorstel: 'Voorstel van wet',
	mvt: 'Memorie van toelichting',
	advies_rvs: 'Advies Raad van State',
	verslag: 'Verslag',
	nota_naar_aanleiding_van_verslag: 'Nota n.a.v. het verslag',
	amendementen: 'Nota van wijziging / Amendement',
	stemming: 'Stemmingen'
};

/**
 * A kind from the URL: as the Kamer writes it, or by its track before API 0.52. A track the
 * Kamer has no kind for (`beleid`, `nota`, …) is left out, as the list would reject it.
 */
export const kindFromParam = (value: string): string | null =>
	(DOSSIER_KINDS as readonly string[]).includes(value) ? value : (OLD_TRACK[value] ?? null);

/** A phase from the URL: its TK name, or its stage before API 0.52; `behandeling` has none. */
export const phaseFromParam = (value: string): string | null =>
	isPhase(value) ? value : (OLD_STAGE[value] ?? null);

/** Where a dossier stands, as a word: its outcome once decided, else its current phase. */
export const dossierStatus = (d: {
	outcome?: Outcome | null;
	current_phase?: string | null;
}): string | null => (d.outcome ? OUTCOME_LABEL[d.outcome] : (d.current_phase ?? null));

export type StepState = 'done' | 'active' | 'open';

/**
 * How the bar draws a phase: the current one active, another done when a record marks it,
 * the rest open. A phase nothing marks is open, whatever lies after it: no phase is
 * assumed passed.
 */
export const stepState = (phase: Phase, current: string | null | undefined): StepState =>
	phase.name === current ? 'active' : phase.done ? 'done' : 'open';

/** What a dossier's opening date is the date of (API 0.67), as its tooltip says it. */
const OPENED_ON_BASIS: Record<string, string> = {
	first_paper: 'Datum van nr. 1 van het dossier',
	royal_message: 'Datum van de Koninklijke boodschap',
	earliest_record: 'Datum van het eerste stuk of de eerste activiteit'
};

export const openedOnBasis = (basis: string | null | undefined): string | undefined =>
	basis ? OPENED_ON_BASIS[basis] : undefined;
