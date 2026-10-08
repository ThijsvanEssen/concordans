// The overview of a topic: the decisions of the Kamers on moties, amendementen and bills with
// its words in their title, counted by kind, outcome and year, and for one fractie by its vote.
// Counted here from the decisions themselves, as the API counts any part of a title (`AI` in
// `universitaire`): every number is the length of a list on the same page.
import { buildBronHref } from '$lib/bron/href';
import type { Schema } from '$lib/api/types';
import { NO_DECISION_KIND } from '$lib/components/explore/index/decision-kind';
import { woordIn } from './onderwerpen';

export type Besluit = Schema<'DecisionSummaryDTO'>;
export type Uitkomst = 'aangenomen' | 'verworpen' | 'overig';
export type Stem = 'voor' | 'tegen';

export const uitkomstVan = (d: Pick<Besluit, 'passed'>): Uitkomst =>
	d.passed === true ? 'aangenomen' : d.passed === false ? 'verworpen' : 'overig';

/** The kind as the Kamer records it (`Motie`, `Amendement`, `Wetgeving`). */
export const soortVan = (d: Pick<Besluit, 'kind'>) => d.kind?.trim() || NO_DECISION_KIND;

export const jaarVan = (d: Pick<Besluit, 'date'>) => (d.date ?? '').slice(0, 4);

/** A decision is on the topic when one of its words stands in the title as a word. */
export const opOnderwerp = (d: Pick<Besluit, 'subject'>, termen: string[]) =>
	termen.some((t) => woordIn(t, d.subject));

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

export function naarCsv(
	lijst: readonly Besluit[],
	origin: string,
	fractie: string | null,
	stemmen: ReadonlyMap<string, Stem>,
	/** A dossier's name by its number, where it was found. */
	namen: ReadonlyMap<string, string> = new Map()
): string {
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
		...(fractie ? [`stem ${fractie}`] : []),
		'link'
	];
	const regels = lijst.map((d) =>
		[
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
			`${origin}${buildBronHref(null, { collection: 'decisions', key: d.key })}`
		]
			.map(cell)
			.join(SEP)
	);
	return BOM + [kop.join(SEP), ...regels].join('\r\n');
}
