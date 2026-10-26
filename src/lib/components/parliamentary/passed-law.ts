// Where a passed bill ended: the law it made, as the dossier names it (`instruments`, the
// link `establishes`: a publication of the dossier enacted it; or `legislated_in` of a law
// of the BWB), and the day that law came into force (the instrument's `date_in_force`). A
// treaty approved in the dossier is no law it made. Source values only.
import type { Schema } from '$lib/api/types';
import { naamVan } from '$lib/bron/menselijk';
import { vandaag } from '$lib/text/datum';

type Instrument = Schema<'DossierInstrumentDTO'>;
type Enacted = Schema<'EnactedPublicationDTO'>;

/** A law the dossier made: its key and its name. */
type MadeLaw = { key: string; name: string };

const linked = (i: Instrument, relation: string) =>
	i.relation === relation || (i.links ?? []).some((l) => l.relation === relation);

/** The laws the dossier made, in the dossier's order; none for a bill not passed. */
export function lawsMade(d: { instruments?: Instrument[] | null }): MadeLaw[] {
	return (d.instruments ?? [])
		.filter(
			(i) =>
				i.jurisdiction !== 'eu' &&
				(linked(i, 'establishes') || (linked(i, 'legislated_in') && !!i.bwb_id))
		)
		.map((i) => ({ key: i.key, name: i.display_name?.trim() || naamVan('instruments', i) }));
}

/** `in werking getreden op`, or `treedt in werking op` for a day still to come. */
export const inForceWords = (iso: string, today = vandaag()): string =>
	iso > today ? 'treedt in werking op' : 'in werking getreden op';

/**
 * A publication the dossier's law was enacted in, as the head says it (API 0.80.1, #868): the
 * law it enacted, its citation, the day it was issued and the first day of what it enacted in
 * force. A part the source lacks is left out, not guessed.
 */
type Enactment = {
	/** The law it enacted; null for a publication that only changes other laws. */
	law: { key: string; name: string; href: string | null } | null;
	/** `Stb. 2024, 193`, a link to the publication; null without a citation. */
	cite: { key: string; text: string; href: string | null } | null;
	/** The day it was issued (ISO), for the citation's title. */
	issued: string | null;
	/** The first day in force (ISO); null where the source gives none. */
	inForce: string | null;
	/** The inwerkingtredingsbesluit (`Stb. 2024, 197`), where the BWB names one. */
	commencement: { key: string; text: string; href: string | null } | null;
};

/** The publications of `enacted`, the earliest first, as the API gives them. */
export const enactments = (d: { enacted?: Enacted[] | null }): Enactment[] =>
	(d.enacted ?? []).map((e) => ({
		law: e.instrument
			? {
					key: e.instrument.key,
					name: e.instrument.title?.trim() || naamVan('instruments', e.instrument),
					href: e.instrument.path ?? null
				}
			: null,
		cite: e.cite ? { key: e.key, text: e.cite, href: e.path ?? null } : null,
		issued: e.published_on ?? null,
		inForce: e.first_effective_date ?? null,
		commencement: e.commencement?.cite
			? { key: e.commencement.key, text: e.commencement.cite, href: e.commencement.path ?? null }
			: null
	}));
