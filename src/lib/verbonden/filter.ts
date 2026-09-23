// The bronfilter: one choice that means the same in every view, which kinds of bron
// take part, plus the other filters of the panel Verbonden (lid, rechter, periode,
// betrouwbaarheid, status, a year and a search). The choice lives in the URL
// (`?bronnen=artikelen,wetten`; absent means all) and is parsed once, in
// explore/+page.svelte, into one `VerbondenFilter` that the panel, the margin of the
// reader, the canvas, the legend and the table read.
import { isExplanatory } from './chamber';
import type { Row } from './rows';

export const BRON_KINDS = [
	'artikelen',
	'wetten',
	'uitspraken',
	'toelichtingen',
	'wetsvoorstellen',
	'dossiers',
	'leden',
	'internationaal'
] as const;

export type BronKind = (typeof BRON_KINDS)[number];

export const BRON_KIND_LABEL: Record<BronKind, string> = {
	artikelen: 'Artikelen',
	wetten: 'Wetten',
	uitspraken: 'Uitspraken',
	toelichtingen: 'Toelichtingen',
	wetsvoorstellen: 'Wetsvoorstellen',
	dossiers: 'Dossiers',
	leden: 'Leden en fracties',
	internationaal: 'Europees en internationaal'
};

/** The kinds as the line "Toon ook rechtspraak" names them. */
export const BRON_KIND_NOUN: Record<BronKind, string> = {
	artikelen: 'artikelen',
	wetten: 'wetten',
	uitspraken: 'rechtspraak',
	toelichtingen: 'toelichting',
	wetsvoorstellen: 'wetsvoorstellen',
	dossiers: 'dossiers',
	leden: 'leden en fracties',
	internationaal: 'Europese en internationale bronnen'
};

export const RECHTERS = [
	{ id: 'hr', label: 'Hoge Raad' },
	{ id: 'hof', label: 'gerechtshoven' },
	{ id: 'rechtbank', label: 'rechtbanken' },
	{ id: 'rvs', label: 'Raad van State' },
	{ id: 'ehrm', label: 'EHRM' }
] as const;

export type Rechter = (typeof RECHTERS)[number]['id'];

export type Betrouwbaarheid = 'bron' | 'afgeleid';
export type Status = 'vastgesteld' | 'voorgesteld';

