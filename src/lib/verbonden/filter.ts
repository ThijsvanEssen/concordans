// The bronfilter: one choice that means the same in every view, which kinds of bron
// take part, plus the other filters of the panel Verbonden (lid, rechter, periode,
// betrouwbaarheid, status, a year and a search). The choice lives in the URL
// (`?bronnen=artikelen,wetten`; absent means all) and is parsed once, in
// explore/+page.svelte, into one `VerbondenFilter` that the panel, the margin of the
// reader, the canvas, the legend and the table read.
import { isDay } from '$lib/text/datum';
import { formatCount } from '$lib/text/getal';
import { textOf } from '$lib/text/words';
import { alsDag } from '$lib/text/periode';
import { isExplanatory } from './document-chamber';
import type { Row } from './rows';
import { BILL_KIND, isAmendingRelation, isInternational } from '$lib/vocabulary';
import { PARAM } from '$lib/url/filters';

/** The confidence from which a verbinding's betrouwbaarheid is hoog: a citation read whole has 0.95. */
export const HIGH_CONFIDENCE = 0.9;
/** The confidence from which it is matig; below it laag. */
export const MODERATE_CONFIDENCE = 0.6;

/** Betrouwbaarheid as a word: hoog, matig or laag; without a figure, derived is matig. */
export function confidenceWord(
	confidence: number | null | undefined,
	derived: boolean
): 'hoog' | 'matig' | 'laag' {
	if (confidence == null) return derived ? 'matig' : 'hoog';
	return confidence >= HIGH_CONFIDENCE
		? 'hoog'
		: confidence >= MODERATE_CONFIDENCE
			? 'matig'
			: 'laag';
}

export const FILTER_GROUPS = [
	'artikelen',
	'wetten',
	'uitspraken',
	'toelichtingen',
	'wetsvoorstellen',
	'dossiers',
	'stemmingen',
	'leden',
	'internationaal'
] as const;

export type FilterGroup = (typeof FILTER_GROUPS)[number];

export const FILTER_GROUP_LABEL: Record<FilterGroup, string> = {
	artikelen: 'Artikelen',
	wetten: 'Wetten',
	uitspraken: 'Uitspraken',
	toelichtingen: 'Toelichtingen',
	wetsvoorstellen: 'Wetsvoorstellen',
	dossiers: 'Dossiers',
	stemmingen: 'Stemmingen',
	leden: 'Leden en fracties',
	internationaal: 'Europees en internationaal'
};

/** The kinds as the line "Toon ook rechtspraak" names them. */
export const FILTER_GROUP_NOUN: Record<FilterGroup, string> = {
	artikelen: 'artikelen',
	wetten: 'wetten',
	uitspraken: 'rechtspraak',
	toelichtingen: 'toelichting',
	wetsvoorstellen: 'wetsvoorstellen',
	dossiers: 'dossiers',
	stemmingen: 'stemmingen',
	leden: 'leden en fracties',
	internationaal: 'Europese en internationale bronnen'
};

/** One bron of a kind, for counts of one: `1 wet`, `2 wetten`. */
const FILTER_GROUP_ONE: Record<FilterGroup, string> = {
	artikelen: 'artikel',
	wetten: 'wet',
	uitspraken: 'uitspraak',
	toelichtingen: 'toelichting',
	wetsvoorstellen: 'wetsvoorstel',
	dossiers: 'dossier',
	stemmingen: 'stemming',
	leden: 'lid of fractie',
	internationaal: 'Europese of internationale bron'
};

/** `1 wet`, `3 wetten`: a count with the kind's noun in the right number. */
export const filterGroupCount = (n: number, kind: FilterGroup) =>
	`${formatCount(n)} ${n === 1 ? FILTER_GROUP_ONE[kind] : FILTER_GROUP_LABEL[kind].toLowerCase()}`;

export const RECHTERS = [
	{ id: 'hr', label: 'Hoge Raad' },
	{ id: 'hof', label: 'Gerechtshoven' },
	{ id: 'rechtbank', label: 'Rechtbanken' },
	{ id: 'rvs', label: 'Raad van State' },
	{ id: 'ehrm', label: 'EHRM' },
	{ id: 'hvj', label: 'HvJ EU' }
] as const;

export type Rechter = (typeof RECHTERS)[number]['id'];

export type Betrouwbaarheid = 'bron' | 'afgeleid';
export type Status = 'vastgesteld' | 'voorgesteld';

