// The laws, committees and documents per chamber of a dossier. API 0.5 delivers the
// laws and committees on `GET /api/dossiers/{n}` (`instruments[]`, `committees[]`);
// before that they are joined here from the dossier's node (LEGISLATED_IN, the
// activities' raw `committee_id`), its mutations and the list of committees.
// TODO(backend B1, B3): the join goes when every dossier carries the fields.
import { api, unwrap } from '$lib/api/client';
import { instrumentMetaStore } from '$lib/api/instrument-cache';
import type { Schema } from '$lib/api/types';
import {
	dossierNumber,
	getDossier,
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

type Detail = Schema<'DossierDetailResponse'>;

const RELATION_OF: Record<string, Row['relation']> = {
	legislated_in: 'LEGISLATED_IN',
	amends: 'AMENDS',
	introduces: 'INTRODUCES',
	repeals: 'REPEALS'
};

export function buildDossierHub(
	neighbors: Neighbor[],
	documents: Documents | null,
	mutations: Mutations | null,
	committees: Committees,
	lawName: (bwbId: string) => string | null = () => null,
	detail: Partial<Pick<Detail, 'instruments' | 'committees'>> | null = null
): DossierHub {
	const laws = new Map<string, Row>();
	for (const i of detail?.instruments ?? []) {
		laws.set(i.key, {
			ref: { collection: 'instruments', key: i.key },
			title: i.display_name ?? i.bwb_id ?? i.celex ?? i.key,
			context: null,
			proposed: i.status === 'voorgesteld' || undefined,
			relation: RELATION_OF[i.relation] ?? 'LEGISLATED_IN',
			direction: i.relation === 'legislated_in' ? 'inbound' : 'outbound'
		});
	}
	for (const n of detail?.instruments ? [] : neighbors) {
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
	for (const e of detail?.instruments ? [] : (mutations?.edges ?? [])) {
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
	const committeeRows = (
		detail?.committees ? detail.committees : committees.filter((c) => led.has(c.key))
	)
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
		explanatory: isExplanatory(d),
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
	const detail = await getDossier(number).catch(() => null);
	const joined = !detail?.instruments;
	const [documents, mutations, committees] = await Promise.all([
		getDossierDocuments(number).catch(() => null),
		joined ? getDossierMutations(number).catch(() => null) : null,
		joined ? getCommittees().catch(() => []) : []
	]);
	const names = get(instrumentMetaStore);
	return buildDossierHub(
		neighbors,
		documents,
		mutations,
		committees,
		(bwb) => {
			const meta = names.get(bwb);
			return meta?.citationTitle ?? meta?.title ?? null;
		},
		detail
	);
}