export type VerbondenFilter = {
	/** The kinds that take part; null is all of them. */
	bronnen: ReadonlySet<BronKind> | null;
	/** `2`, or `geen` for verbindingen that name no lid. */
	lid: string | null;
	rechter: Rechter | null;
	van: number | null;
	tot: number | null;
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

const isKind = (v: string): v is BronKind => (BRON_KINDS as readonly string[]).includes(v);
const isRechter = (v: string | null): v is Rechter => RECHTERS.some((r) => r.id === v);
const year = (v: string | null) => (v && /^\d{4}$/.test(v) ? Number(v) : null);

/** The filter the URL holds. */
export function parseFilter(params: URLSearchParams): VerbondenFilter {
	const kinds = (params.get('bronnen') ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter(isKind);
	const rechter = params.get('rechter');
	const betrouwbaarheid = params.get('betrouwbaarheid');
	const status = params.get('status');
	const geldendOp = params.get('geldend');
	return {
		bronnen: kinds.length > 0 ? new Set(kinds) : null,
		lid: params.get('lid') || null,
		rechter: isRechter(rechter) ? rechter : null,
		van: year(params.get('van')),
		tot: year(params.get('tot')),
		geldendOp: geldendOp && /^\d{4}-\d{2}-\d{2}$/.test(geldendOp) ? geldendOp : null,
		betrouwbaarheid:
			betrouwbaarheid === 'bron' || betrouwbaarheid === 'afgeleid' ? betrouwbaarheid : null,
		status: status === 'vastgesteld' || status === 'voorgesteld' ? status : null,
		jaar: year(params.get('jaar')),
		zoek: params.get('zoek') ?? ''
	};
}

/** The query parameters of a filter; a null value clears the parameter. */
export function filterParams(f: VerbondenFilter): Record<string, string | null> {
	return {
		bronnen: f.bronnen ? BRON_KINDS.filter((k) => f.bronnen!.has(k)).join(',') : null,
		lid: f.lid,
		rechter: f.rechter,
		van: f.van ? String(f.van) : null,
		tot: f.tot ? String(f.tot) : null,
		geldend: f.geldendOp,
		betrouwbaarheid: f.betrouwbaarheid,
		status: f.status,
		jaar: f.jaar ? String(f.jaar) : null,
		zoek: f.zoek || null
	};
}

export const isFiltering = (f: VerbondenFilter) =>
	f.bronnen !== null ||
	f.lid !== null ||
	f.rechter !== null ||
	f.van !== null ||
	f.tot !== null ||
	f.geldendOp !== null ||
	f.betrouwbaarheid !== null ||
	f.status !== null ||
	f.jaar !== null ||
	f.zoek !== '';

// ── Presets ───────────────────────────────────────────────────────────────

export type Preset = {
	id: string;
	label: string;
	bronnen: readonly BronKind[] | null;
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

const sameKinds = (a: ReadonlySet<BronKind> | null, b: readonly BronKind[] | null) =>
	a === null ? b === null : b !== null && a.size === b.length && b.every((k) => a.has(k));

/** The preset whose bronnen and rechter the filter has, or null. */
export const activePreset = (f: VerbondenFilter): Preset | null =>
	PRESETS.find((p) => sameKinds(f.bronnen, p.bronnen) && (p.rechter ?? null) === f.rechter) ?? null;

/** What the button in the head of the panel says: `Alle bronnen` or the preset. */
export function bronnenLabel(f: VerbondenFilter): string {
	if (f.bronnen === null && f.rechter === null) return 'Alle bronnen';
	const preset = activePreset(f);
	if (preset) return preset.label;
	if (f.bronnen === null) return 'Alle bronnen';
	return BRON_KINDS.filter((k) => f.bronnen!.has(k))
		.map((k) => BRON_KIND_NOUN[k])
		.join(', ');
}

export const withPreset = (f: VerbondenFilter, p: Preset): VerbondenFilter => ({
	...f,
	bronnen: p.bronnen ? new Set(p.bronnen) : null,
	rechter: p.rechter ?? null
});

export function toggleKind(f: VerbondenFilter, kind: BronKind): VerbondenFilter {
	const next = new Set(f.bronnen ?? BRON_KINDS);
	if (!next.delete(kind)) next.add(kind);
	return { ...f, bronnen: next.size === BRON_KINDS.length ? null : next };
}

export const withKind = (f: VerbondenFilter, kind: BronKind): VerbondenFilter =>
	f.bronnen === null || f.bronnen.has(kind) ? f : { ...f, bronnen: new Set([...f.bronnen, kind]) };

// ── The kind of a bron ────────────────────────────────────────────────────

// TODO(backend B9): nothing marks a bron as European or international. Until an
// `eu-links` route exists, the jurisdiction is read from the id: a CELEX number, a
// BWBV (verdrag) id, the ECHR collection.
const INTERNATIONAL_KEY = /^(bwbv\d{7}|[0-9ce]\d{4}[a-z]{1,2}\d{4}|echr_)/i;

export const isInternational = (n: {
	key: string;
	props?: Record<string, unknown> | null;
}): boolean =>
	INTERNATIONAL_KEY.test(n.key) ||
	n.props?.source === 'echr' ||
	n.props?.jurisdiction === 'eu' ||
	n.props?.jurisdiction === 'int';

/** A document that proposes or enacts a change: a wetsvoorstel or an amendment to it. */
const BILL_KIND = /\b(voorstel van wet|wetsvoorstel|nota van wijziging|amendement)\b/i;
const CHANGE_RELATIONS: ReadonlySet<string> = new Set(['AMENDS', 'INTRODUCES', 'REPEALS']);

/**
 * The kind of a bron for the filter. Documents are split by what they are:
 * toelichtingen (`is_explanatory`, or the kind memorie or nota van toelichting) and
 * wetsvoorstellen (the relations AMENDS, INTRODUCES and REPEALS, or the kind of the
 * document). Kamerleden, fracties and commissies are leden: who is involved, not what
 * a dossier holds. Activiteiten, besluiten and toezeggingen stay dossiers: what a
 * dossier's process produced, not a person or a group of them.
 */
export function bronKindOf(
	collection: string,
	key: string,
	props: Record<string, unknown> | null | undefined,
	relation?: string | null
): BronKind {
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
			if ((relation && CHANGE_RELATIONS.has(relation)) || (kind && BILL_KIND.test(kind)))
				return 'wetsvoorstellen';
			return 'dossiers';
		}
		case 'members':
		case 'factions':
		case 'committees':
			return 'leden';
		default:
			return 'dossiers';
	}
}

// ── Applying the filter to rows ───────────────────────────────────────────

/** The rechter of a judgment, from its ECLI or its court name. */
export function rechterOf(row: Pick<Row, 'identifier' | 'court' | 'ref'>): Rechter | null {
	const ecli = row.identifier ?? '';
	const code = /^ECLI:([A-Z]{2}):([A-Z]+):/i.exec(ecli);
	const court = row.court ?? '';
	if (code) {
		const [, country, c] = [code[0], code[1].toUpperCase(), code[2].toUpperCase()];
		if (country === 'CE') return 'ehrm';
		if (c === 'HR' || c === 'PHR') return 'hr';
		if (c.startsWith('GH')) return 'hof';
		if (c.startsWith('RB')) return 'rechtbank';
		if (c === 'RVS') return 'rvs';
	}
	if (/hoge raad/i.test(court)) return 'hr';
	if (/gerechtshof|\bhof\b/i.test(court)) return 'hof';
	if (/rechtbank/i.test(court)) return 'rechtbank';
	if (/raad van state/i.test(court)) return 'rvs';
	if (/echr|ehrm|europees hof/i.test(court) || row.ref.key.startsWith('echr_')) return 'ehrm';
	return null;
}

const yearOf = (row: Row) => (row.date ? Number(row.date.slice(0, 4)) : null);

/** Whether a row passes the filter. */
export function rowPasses(row: Row, f: VerbondenFilter): boolean {
	if (f.bronnen && !f.bronnen.has(row.kind)) return false;
	if (f.lid !== null) {
		if (f.lid === 'geen' ? row.lid != null : row.lid !== f.lid) return false;
	}
	if (f.rechter !== null && row.kind === 'uitspraken' && rechterOf(row) !== f.rechter) return false;
	if (f.rechter !== null && row.kind !== 'uitspraken' && row.kind !== 'internationaal')
		return false;
	const y = yearOf(row);
	if (f.jaar !== null && y !== f.jaar) return false;
	if (f.van !== null && y !== null && y < f.van) return false;
	if (f.tot !== null && y !== null && y > f.tot) return false;
	if (f.geldendOp !== null && row.date && row.date.slice(0, 10) > f.geldendOp) return false;
	if (f.betrouwbaarheid === 'bron' && row.derived) return false;
	if (f.betrouwbaarheid === 'afgeleid' && !row.derived) return false;
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
export function hiddenByKind(
	rows: readonly Row[],
	totals: Partial<Record<BronKind, number>>,
	f: VerbondenFilter
): { kind: BronKind; count: number }[] {
	if (f.bronnen === null) return [];
	const counted = new Map<BronKind, number>();
	for (const row of rows) counted.set(row.kind, (counted.get(row.kind) ?? 0) + 1);
	return BRON_KINDS.filter((k) => !f.bronnen!.has(k))
		.map((kind) => ({ kind, count: Math.max(totals[kind] ?? 0, counted.get(kind) ?? 0) }))
		.filter((h) => h.count > 0);
}

/** `1.104` in Dutch notation. */
export const formatCount = (n: number) => n.toLocaleString('nl-NL');
