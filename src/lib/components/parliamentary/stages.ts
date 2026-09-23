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

export const TRACK_LABEL: Record<Track, string> = {
	wetsvoorstel: 'Wetsvoorstel',
	initiatiefwetsvoorstel: 'Initiatiefwet',
	begroting: 'Begroting',
	verdrag: 'Verdrag',
	initiatiefnota: 'Initiatiefnota',
	motie: 'Motie',
	overig: 'Overig'
};

/** Only a bill passes stages; any other dossier has none until `afgehandeld`. */
const BILL_TRACKS: Record<Track, boolean> = {
	wetsvoorstel: true,
	initiatiefwetsvoorstel: true,
	begroting: true,
	verdrag: true,
	initiatiefnota: false,
	motie: false,
	overig: false
};

export const isBill = (track: Track | null | undefined): boolean =>
	track ? BILL_TRACKS[track] : false;

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
