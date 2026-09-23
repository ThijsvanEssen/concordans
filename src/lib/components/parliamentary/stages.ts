import type { Schema } from '$lib/api/types';

type Dossier = Schema<'DossierSummaryDTO'>;

export type Stage = NonNullable<Dossier['current_stage']>;
export type Track = NonNullable<Dossier['track']>;

/**
 * The stages of a bill in the order they are passed. Stages are shown in shades of ink
 * (current, passed, future); `tone` no longer colours anything and stays for the shape
 * of the export.
 */
export const STAGES: { id: Stage; label: string; tone: 'slate' | 'ochre' | 'olive' }[] = [
	{ id: 'wetsvoorstel', label: 'Wetsvoorstel', tone: 'slate' },
	{ id: 'mvt', label: 'MvT', tone: 'slate' },
	{ id: 'advies_rvs', label: 'Advies RvS', tone: 'slate' },
	{ id: 'nota', label: "Nota's", tone: 'ochre' },
	{ id: 'verslag', label: 'Verslag', tone: 'ochre' },
	{ id: 'amendementen', label: 'Amendementen', tone: 'ochre' },
	{ id: 'stemming', label: 'Stemming', tone: 'ochre' },
	{ id: 'afgehandeld', label: 'Afgehandeld', tone: 'olive' }
];

export const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.id, s.label])) as Record<
	Stage,
	string
>;

export const TRACK_LABEL: Record<Track, string> = {
	wetsvoorstel: 'Wetsvoorstel',
	initiatiefwetsvoorstel: 'Initiatiefwet',
	begroting: 'Begroting',
	motie: 'Motie',
	overig: 'Overig'
};

export const isStage = (value: string | null | undefined): value is Stage =>
	STAGES.some((s) => s.id === value);
