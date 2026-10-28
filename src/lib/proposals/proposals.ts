// The lopende voorstellen of a bron (besluit 37, Openstaand): the dossiers whose documents
// propose an open change of it (API 0.80.18, /api/nodes/in-flux/dossiers). The card names them;
// the vinkje Voorstellen draws their voorstel (the bill of the dossier) beside the bron, with a
// light Wijziging-lijn. Everything shown is what the API says: a dossier without a bill is named
// and not drawn.
import type { InFluxDossier } from '$lib/api/overlays';
import type { CanvasRow } from '$lib/graph/store/types';
import { naamVanId } from '$lib/bron/menselijk';
import { dossierLabel, dossierOwnName } from '$lib/bron/dossier-naam';
import { parseNodeId } from '$lib/vocabulary';

/** The voorstel of a dossier as a node id (`documents/…`), or null where the dossier holds none. */
export const billIdOf = (d: InFluxDossier): string | null =>
	d.bill_id && parseNodeId(d.bill_id)?.collection === 'documents' ? d.bill_id : null;

/** What a dossier is called as the rest of the site calls it: `Dossier 36000 …`, the title cut. */
export const openDossierName = (d: InFluxDossier): string =>
	d.dossier_number
		? dossierLabel({ number: d.dossier_number, title: d.title })
		: (dossierOwnName({ number: '', title: d.title }) ?? naamVanId(d.id));

/**
 * The voorstellen of a bron as rows beside it: an inbound change, proposed, so the line is the
 * light one of its family. The API gives the open change, not its sort (wijzigt, voegt toe,
 * schrapt): the line says wijziging.
 */
export function proposalRows(dossiers: readonly InFluxDossier[]): CanvasRow[] {
	return dossiers.flatMap((d): CanvasRow[] => {
		const id = billIdOf(d);
		const ref = id && parseNodeId(id);
		if (!ref || ref.collection !== 'documents') return [];
		return [
			{
				ref: { collection: ref.collection, key: ref.key },
				title: openDossierName(d),
				relation: 'AMENDS',
				direction: 'inbound',
				proposed: true,
				props: {
					kind: 'Voorstel van wet',
					title: d.title,
					dossier_number: d.dossier_number
				}
			}
		];
	});
}
