// The overview of a topic: the decisions of the Kamers on moties, amendementen and bills with
// its words in their title, counted by kind, outcome and year, and for one fractie by its vote.
import { buildBronHref } from '$lib/bron/href';
import type { Schema } from '$lib/api/types';
import { NO_DECISION_KIND } from '$lib/components/explore/index/decision-kind';

export type Besluit = Schema<'DecisionSummaryDTO'>;
export type Uitkomst = 'aangenomen' | 'verworpen' | 'overig';
export type Stem = 'voor' | 'tegen';

export const uitkomstVan = (d: Pick<Besluit, 'passed'>): Uitkomst =>
	d.passed === true ? 'aangenomen' : d.passed === false ? 'verworpen' : 'overig';

/** The kind as the Kamer records it (`Motie`, `Amendement`, `Wetgeving`). */
export const soortVan = (d: Pick<Besluit, 'kind'>) => d.kind?.trim() || NO_DECISION_KIND;

export const jaarVan = (d: Pick<Besluit, 'date'>) => (d.date ?? '').slice(0, 4);

export type Filter = { soort?: string; uitkomst?: Uitkomst; jaar?: string; stem?: Stem };

export function filter(
	lijst: readonly Besluit[],
	f: Filter,
	stemmen: ReadonlyMap<string, Stem>
): Besluit[] {
	return lijst.filter(
		(d) =>
			(!f.soort || soortVan(d) === f.soort) &&
			(!f.uitkomst || uitkomstVan(d) === f.uitkomst) &&
			(!f.jaar || jaarVan(d) === f.jaar) &&
			(!f.stem || stemmen.get(d.key) === f.stem)
	);
}

export type Telling = Record<Uitkomst, number> & { totaal: number; voor: number; tegen: number };

const leeg = (): Telling => ({
	totaal: 0,
	aangenomen: 0,
	verworpen: 0,
	overig: 0,
	voor: 0,
	tegen: 0
});

function tel(t: Telling, d: Besluit, stemmen: ReadonlyMap<string, Stem>) {
	t.totaal++;
	t[uitkomstVan(d)]++;
	const s = stemmen.get(d.key);
	if (s) t[s]++;
}

export const totaal = (lijst: readonly Besluit[], stemmen: ReadonlyMap<string, Stem>) => {
	const t = leeg();
	for (const d of lijst) tel(t, d, stemmen);
	return t;
};

function bij(m: Map<string, Telling>, k: string): Telling {
	let t = m.get(k);
	if (!t) m.set(k, (t = leeg()));
	return t;
}

/** Per kind, the most first. */
export function perSoort(lijst: readonly Besluit[], stemmen: ReadonlyMap<string, Stem>) {
	const m = new Map<string, Telling>();
	for (const d of lijst) tel(bij(m, soortVan(d)), d, stemmen);
	return [...m].sort((a, b) => b[1].totaal - a[1].totaal || a[0].localeCompare(b[0]));
}

/** Per year, the newest first, a year without decisions between two others included. */
export function perJaar(lijst: readonly Besluit[], stemmen: ReadonlyMap<string, Stem>) {
	const m = new Map<string, Telling>();
	for (const d of lijst) {
		const j = jaarVan(d);
		if (j) tel(bij(m, j), d, stemmen);
	}
	const jaren = [...m.keys()].map(Number);
	if (!jaren.length) return [];
	const rij: [string, Telling][] = [];
	for (let j = Math.max(...jaren); j >= Math.min(...jaren); j--)
		rij.push([String(j), m.get(String(j)) ?? leeg()]);
	return rij;
}

// ── Counted by the API (0.79.30) ───────────────────────────────────────────
// With repeated q, facets.kind and facets.years and party_votes the API counts what the page
// counted itself: every decision, no cap of the newest 1,000, the word rule applied there.

export type Facets = Schema<'DecisionFacets'>;
export type Getelden = { alles: Telling; soorten: [string, Telling][]; jaren: [string, Telling][] };

/** The API counts per kind and per year, with one fractie's voor and tegen where asked. */
export function uitFacets(f: Facets, fractie: string | null): Getelden {
	const pv = fractie
		? (f.party_votes ?? []).find(
				(p) => p.name === fractie || p.party.toLowerCase() === fractie.toLowerCase()
			)
		: undefined;
	const telling = (
		count: number,
		passed: number,
		rejected: number,
		v?: { voor: number; tegen: number }
	): Telling => ({
		totaal: count,
		aangenomen: passed,
		verworpen: rejected,
		overig: Math.max(0, count - passed - rejected),
		voor: v?.voor ?? 0,
		tegen: v?.tegen ?? 0
	});
	const soorten = (f.kind ?? [])
		.map((k): [string, Telling] => [
			k.value?.trim() || NO_DECISION_KIND,
			telling(
				k.count,
				k.passed ?? 0,
				k.rejected ?? 0,
				pv?.kind?.find((x) => (x.value ?? null) === (k.value ?? null))
			)
		])
		.sort((a, b) => b[1].totaal - a[1].totaal || a[0].localeCompare(b[0]));
	const perJaar = new Map(
		(f.years ?? []).flatMap((y) =>
			y.year
				? [
						[
							y.year,
							telling(
								y.count,
								y.passed,
								y.rejected,
								pv?.years?.find((x) => x.year === y.year)
							)
						] as const
					]
				: []
		)
	);
	const jaren: [string, Telling][] = [];
	const nummers = [...perJaar.keys()].map(Number);
	if (nummers.length)
		for (let j = Math.max(...nummers); j >= Math.min(...nummers); j--)
			jaren.push([String(j), perJaar.get(String(j)) ?? leeg()]);
	const alles = soorten.reduce((t, [, x]) => {
		for (const k of ['totaal', 'aangenomen', 'verworpen', 'overig'] as const) t[k] += x[k];
		return t;
	}, leeg());
	alles.voor = pv?.voor ?? 0;
	alles.tegen = pv?.tegen ?? 0;
	return { alles, soorten, jaren };
}