export type VerbondenFilter = {
	/** The kinds that take part; null is all of them. */
	bronnen: ReadonlySet<FilterGroup> | null;
	/** `2`, or `geen` for verbindingen that name no lid. */
	lid: string | null;
	rechter: Rechter | null;
	/** The period, in days (YYYY-MM-DD) as every list with dates has it ($lib/text/periode). */
	van: string | null;
	tot: string | null;
	/** Verbindingen in force on this date (ISO), instead of a period. */
	geldendOp: string | null;
	betrouwbaarheid: Betrouwbaarheid | null;
	status: Status | null;
	/** One year, chosen in the bar chart of the judgments. */
	jaar: number | null;
	/** Text within the current verbindingen. */
	zoek: string;
};

export const EMPTY_FILTER: VerbondenFilter = {
	bronnen: null,
	lid: null,
	rechter: null,
	van: null,
	tot: null,
	geldendOp: null,
	betrouwbaarheid: null,
	status: null,
	jaar: null,
	zoek: ''
};

const isFilterGroup = (v: string): v is FilterGroup =>
	(FILTER_GROUPS as readonly string[]).includes(v);
const isRechter = (v: string | null): v is Rechter => RECHTERS.some((r) => r.id === v);
const year = (v: string | null) => (v && /^\d{4}$/.test(v) ? Number(v) : null);

/** Whether the reader narrowed the verbindingen: a choice of bronnen or any filter. */
const filterActive = (f: VerbondenFilter): boolean =>
	Object.values(filterParams(f)).some((v) => v !== null);

/** The line of an empty Verbonden: within the choice only where the reader made one. */
export const emptyLine = (f: VerbondenFilter): string =>
	filterActive(f)
		? 'Geen verbindingen binnen de gekozen bronnen en filters.'
		: 'Geen verbindingen.';

