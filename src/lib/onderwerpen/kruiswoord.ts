// The Kruiswoord of a topic's Overzicht (concept ux-voorstel/1f): the kinds of event as
// columns, time as rows, a count in every cell. The stemmingen per day come counted from
// /api/decisions (facets.days: count and passed); moties, brieven and toezeggingen are the
// feed's events, counted here from the items as they come. A cell is new where it holds a
// day after the visit before this one (Onderwerpen volgen).

export type Kolom =
	| 'moties'
	| 'amendementen'
	| 'aangenomen'
	| 'verworpen'
	| 'brieven'
	| 'toezeggingen';
export const KOLOMMEN: readonly Kolom[] = [
	'moties',
	'amendementen',
	'aangenomen',
	'verworpen',
	'brieven',
	'toezeggingen'
];
/**
 * The columns of the feed's events, and the kind /api/feed gives them. The amendments'
 * papers come from the feed too, but an amendment counts once per chain of replacing
 * papers (amendementKetens), not per paper.
 */
export const FEED_KOLOM: Partial<Record<Kolom, string>> = {
	moties: 'Motie',
	amendementen: 'Amendement',
	brieven: 'Brief regering',
	toezeggingen: 'toezegging'
};
export const kolomVanKind = (kind: string): Kolom | null =>
	(Object.entries(FEED_KOLOM).find(([, k]) => k === kind)?.[0] as Kolom | undefined) ?? null;

export type Indeling = 'maand' | 'week';

/** `2026-10` for a month; `2026-W41` for an ISO week. */
export type Vak = string;

export function maandVan(dag: string): Vak {
	return dag.slice(0, 7);
}