/** The list behind a number, as /api/decisions takes it; a year narrows the period. */
export function lijstQuery(
	basis: { q: string[]; chamber?: string; from?: string; to?: string },
	f: Filter,
	fractie: string | null
) {
	const binnen = (a: string | undefined, b: string | undefined, max: boolean) =>
		!a ? b : !b ? a : (max ? a > b : a < b) ? a : b;
	return {
		...basis,
		...(f.soort && f.soort !== NO_DECISION_KIND ? { kind: f.soort } : {}),
		...(f.uitkomst === 'aangenomen' ? { passed: true } : {}),
		...(f.uitkomst === 'verworpen' ? { passed: false } : {}),
		...(f.jaar
			? {
					from: binnen(basis.from, `${f.jaar}-01-01`, true),
					to: binnen(basis.to, `${f.jaar}-12-31`, false)
				}
			: {}),
		...(f.stem && fractie ? { party: fractie, vote: f.stem } : {})
	};
}

// ── CSV ─────────────────────────────────────────────────────────────────────
// As the CSV of Verbonden: semicolons and a byte order mark, as Excel with Dutch settings
// reads it.

const SEP = ';';
const BOM = '﻿';
const cell = (v: string | number | null | undefined) => {
	const s = v == null ? '' : String(v);
	return /[";,\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};
const UITKOMST: Record<Uitkomst, string> = {
	aangenomen: 'aangenomen',
	verworpen: 'verworpen',
	overig: ''
};

/** Per decision of a motie: the researcher's strekking, the dictum, indieners and fracties. */
export type MotieVelden = ReadonlyMap<
	string,
	{ strekking?: string; dictum?: string | null; indieners?: string; fracties?: string }
>;

/** The column of the researcher's strekking in the CSV. */
export const KOLOM_STREKKING = 'strekking (eigen codering)';
export const kolomStem = (fractie: string) => `stem ${fractie}`;

export type CsvCel = string | number | null | undefined;
/** The export as rows of cells under a head: what the CSV writes. */
export type CsvTabel = { kop: string[]; rijen: CsvCel[][] };

export function csvTabel(
	lijst: readonly Besluit[],
	origin: string,
	fractie: string | null,
	stemmen: ReadonlyMap<string, Stem>,
	/** A dossier's name by its number, where it was found. */
	namen: ReadonlyMap<string, string> = new Map(),
	/**
	 * Per decision of a motie: the researcher's strekking, and from the motie's text the dictum,
	 * its indieners and their fracties, where those were asked (stance-voorstel, 10 Oct).
	 */
	motie?: MotieVelden
): CsvTabel {
	const kop = [
		'datum',
		'kamer',
		'soort',
		'onderwerp',
		'dossier',
		'dossiernaam',
		'uitkomst',
		'besluit',
		'stemmen voor',
		'stemmen tegen',
		...(fractie ? [kolomStem(fractie)] : []),
		...(motie ? [KOLOM_STREKKING, 'dictum', 'indieners', 'fracties indieners'] : []),
		'link'
	];
	const rijen = lijst.map((d) => [
		d.date,
		d.chamber,
		soortVan(d),
		(d.subject ?? '').trim(),
		(d.dossier_numbers ?? []).join(', '),
		(d.dossier_numbers ?? []).flatMap((n) => namen.get(n) ?? []).join('; '),
		UITKOMST[uitkomstVan(d)],
		d.decision_kind,
		d.tally?.Voor,
		d.tally?.Tegen,
		...(fractie ? [stemmen.get(d.key) ?? ''] : []),
		...(motie
			? [
					motie.get(d.key)?.strekking ?? '',
					motie.get(d.key)?.dictum ?? '',
					motie.get(d.key)?.indieners ?? '',
					motie.get(d.key)?.fracties ?? ''
				]
			: []),
		`${origin}${buildBronHref(null, { collection: 'decisions', key: d.key })}`
	]);
	return { kop, rijen };
}

export const csvTekst = (t: CsvTabel) =>
	BOM + [t.kop.join(SEP), ...t.rijen.map((r) => r.map(cell).join(SEP))].join('\r\n');
