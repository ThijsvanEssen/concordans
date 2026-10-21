// Where a passed bill ended: the law it made, as the dossier names it (`instruments`, the
// link `establishes`: a publication of the dossier enacted it; or `legislated_in` of a law
// of the BWB), and the day that law came into force (the instrument's `date_in_force`). A
// treaty approved in the dossier is no law it made. Source values only.
import type { Schema } from '$lib/api/types';
import { naamVan } from '$lib/bron/menselijk';
import { vandaag } from '$lib/text/datum';

type Instrument = Schema<'DossierInstrumentDTO'>;

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
