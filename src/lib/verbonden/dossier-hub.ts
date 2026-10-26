// The laws, committees and documents per chamber of a dossier: its laws and committees from
// its detail (`GET /api/dossiers/{n}`: `instruments[]`, `committees[]`, `laws_named[]`), its
// documents from `/documents`, each with its chamber and whether it is a toelichting.
import { naamVan } from '$lib/bron/menselijk';
import { ifExists } from '$lib/api/errors';
import type { Schema } from '$lib/api/types';
import { getDossierDocuments } from '$lib/api/records';
import { getDossier } from '$lib/api/dossiers';
import { filterGroupOf } from './filter';
import { changeRelationOf } from '$lib/vocabulary';
import { type Row } from './rows';
import { describeBron } from '$lib/bron/describe';
import { type Neighbor } from '$lib/api/nodes';
import { kindName } from '$lib/text/law-kind';

export type DossierHub = {
	laws: Row[];
	committees: Row[];
	/** Memorie van toelichting and nota van toelichting first, then by date, newest first. */
	tweedeKamer: Row[];
	eersteKamer: Row[];
	/**
	 * The Tweede Kamer's documents as the API counts them, where it gave fewer (a page of 100):
	 * what lies past the page is counted with the Tweede Kamer, which holds most (N1: 100 said
	 * where there are 146).
	 */
	tkTotal?: number;
};

type Documents = Schema<'DossierDocumentsResponse'>;
type Detail = Pick<Schema<'DossierDetailResponse'>, 'instruments' | 'committees' | 'laws_named'>;

export function buildDossierHub(
	detail: Partial<Detail> | null,
	documents: Documents | null,
	/** The nodes on hand (the dossier's own): a law's kind from its props. */
	bekend: readonly Neighbor[] = []
): DossierHub {
	const laws = new Map<string, Row>();
	// A law by its kind, as everywhere ("Wet"), from the props of the node on hand (API
	// 0.79.54); its BWB id only where none says it.
	const soortVan = (key: string) => {
		const kind = bekend.find((n) => n.collection === 'instruments' && n.key === key)?.props?.kind;
		return kindName(typeof kind === 'string' ? kind : null);
	};
	for (const i of detail?.instruments ?? []) {
		const soort = soortVan(i.key);
		laws.set(i.key, {
			ref: { collection: 'instruments', key: i.key },
			title: naamVan('instruments', i),
			context: soort,
			filterGroup: filterGroupOf('instruments', i.key, { bwb_id: i.bwb_id, celex: i.celex }),
			identifier: soort ? null : (i.bwb_id ?? i.celex ?? null),
			proposed: i.status === 'voorgesteld' || undefined,
			relation: changeRelationOf(i.relation) ?? 'LEGISLATED_IN',
			direction: i.relation === 'legislated_in' ? 'inbound' : 'outbound'
		});
	}

	// The laws the title names that no link above holds: a loaded one as a link, one the
	// dataset lacks by its name alone.
	const named = new Set([...laws.values()].map((r) => r.title.toLowerCase()));
	for (const l of detail?.laws_named ?? []) {
		const key = l.key ?? l.bwb_id?.toLowerCase() ?? null;
		if ((key && laws.has(key)) || named.has(l.name.toLowerCase())) continue;
		laws.set(key ?? `naam:${l.name}`, {
			ref: { collection: 'instruments', key: key ?? l.name },
			title: l.name,
			context: 'in de titel genoemd',
			filterGroup: 'wetten',
			identifier: l.bwb_id ?? null,
			missing: !l.loaded || !key || undefined
		});
	}

	const committees = (detail?.committees ?? [])
		.map<Row>((c) => ({
			ref: { collection: 'committees', key: c.key },
			title: c.name ?? c.abbreviation ?? naamVan('committees', c),
			context: c.abbreviation || null,
			filterGroup: 'dossiers',
			relation: 'LED_BY',
			direction: 'outbound'
		}))
		.sort((a, b) => a.title.localeCompare(b.title, 'nl'));

	const rows = (documents?.items ?? []).map((d) => ({
		// A document of neither chamber (a Staatsblad) stands with the Tweede Kamer's.
		chamber: d.chamber === 'EK' ? 'EK' : 'TK',
		explanatory: d.is_explanatory === true,
		date: d.date ?? '',
		row: {
			ref: { collection: 'documents', key: d.key },
			...describeBron('documents', d.key, d.display_name, { ...d }),
			filterGroup: filterGroupOf('documents', d.key, { ...d }),
			relation: 'PART_OF',
			direction: 'inbound',
			props: { ...d }
		} satisfies Row
	}));
	rows.sort(
		(a, b) => Number(b.explanatory) - Number(a.explanatory) || b.date.localeCompare(a.date)
	);

	const tweedeKamer = rows.filter((r) => r.chamber === 'TK').map((r) => r.row);
	const eersteKamer = rows.filter((r) => r.chamber === 'EK').map((r) => r.row);
	const total = documents?.total ?? 0;
	return {
		laws: [...laws.values()],
		committees,
		tweedeKamer,
		eersteKamer,
		...(total > rows.length ? { tkTotal: total - eersteKamer.length } : {})
	};
}

/** `number` is the dossier's number (`37020-XV`, the node's `label`). */
export async function loadDossierHub(
	number: string,
	bekend: readonly Neighbor[] = []
): Promise<DossierHub> {
	const [detail, documents] = await Promise.all([
		ifExists(getDossier(number)),
		getDossierDocuments(number)
	]);
	return buildDossierHub(detail, documents, bekend);
}
