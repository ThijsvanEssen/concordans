// The amendments of a bill as a timetable (ux-voorstel, recommendation 3; Thijs, 10 Oct):
// a row per amendment as it came to the vote, a stop on the day of each paper it grew from
// ("ter vervanging van", REVISES between papers, #378), and at the end its outcome. Read
// from one neighbourhood of the dossier: its papers and cases (PART_OF), the decisions on
// those cases (ABOUT), and the papers that revise others (REVISES). Every value is a source
// value: the vote of an amendment is the decision whose `primary_case_id` is the case of
// its paper, the chain is the REVISES edges; nothing is read from a title.
import { getNodeNeighborhood } from '$lib/api/nodes';
import { once } from '$lib/api/records';

type Props = Record<string, unknown>;
export type GraphNode = { id: string; key: string; props?: Props | null };
export type GraphEdge = { source: string; target: string; relation: string };
export type Graph = { nodes: GraphNode[]; edges: GraphEdge[] };

/** A paper of an amendment: a stop in the timetable. */
export type Stuk = { id: string; nummer: string; datum: string; titel: string };

export type Uitslag = {
	id: string;
	aangenomen: boolean | null;
	voor: number | null;
	tegen: number | null;
};

/** One amendment as it came to the vote, with the papers it grew from. */
export type Rij = {
	/** The last paper: the amendment as voted, or as it stood when nothing replaced it. */
	stuk: Stuk;
	/** Every paper of the chain, oldest first, the last one included. */
	haltes: Stuk[];
	/** The first signer and the number of the others, from the paper's own actors. */
	indiener: { naam: string; fractie: string | null; anderen: number } | null;
	/** Several papers merged into this one (more than one chain leads here). */
	samengevoegd: boolean;
	uitslag: Uitslag | null;
};

export type Dienstregeling = {
	rijen: Rij[];
	/** The days (or weeks) of the columns, oldest first. */
	kolommen: string[];
	/** Whether the API gave any REVISES between the papers: without, each paper stands alone. */
	metVervanging: boolean;
	/** The neighbourhood reached its cap: some papers may be missing. */
	afgekapt: boolean;
};

/** Nodes asked at most: a budget with hundreds of amendments still fits. */
export const CAP = 1000;

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const num = (v: unknown) => (typeof v === 'number' ? v : null);
const lijst = (v: unknown) => (Array.isArray(v) ? (v as unknown[]) : []);

const isAmendement = (n: GraphNode) =>
	n.id.startsWith('documents/') && lijst(n.props?.case_kinds).includes('Amendement');

function stukVan(n: GraphNode): Stuk {
	const p = n.props ?? {};
	return {
		id: n.id,
		nummer: str(p.sequence ?? p.number),
		datum: str(p.date),
		titel: str(p.title ?? p.subject)
	};
}

function indienerVan(n: GraphNode): Rij['indiener'] {
	const actors = lijst(n.props?.actors) as Props[];
	if (!actors.length) return null;
	const eerste = actors.find((a) => str(a.role) === 'Eerste ondertekenaar') ?? actors[0];
	return {
		naam: str(eerste.name),
		fractie: str(eerste.faction) || null,
		anderen: actors.length - 1
	};
}

const vroeger = (a: Stuk, b: Stuk) =>
	a.datum.localeCompare(b.datum) || Number(a.nummer) - Number(b.nummer);

/** Above this many days the columns are weeks, so a long dossier stays one screen wide. */
export const MAX_DAGEN = 14;

/** The Monday of the week of a day, as YYYY-MM-DD. */
export function maandagVan(dag: string): string {
	const d = new Date(`${dag}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
	return d.toISOString().slice(0, 10);
}

export function dienstregeling(g: Graph, cap = CAP): Dienstregeling {
	const nodes = new Map(g.nodes.map((n) => [n.id, n]));
	const stukken = g.nodes.filter(isAmendement);
	const ids = new Set(stukken.map((n) => n.id));

	// REVISES: the newer paper revises the one it replaces.
	const vorige = new Map<string, string[]>();
	const volgende = new Map<string, string[]>();
	for (const e of g.edges) {
		if (e.relation !== 'REVISES' || !ids.has(e.source) || !ids.has(e.target)) continue;
		vorige.set(e.source, [...(vorige.get(e.source) ?? []), e.target]);
		volgende.set(e.target, [...(volgende.get(e.target) ?? []), e.source]);
	}

	// The decision on a case, by the case it singles out (`primary_case_id`).
	const besluit = new Map<string, GraphNode>();
	for (const n of g.nodes)
		if (n.id.startsWith('decisions/')) {
			const c = str(n.props?.primary_case_id);
			if (c) besluit.set(c, n);
		}
	const uitslagVan = (n: GraphNode): Uitslag | null => {
		for (const c of lijst(n.props?.case_ids)) {
			const b = besluit.get(str(c));
			if (!b) continue;
			const tally = (b.props?.tally ?? {}) as Props;
			const passed = b.props?.passed;
			return {
				id: b.id,
				aangenomen: typeof passed === 'boolean' ? passed : null,
				voor: num(tally.Voor),
				tegen: num(tally.Tegen)
			};
		}
		return null;
	};

	const rijen: Rij[] = stukken
		.filter((n) => !volgende.has(n.id))
		.map((n) => {
			const gezien = new Set<string>();
			const rij = [n.id];
			while (rij.length) {
				const id = rij.pop()!;
				if (gezien.has(id)) continue;
				gezien.add(id);
				rij.push(...(vorige.get(id) ?? []));
			}
			const haltes = [...gezien].map((id) => stukVan(nodes.get(id)!)).sort(vroeger);
			const begin = haltes.filter((h) => !vorige.has(h.id)).length;
			return {
				stuk: stukVan(n),
				haltes,
				indiener: indienerVan(n),
				samengevoegd: begin > 1,
				uitslag: uitslagVan(n)
			};
		})
		.sort((a, b) => vroeger(a.haltes[0], b.haltes[0]));

	const dagen = [...new Set(rijen.flatMap((r) => r.haltes.map((h) => h.datum)))]
		.filter(Boolean)
		.sort();
	const kolommen = dagen.length > MAX_DAGEN ? [...new Set(dagen.map(maandagVan))].sort() : dagen;

	return { rijen, kolommen, metVervanging: vorige.size > 0, afgekapt: g.nodes.length >= cap };
}

/** The column of a day: the day itself, or its week where the columns are weeks. */
export const kolomVan = (d: Dienstregeling, dag: string) =>
	d.kolommen.includes(dag) ? dag : maandagVan(dag);

/** The neighbourhood of a dossier (by its node key) with its papers, cases, decisions and
 * REVISES, once. */
export const getAmendementen = (key: string) =>
	once(`dossiers/${key}/amendementen`, async () =>
		dienstregeling(
			(await getNodeNeighborhood('dossiers', key, {
				depth: 2,
				cap: CAP,
				relations: ['PART_OF', 'ABOUT', 'REVISES'],
				nodeTypes: ['document', 'case', 'decision', 'dossier']
			})) as unknown as Graph
		)
	);

/** How many amendments a dossier has by its own counts per kind, without a request. */
export const aantalAmendementen = (perSoort: Record<string, number> | null | undefined) =>
	Object.entries(perSoort ?? {})
		.filter(([k]) => /^amendement/i.test(k))
		.reduce((n, [, v]) => n + v, 0);
