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

export type DossierKind = (typeof DOSSIER_KINDS)[number];

/**
 * The kinds of dossier that are a bill and run its procedure: a begroting is a bill too (a
 * begrotingswet, voted on as one).
 */
export const BILL_KINDS: ReadonlySet<string> = new Set<DossierKind>([
	'Wetgeving',
	'Initiatiefwetgeving',
	'Begroting'
]);

/** A bill of members, whose advice of the Raad van State can still come after submission. */
export const INITIATIVE_BILL: DossierKind = 'Initiatiefwetgeving';

/** The bills that change the articles of a law: a begroting changes none. */
export const AMENDING_BILL_KINDS: ReadonlySet<string> = new Set<DossierKind>([
	'Wetgeving',
	INITIATIVE_BILL
]);

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

export type PhaseName = (typeof PHASES)[number];

/** The steps of the Tweede Kamer after submission, as a sentence names them. */
const TK_STEPS = [
	'verslag',
	'nota naar aanleiding van het verslag',
	'nota van wijziging',
	'plenaire behandeling',
	'stemming'
] as const;
type TkStep = (typeof TK_STEPS)[number];

/**
 * Where a phase puts the bill: submitted (with its papers and the advice), at a step of the
 * Tweede Kamer, with the phase as a sentence names it, or passed by it (its final text).
 */
type PhasePlace =
	| { stage: 'submitted' }
	| { stage: 'tk'; phrase: string; step: TkStep }
	| { stage: 'passed' };

export const PHASE_PLACE: Record<PhaseName, PhasePlace> = {
	'Voorstel van wet': { stage: 'submitted' },
	'Memorie van toelichting': { stage: 'submitted' },
	'Advies Raad van State': { stage: 'submitted' },
	Verslag: { stage: 'tk', phrase: 'verslag', step: 'verslag' },
	'Nota n.a.v. het verslag': {
		stage: 'tk',
		phrase: 'nota naar aanleiding van het verslag',
		step: 'nota naar aanleiding van het verslag'
	},
	'Nota van wijziging / Amendement': {
		stage: 'tk',
		phrase: 'nota van wijziging',
		step: 'nota van wijziging'
	},
	Stemmingen: { stage: 'tk', phrase: 'stemmingen', step: 'stemming' },
	Eindtekst: { stage: 'passed' }
};

/** A step that comes again after it came: another nota, the vote on the bill itself. */
const AGAIN: Partial<Record<TkStep, string>> = {
	'nota van wijziging': 'nog een nota van wijziging',
	stemming: 'stemming'
};

/** The place of the current phase, or null for a phase that is not one of the eight. */
export const phasePlace = (phase: string | null | undefined): PhasePlace | null =>
	isPhase(phase) ? PHASE_PLACE[phase] : null;

/** The steps of the Tweede Kamer that can still follow the current phase, in their order. */
export function stepsToCome(phase: string | null | undefined): string[] {
	const place = phasePlace(phase);
	if (place?.stage !== 'tk') return [...TK_STEPS];
	const i = TK_STEPS.indexOf(place.step);
	const again = AGAIN[place.step];
	return [...(again ? [again] : []), ...TK_STEPS.slice(i + 1)];
}

/**
 * How a decision was taken, from the method of the Eerste Kamer's report or the kind of
 * the Tweede Kamer's decision (`Stemmen - zonder stemming aannemen`); null for a vote.
 */
export type VoteMethod = 'hamerstuk' | 'zitten en opstaan' | 'zonder stemming';

export function voteMethod(
	method: string | null | undefined,
	kind?: string | null
): VoteMethod | null {
	if (method === 'Hamerstuk') return 'hamerstuk';
	if (method?.startsWith('Stemming bij zitten')) return 'zitten en opstaan';
	if (kind?.includes('zonder stemming')) return 'zonder stemming';
	return null;
}

/** A way of deciding after the outcome in a sentence: `Aangenomen als hamerstuk`. */
const VOTE_METHOD_PHRASE: Record<VoteMethod, string> = {
	hamerstuk: 'als hamerstuk',
	'zitten en opstaan': 'bij zitten en opstaan',
	'zonder stemming': 'zonder stemming'
};

/** How a decision was taken, as a sentence says it after the outcome; null for a vote. */
export function methodPhrase(method: string | null | undefined, kind?: string | null) {
	const how = voteMethod(method, kind);
	return how ? VOTE_METHOD_PHRASE[how] : null;
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
	aangenomen: 'Aangenomen',
	verworpen: 'Verworpen'
};

export const isOutcome = (value: unknown): value is Outcome =>
	typeof value === 'string' && Object.hasOwn(OUTCOME_LABEL, value);

export const isPhase = (value: unknown): value is PhaseName =>
	typeof value === 'string' && (PHASES as readonly string[]).includes(value);

/** A dossier kind as the Kamer writes it (`Wetgeving`); anything else is no kind. */
export const isDossierKind = (value: string): value is DossierKind =>
	(DOSSIER_KINDS as readonly string[]).includes(value);

/** Where a dossier stands, as a word: its outcome once decided, else its current phase. */
export const dossierStatus = (d: {
	outcome?: Outcome | null;
	current_phase?: string | null;
}): string | null => (d.outcome ? OUTCOME_LABEL[d.outcome] : (d.current_phase ?? null));