/** The ISO week of a day: its Thursday's year and the week's number. */
export function weekVan(dag: string): Vak {
	const d = new Date(`${dag.slice(0, 10)}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
	const jaar = d.getUTCFullYear();
	const nr = Math.ceil(((d.getTime() - Date.UTC(jaar, 0, 1)) / 86400000 + 1) / 7);
	return `${jaar}-W${String(nr).padStart(2, '0')}`;
}

export const vakVan = (dag: string, indeling: Indeling) =>
	indeling === 'week' ? weekVan(dag) : maandVan(dag);

export const jaarVanVak = (vak: Vak) => vak.slice(0, 4);

/** The Monday of an ISO week. */
function maandagVan(vak: Vak): Date {
	const [jaar, w] = vak.split('-W').map(Number);
	const vier = new Date(Date.UTC(jaar, 0, 4));
	const maandag = new Date(vier);
	maandag.setUTCDate(vier.getUTCDate() - ((vier.getUTCDay() + 6) % 7) + (w - 1) * 7);
	return maandag;
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** The first and last day of a month or week, as the API takes them. */
export function grenzenVan(vak: Vak): { van: string; tot: string } {
	if (vak.includes('-W')) {
		const m = maandagVan(vak);
		const z = new Date(m);
		z.setUTCDate(m.getUTCDate() + 6);
		return { van: iso(m), tot: iso(z) };
	}
	const [j, mnd] = vak.split('-').map(Number);
	return { van: `${vak}-01`, tot: iso(new Date(Date.UTC(j, mnd, 0))) };
}

/** Every month or week from `tot` back to `van`, the newest first. */
export function vakken(van: string, tot: string, indeling: Indeling): Vak[] {
	if (!van || !tot || van > tot) return [];
	const uit: Vak[] = [];
	if (indeling === 'week') {
		const d = maandagVan(weekVan(tot));
		const eind = maandagVan(weekVan(van));
		for (; d >= eind && uit.length < 1000; d.setUTCDate(d.getUTCDate() - 7))
			uit.push(weekVan(iso(d)));
		return uit;
	}
	let [j, m] = tot.split('-').map(Number);
	const [ej, em] = van.split('-').map(Number);
	while ((j > ej || (j === ej && m >= em)) && uit.length < 1000) {
		uit.push(`${j}-${String(m).padStart(2, '0')}`);
		if (--m === 0) {
			m = 12;
			j--;
		}
	}
	return uit;
}

export type Cel = { n: number; nieuw: boolean };
export type Rij = Record<Kolom, Cel>;
const leegRij = (): Rij =>
	Object.fromEntries(KOLOMMEN.map((k) => [k, { n: 0, nieuw: false }])) as Rij;

export type Dag = { date: string; count: number; passed?: number | null };
/**
 * Something counted in a column on a day: a feed item or an amendment (count 1), a day of a
 * fractie's votes, or, once /api/feed counts per month, a month's count of a kind (its
 * first day). Each fills the same cells.
 */
export type Telbaar = { date: string; kolom: Kolom; count?: number };

/** The counts per month or week: the stemmingen from the decisions' days, the rest as given. */
export function tel(
	dagen: readonly Dag[],
	telbaar: readonly Telbaar[],
	indeling: Indeling,
	vorige: string | null
): Map<Vak, Rij> {
	const m = new Map<Vak, Rij>();
	const rij = (vak: Vak) => m.get(vak) ?? (m.set(vak, leegRij()), m.get(vak)!);
	const nieuw = (dag: string) => !!vorige && dag > vorige;
	const zet = (dag: string, k: Kolom, n: number) => {
		if (!n || !dag) return;
		const c = rij(vakVan(dag, indeling))[k];
		c.n += n;
		c.nieuw ||= nieuw(dag);
	};
	for (const d of dagen) {
		zet(d.date, 'aangenomen', d.passed ?? 0);
		zet(d.date, 'verworpen', d.count - (d.passed ?? 0));
	}
	for (const t of telbaar) zet(t.date, t.kolom, t.count ?? 1);
	return m;
}

/** An amendment as counted: its chain of papers, the first paper's day, its outcome. */
export type Amendement = {
	/** The last paper's node id: the amendment as voted or as it stands. */
	id: string;
	titel: string;
	nummer: string;
	/** The day of the first paper of its chain. */
	datum: string;
	dossier: string | null;
	uitkomst: string | null;
	papieren: string[];
};

/** The chains of the dossiers' timetables that hold a paper of the topic, each once. */
export function amendementKetens(
	rijen: readonly {
		stuk: { id: string; nummer: string; titel: string };
		haltes: { id: string; datum: string }[];
		uitslag: { aangenomen: boolean | null; soort: string | null } | null;
		nogNiet: boolean;
	}[],
	vanOnderwerp: ReadonlySet<string>,
	dossier: string | null = null
): Amendement[] {
	const uit = new Map<string, Amendement>();
	for (const r of rijen) {
		if (!r.haltes.some((h) => vanOnderwerp.has(h.id)) && !vanOnderwerp.has(r.stuk.id)) continue;
		const u = r.uitslag;
		uit.set(r.stuk.id, {
			id: r.stuk.id,
			titel: r.stuk.titel,
			nummer: r.stuk.nummer,
			datum: r.haltes[0]?.datum ?? '',
			dossier,
			uitkomst:
				u?.aangenomen === true
					? 'aangenomen'
					: u?.aangenomen === false
						? 'verworpen'
						: (u?.soort ?? (r.nogNiet ? 'nog niet gestemd' : null)),
			papieren: r.haltes.map((h) => h.id)
		});
	}
	return [...uit.values()];
}

export const somVan = (r: Rij | undefined) => (r ? KOLOMMEN.reduce((s, k) => s + r[k].n, 0) : 0);

/** The totals of a set of rows, per column. */
export function totalen(rijen: Iterable<Rij>): Record<Kolom, number> {
	const t = Object.fromEntries(KOLOMMEN.map((k) => [k, 0])) as Record<Kolom, number>;
	for (const r of rijen) for (const k of KOLOMMEN) t[k] += r[k].n;
	return t;
}

/** A cell chosen, as the URL holds it: `moties:2026-10`. */
export type Keuze = { kolom: Kolom; vak: Vak };
export function leesKeuze(v: string | null): Keuze | null {
	const m = v?.match(
		/^(moties|amendementen|aangenomen|verworpen|brieven|toezeggingen):(\d{4}-(?:\d{2}|W\d{2}))$/
	);
	return m ? { kolom: m[1] as Kolom, vak: m[2] } : null;
}
export const schrijfKeuze = (k: Keuze) => `${k.kolom}:${k.vak}`;

/** The share of each direction among a cell's coded and uncoded moties, for its bar. */
export type Aandeel = { positief: number; negatief: number; neutraal: number; geen: number };