/** The filter the URL holds. */
export function parseFilter(params: URLSearchParams): VerbondenFilter {
	const kinds = (params.get('bronnen') ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter(isFilterGroup);
	const rechter = params.get('rechter');
	const betrouwbaarheid = params.get('betrouwbaarheid');
	const status = params.get('status');
	const geldendOp = params.get('geldend');
	return {
		bronnen: kinds.length > 0 ? new Set(kinds) : null,
		lid: params.get('lid') || null,
		rechter: isRechter(rechter) ? rechter : null,
		van: alsDag(params.get(PARAM.since)),
		tot: alsDag(params.get(PARAM.until)),
		geldendOp: isDay(geldendOp) ? geldendOp : null,
		betrouwbaarheid:
			betrouwbaarheid === 'bron' || betrouwbaarheid === 'afgeleid' ? betrouwbaarheid : null,
		status: status === 'vastgesteld' || status === 'voorgesteld' ? status : null,
		jaar: year(params.get('jaar')),
		zoek: params.get(PARAM.q) ?? ''
	};
}

/** The query parameters of a filter; a null value clears the parameter. */
export function filterParams(f: VerbondenFilter): Record<string, string | null> {
	return {
		bronnen: f.bronnen ? FILTER_GROUPS.filter((k) => f.bronnen!.has(k)).join(',') : null,
		lid: f.lid,
		rechter: f.rechter,
		[PARAM.since]: f.van,
		[PARAM.until]: f.tot,
		geldend: f.geldendOp,
		betrouwbaarheid: f.betrouwbaarheid,
		status: f.status,
		jaar: f.jaar ? String(f.jaar) : null,
		[PARAM.q]: f.zoek || null
	};
}

// ── Presets ───────────────────────────────────────────────────────────────

type Preset = {
	id: string;
	label: string;
	bronnen: readonly FilterGroup[] | null;
	rechter?: Rechter;
};

export const PRESETS: readonly Preset[] = [
	{ id: 'alles', label: 'Alles', bronnen: null },
	{ id: 'artikelen', label: 'Alleen artikelen', bronnen: ['artikelen'] },
	{
		id: 'wetteksten',
		label: 'Wetteksten en toelichting',
		bronnen: ['artikelen', 'wetten', 'toelichtingen', 'wetsvoorstellen']
	},
	{ id: 'rechtspraak', label: 'Alleen rechtspraak', bronnen: ['uitspraken'] },
	{ id: 'hoge-raad', label: 'Hoge Raad', bronnen: ['uitspraken'], rechter: 'hr' }
];

const sameGroups = (a: ReadonlySet<FilterGroup> | null, b: readonly FilterGroup[] | null) =>
	a === null ? b === null : b !== null && a.size === b.length && b.every((k) => a.has(k));

/** The preset whose bronnen and rechter the filter has, or null. */
export const activePreset = (f: VerbondenFilter): Preset | null =>
	PRESETS.find((p) => sameGroups(f.bronnen, p.bronnen) && (p.rechter ?? null) === f.rechter) ??
	null;

export const withPreset = (f: VerbondenFilter, p: Preset): VerbondenFilter => ({
	...f,
	bronnen: p.bronnen ? new Set(p.bronnen) : null,
	rechter: p.rechter ?? null
});

export function toggleFilterGroup(f: VerbondenFilter, kind: FilterGroup): VerbondenFilter {
	const next = new Set(f.bronnen ?? FILTER_GROUPS);
	if (!next.delete(kind)) next.add(kind);
	return { ...f, bronnen: next.size === FILTER_GROUPS.length ? null : next };
}

export const withFilterGroup = (f: VerbondenFilter, kind: FilterGroup): VerbondenFilter =>
	f.bronnen === null || f.bronnen.has(kind) ? f : { ...f, bronnen: new Set([...f.bronnen, kind]) };

// ── The kind of a bron ────────────────────────────────────────────────────

/**
 * The kind of a bron for the filter. Documents are split by what they are:
 * toelichtingen (`is_explanatory`, or the kind memorie or nota van toelichting) and
 * wetsvoorstellen (a change of a law that exists, AMENDING_RELATIONS, or the kind of
 * the document). Kamerleden, fracties and commissies are leden: who is involved, not what
 * a dossier holds. Besluiten are stemmingen: what the Kamer decided, not a paper in the
 * dossier (Thijs, 11 Oct: "zijn toch echt anders"); a motie or amendement is a paper and
 * stays with the documents. Activiteiten and toezeggingen stay dossiers: what a dossier's
 * process produced, not a person or a group of them.
 */
export function filterGroupOf(
	collection: string,
	key: string,
	props: Record<string, unknown> | null | undefined,
	relation?: string | null
): FilterGroup {
	if (isInternational({ key, props })) return 'internationaal';
	switch (collection) {
		case 'articles':
		case 'article_versions':
		case 'annexes':
			return 'artikelen';
		case 'instruments':
		case 'instrument_versions':
			return 'wetten';
		case 'judgments':
			return 'uitspraken';
		case 'documents': {
			const kind = typeof props?.kind === 'string' ? props.kind : null;
			if (isExplanatory({ kind, is_explanatory: props?.is_explanatory as boolean | null }))
				return 'toelichtingen';
			if (isAmendingRelation(relation) || (kind && BILL_KIND.test(kind))) return 'wetsvoorstellen';
			return 'dossiers';
		}
		case 'decisions':
			return 'stemmingen';
		case 'members':
		case 'factions':
		case 'committees':
			return 'leden';
		default:
			return 'dossiers';
	}
}

// ── Applying the filter to rows ───────────────────────────────────────────

/** The rechter of a tier of the Instanties value list (`tier`); the conclusions of the Parket with the Hoge Raad. */
const RECHTER_OF_TIER: Record<string, Rechter> = {
	hoge_raad: 'hr',
	parket: 'hr',
	gerechtshof: 'hof',
	rechtbank: 'rechtbank',
	raad_van_state: 'rvs',
	ehrm: 'ehrm',
	hvj_eu: 'hvj'
};

/** The name of a court of the EU, and its case numbers, as the Rechtspraak gives them. */
const EU_COURT = /^(Hof van Justitie|Gerecht( voor ambtenarenzaken)?) van de Europese Unie\b/i;
const EU_CASE = /^[CTF]-\d+\/\d{2}\b/;

/** The country and the court of an ECLI, in its own form or as a key. */
const ECLI_COURT = /^ECLI[:_]([A-Z]{2})[:_]([A-Z]+)[:_]/i;

/**
 * The rechter of a judgment: from the tier the API gives, else from its ECLI (the identifier,
 * or the key it is the id of: `ecli_nl_hr_2024_1769`).
 */
export function rechterOf(row: Pick<Row, 'identifier' | 'props' | 'ref'>): Rechter | null {
	const tier = row.props?.tier;
	if (typeof tier === 'string' && Object.hasOwn(RECHTER_OF_TIER, tier))
		return RECHTER_OF_TIER[tier];
	const source = row.props?.source;
	if (source === 'cjeu') return 'hvj';
	if (source === 'echr') return 'ehrm';
	const code = [row.identifier, row.ref.key]
		.map((id) => (id ? ECLI_COURT.exec(id) : null))
		.find((c) => c !== null);
	if (!code) return null;
	const [country, court] = [code[1].toUpperCase(), code[2].toUpperCase()];
	if (country === 'CE') return 'ehrm';
	if (country === 'EU') return 'hvj';
	// A ruling of the courts of the EU the Rechtspraak publishes under code XX: by its court
	// or its case number (C-437/12).
	if (
		court === 'XX' &&
		(EU_COURT.test(textOf(row.props?.court) ?? '') ||
			EU_CASE.test(textOf(row.props?.case_number) ?? ''))
	)
		return 'hvj';
	if (court === 'HR' || court === 'PHR') return 'hr';
	if (court.startsWith('GH')) return 'hof';
	if (court.startsWith('RB')) return 'rechtbank';
	if (court === 'RVS') return 'rvs';
	return null;
}

const yearOfDate = (date: string | null | undefined) => (date ? Number(date.slice(0, 4)) : null);
const yearOf = (row: Row) => yearOfDate(row.date);

/** Whether the years first..last (open where null) meet van..tot (open where null). */
const spans = (first: number | null, last: number | null, van: number | null, tot: number | null) =>
	(van === null || last === null || last >= van) &&
	(tot === null || first === null || first <= tot);

/** The same for days: a row's first and last day (open where null) and the period. */
const meets = (first: string | null, last: string | null, van: string | null, tot: string | null) =>
	(van === null || last === null || last >= van) &&
	(tot === null || first === null || first <= tot);
const day = (d: string | null | undefined) => (d ? d.slice(0, 10) : null);

/** Whether a row passes the filter. */
export function rowPasses(row: Row, f: VerbondenFilter): boolean {
	if (f.bronnen && !f.bronnen.has(row.filterGroup)) return false;
	if (f.lid !== null) {
		if (f.lid === 'geen' ? row.lid != null : row.lid !== f.lid) return false;
	}
	const judgment =
		row.filterGroup === 'uitspraken' ||
		(row.filterGroup === 'internationaal' && row.ref.collection === 'judgments');
	if (f.rechter !== null && judgment && rechterOf(row) !== f.rechter) return false;
	// A rechter narrows the judgments only; the articles and laws they cite stay, so that
	// the filter carried to the next bron does not hide what the reader came from.
	// A seat counts for every year it lasted; any other row for the year of its date.
	const first = row.period ? yearOfDate(row.period.from) : yearOf(row);
	const last = row.period ? yearOfDate(row.period.to) : yearOf(row);
	const undated = first === null && last === null;
	if (f.jaar !== null && (undated || !spans(first, last, f.jaar, f.jaar))) return false;
	if (
		!meets(
			row.period ? day(row.period.from) : day(row.date),
			row.period ? day(row.period.to) : day(row.date),
			f.van,
			f.tot
		)
	)
		return false;
	if (f.geldendOp !== null && row.date && row.date.slice(0, 10) > f.geldendOp) return false;
	// `bron`: betrouwbaarheid hoog; `afgeleid`: matig or laag.
	const high = confidenceWord(row.confidence, !!row.derived) === 'hoog';
	if (f.betrouwbaarheid === 'bron' && !high) return false;
	if (f.betrouwbaarheid === 'afgeleid' && high) return false;
	if (f.status === 'voorgesteld' && !row.proposed) return false;
	if (f.status === 'vastgesteld' && row.proposed) return false;
	if (f.zoek) {
		const q = f.zoek.toLowerCase();
		const hay = [row.title, row.context, row.identifier, row.position, row.aard, row.snippet]
			.filter(Boolean)
			.join(' ')
			.toLowerCase();
		if (!hay.includes(q)) return false;
	}
	return true;
}

/** Rows per kind, hidden by the bronnen of the filter alone; the other filters do not count. */
export function hiddenByGroup(
	rows: readonly Row[],
	totals: Partial<Record<FilterGroup, number>>,
	f: VerbondenFilter
): { group: FilterGroup; count: number }[] {
	if (f.bronnen === null) return [];
	const counted = new Map<FilterGroup, number>();
	for (const row of rows) counted.set(row.filterGroup, (counted.get(row.filterGroup) ?? 0) + 1);
	return FILTER_GROUPS.filter((k) => !f.bronnen!.has(k))
		.map((group) => ({ group, count: Math.max(totals[group] ?? 0, counted.get(group) ?? 0) }))
		.filter((h) => h.count > 0);
}
