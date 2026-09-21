// TODO(backend B1, B3): no endpoint joins a dossier to its laws, its committees and its
// chambers. This module makes the join from what the API has: the dossier's node (its
// laws through LEGISLATED_IN, its activities with a raw `committee_id`), its mutations
// (the articles its documents change, which name their law), its documents and the list
// of committees. When `GET /api/dossiers/{n}` carries `instruments[]`, `committees[]` and
// documents a `chamber`, `buildDossierHub` reads those and the rest of the file goes.
import { api, unwrap } from '$lib/api/client';
import { instrumentMetaStore } from '$lib/api/instrument-cache';
import type { Schema } from '$lib/api/types';
import {
	dossierNumber,
	getDossierDocuments,
	getDossierMutations
} from '$lib/components/parliamentary/data';
import { lawIdOfArticleKey } from '$lib/util/law-id';
import { get } from 'svelte/store';
import { chamberOf, isExplanatory } from './chamber';
import { describe, type Neighbor, type Row } from './rows';

export type DossierHub = {
	laws: Row[];
	committees: Row[];
	/** Memorie van toelichting and nota van toelichting first, then by date, newest first. */
	tweedeKamer: Row[];
	eersteKamer: Row[];
};

type Committees = Schema<'CommitteeDTO'>[];
type Documents = Schema<'DossierDocumentsResponse'>;
type Mutations = Schema<'DossierMutationsResponse'>;

const CHANGES = new Set(['AMENDS', 'INTRODUCES', 'REPEALS']);

export function buildDossierHub(
	neighbors: Neighbor[],
	documents: Documents | null,
	mutations: Mutations | null,
	committees: Committees,
	lawName: (bwbId: string) => string | null = () => null
): DossierHub {
	const laws = new Map<string, Row>();
	for (const n of neighbors) {
		if (n.relation !== 'LEGISLATED_IN' || n.collection !== 'instruments') continue;
		laws.set(n.key, {
			ref: { collection: 'instruments', key: n.key },
			...describe('instruments', n.key, n.display_name, n.props ?? {}),
			relation: 'LEGISLATED_IN',
			direction: 'inbound'
		});
	}
	// A changed article names its law; the law is the row. Proposed wins only when
	// no enacted change of the same law is known.
	const nodes = new Map((mutations?.nodes ?? []).map((n) => [n.id, n]));
	for (const e of mutations?.edges ?? []) {
		if (!CHANGES.has(e.relation ?? '')) continue;
		const target = e.to_id ? nodes.get(e.to_id) : undefined;
		const bwb = target?.collection === 'articles' ? lawIdOfArticleKey(target.key) : null;
		if (!bwb) continue;
		const key = bwb.toLowerCase();
		const proposed = e.status === 'voorgesteld';
		const known = laws.get(key);
		if (known) {
			if (!proposed) known.proposed = false;
			continue;
		}
		laws.set(key, {
			ref: { collection: 'instruments', key },
			title: lawName(bwb) ?? bwb,
			context: null,
			proposed,
			relation: e.relation as Row['relation'],
			direction: 'outbound'
		});
	}

	// An activity names its committee by GUID with hyphens; a committee key has underscores.
	const led = new Set<string>();
	for (const n of neighbors) {
		const id = n.collection === 'activities' ? n.props?.committee_id : null;
		if (typeof id === 'string' && id) led.add(id.replaceAll('-', '_').toLowerCase());
	}
	const committeeRows = committees
		.filter((c) => led.has(c.key))
		.map<Row>((c) => ({
			ref: { collection: 'committees', key: c.key },
			title: c.name ?? c.abbreviation ?? c.key,
			context: c.abbreviation ?? null,
			relation: 'LED_BY',
			direction: 'outbound'
		}))
		.sort((a, b) => a.title.localeCompare(b.title, 'nl'));

	const rows = (documents?.items ?? []).map((d) => ({
		chamber: chamberOf(d),
		explanatory: isExplanatory(d.kind),
		date: d.date ?? '',
		row: {
			ref: { collection: 'documents', key: d.key },
			...describe('documents', d.key, d.display_name, { ...d }),
			relation: 'PART_OF',
			direction: 'inbound'
		} satisfies Row
	}));
	rows.sort(
		(a, b) => Number(b.explanatory) - Number(a.explanatory) || b.date.localeCompare(a.date)
	);

	return {
		laws: [...laws.values()],
		committees: committeeRows,
		tweedeKamer: rows.filter((r) => r.chamber === 'TK').map((r) => r.row),
		eersteKamer: rows.filter((r) => r.chamber === 'EK').map((r) => r.row)
	};
}

// The list of committees changes rarely: one request per session.
let committeeList: Promise<Committees> | null = null;
export const getCommittees = () =>
	(committeeList ??= unwrap(api.GET('/api/committees')).catch((err) => {
		committeeList = null;
		throw err;
	}));

/** `neighbors` is the dossier's node response, which the caller has already. */
export async function loadDossierHub(key: string, neighbors: Neighbor[]): Promise<DossierHub> {
	const number = dossierNumber(key);
	const [documents, mutations, committees] = await Promise.all([
		getDossierDocuments(number).catch(() => null),
		getDossierMutations(number).catch(() => null),
		getCommittees().catch(() => [])
	]);
	const names = get(instrumentMetaStore);
	return buildDossierHub(neighbors, documents, mutations, committees, (bwb) => {
		const meta = names.get(bwb);
		return meta?.citationTitle ?? meta?.title ?? null;
	});
}
