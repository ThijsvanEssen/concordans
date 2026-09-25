import type { Schema } from '$lib/api/types';

type Dossier = Schema<'DossierSummaryDTO'>;

export type Stage = NonNullable<Dossier['current_stage']>;
export type Track = NonNullable<Dossier['track']>;
export type Outcome = NonNullable<Dossier['outcome']>;

/** The stages of a bill, in the order they are passed. */
export const STAGE_LABEL: Record<Stage, string> = {
	wetsvoorstel: 'Wetsvoorstel',
	mvt: 'MvT',
	advies_rvs: 'Advies RvS',
	verslag: 'Verslag',
	nota_naar_aanleiding_van_verslag: 'Nota n.a.v. verslag',
	amendementen: 'Amendementen',
	behandeling: 'Behandeling',
	stemming: 'Stemming',
	afgehandeld: 'Afgehandeld'
};

export const STAGES = Object.keys(STAGE_LABEL) as Stage[];

/**
 * Every track the API gives now or gave before: `overig` is split into the kinds below
 * it (API after 0.14, branch track-kinds), and a link or cache can still carry it.
 */
type KnownTrack =
	| Track
	| 'overig'
	| 'structuurvisie'
	| 'verantwoording'
	| 'eu'
	| 'interparlementair'
	| 'kamer'
	| 'beleid';

export const TRACK_LABEL: Record<KnownTrack, string> = {
	wetsvoorstel: 'Wetsvoorstel',
	initiatiefwetsvoorstel: 'Initiatiefwet',
	begroting: 'Begroting',
	verdrag: 'Verdrag',
	initiatiefnota: 'Initiatiefnota',
	nota: 'Nota',
	structuurvisie: 'Structuurvisie',
	verantwoording: 'Verantwoording',
	eu: 'EU',
	interparlementair: 'Interparlementair',
	kamer: 'Kamer',
	beleid: 'Beleid',
	overig: 'Overig'
};

/** Only a bill passes stages; any other dossier has none until `afgehandeld`. */
const BILLS: ReadonlySet<KnownTrack> = new Set([
	'wetsvoorstel',
	'initiatiefwetsvoorstel',
	'begroting',
	'verdrag'
]);

export const isBill = (track: Track | null | undefined): boolean =>
	track ? BILLS.has(track) : false;

export const OUTCOME_LABEL: Record<Outcome, string> = {
	aangenomen: 'Aangenomen',
	verworpen: 'Verworpen',
	ingetrokken: 'Ingetrokken'
};

export const isStage = (value: unknown): value is Stage =>
	typeof value === 'string' && Object.hasOwn(STAGE_LABEL, value);

export const isOutcome = (value: unknown): value is Outcome =>
	typeof value === 'string' && Object.hasOwn(OUTCOME_LABEL, value);

/** Where a dossier stands, as a word: its outcome once closed, else its current stage. */
export const dossierStatus = (d: {
	outcome?: Outcome | null;
	current_stage?: Stage | null;
}): string | null =>
	d.outcome ? OUTCOME_LABEL[d.outcome] : d.current_stage ? STAGE_LABEL[d.current_stage] : null;

export type StepState = 'done' | 'active' | 'unknown' | 'open';

/**
 * How the stepper draws a stage. A stage the dossier did not record but that lies
 * before one it did is `unknown` only when the API says the record is incomplete
 * (`stages_complete: false`): amendments can come before a verslag, so a gap alone
 * does not mean a stage was passed.
 */
export function stepState(
	step: Stage,
	stages: readonly Stage[],
	current: Stage | null,
	complete: boolean | null | undefined
): StepState {
	if (step === current) return 'active';
	if (stages.includes(step)) return 'done';
	if (complete !== false) return 'open';
	const reached = [...stages, ...(current ? [current] : [])].map((s) => STAGES.indexOf(s));
	const furthest = reached.length > 0 ? Math.max(...reached) : -1;
	return STAGES.indexOf(step) < furthest ? 'unknown' : 'open';
}
