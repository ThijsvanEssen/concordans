// The laws, committees and documents per chamber of a dossier. API 0.5 delivers the
// laws and committees on `GET /api/dossiers/{n}` (`instruments[]`, `committees[]`);
// before that they are joined here from the dossier's node (LEGISLATED_IN, the
// activities' raw `committee_id`), its mutations and the list of committees.
// TODO(backend B1, B3): the join goes when every dossier carries the fields.
import { naamVan } from '$lib/bron/menselijk';
import { api, unwrap } from '$lib/api/client';
import { instrumentMetaStore } from '$lib/api/instrument-cache';
import type { Schema } from '$lib/api/types';
import {
	getDossier,
	getDossierDocuments,
	getDossierMutations
} from '$lib/components/parliamentary/data';
import { get } from 'svelte/store';
import { chamberOf, isExplanatory } from './chamber';
import { bronKindOf } from './filter';
import { describe, type Neighbor, type Row } from './rows';
import { kindName } from '$lib/components/explore/law-head';
import { onForget } from '$lib/util/forget';

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

const CHANGES = new Set(['ESTABLISHES', 'AMENDS', 'INTRODUCES', 'REPEALS']);

// A mutation node carries no props: the law is read from the article key
// (`bwbr0001854_287`, `32004l0017_6`).
const lawOfArticleKey = (key: string): string | null =>
	/^(bwb[rvw]\d{7}|[0-9ce]\d{4}[a-z]{1,2}\d{4})_/i.exec(key)?.[1].toUpperCase() ?? null;

type Detail = Schema<'DossierDetailResponse'>;

const RELATION_OF: Record<string, Row['relation']> = {
	legislated_in: 'LEGISLATED_IN',
	establishes: 'ESTABLISHES',
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
	detail: Partial<Pick<Detail, 'instruments' | 'committees' | 'laws_named'>> | null = null,
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
			kind: bronKindOf('instruments', i.key, { bwb_id: i.bwb_id, celex: i.celex }),
			identifier: soort ? null : (i.bwb_id ?? i.celex ?? null),
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
			kind: bronKindOf('instruments', n.key, n.props),
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
		const bwb = target?.collection === 'articles' ? lawOfArticleKey(target.key) : null;
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
			kind: bronKindOf('instruments', key, { bwb_id: bwb }),
			identifier: bwb,
			proposed,
			relation: e.relation as Row['relation'],
			direction: 'outbound'
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
			kind: 'wetten',
			identifier: l.bwb_id ?? null,
			missing: !l.loaded || !key || undefined
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
			title: c.name ?? c.abbreviation ?? naamVan('committees', c),
			context: c.abbreviation || null,
			kind: 'dossiers',
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
			kind: bronKindOf('documents', d.key, { ...d }),
			relation: 'PART_OF',
			direction: 'inbound',
			props: { ...d }
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
onForget(() => (committeeList = null));

/**
 * `number` is the dossier's number (`37020-XV`, the node's `label`); `buren` gives the
 * dossier's laws and activities, asked only where the dossier's detail lacks them.
 */
export async function loadDossierHub(
	number: string,
	buren: () => Promise<Neighbor[]>,
	bekend: readonly Neighbor[] = []
): Promise<DossierHub> {
	const detail = await getDossier(number).catch(() => null);
	const joined = !detail?.instruments;
	const [documents, mutations, committees, neighbors] = await Promise.all([
		getDossierDocuments(number).catch(() => null),
		joined ? getDossierMutations(number).catch(() => null) : null,
		joined ? getCommittees().catch(() => []) : [],
		joined || !detail?.committees ? buren().catch(() => []) : []
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
		detail,
		bekend
	);
}
