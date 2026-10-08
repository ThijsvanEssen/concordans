import { judgmentCite } from '$lib/text/judgment-cite';
// How a search result reads: a title that tells it from its neighbours, the context a
// lawyer checks it by, and where the API gives one, a line of the text with the words
// searched for marked. Stukken of one dossier stand under that dossier.
import type { Schema } from '$lib/api/types';
import { formatLongDate } from '$lib/components/explore/readers/_shared';
import { dossierStatus, isOutcome } from '$lib/components/parliamentary/stages';
import { articleName } from '$lib/text/bw';
import { korteDatum } from '$lib/text/datum';
import { bronPlural, type Collection } from '$lib/vocabulary';
import type { Chamber } from '$lib/components/parliamentary/chamber';

type Hit = Schema<'SearchResultItem'>;

export type Segment = { text: string; mark: boolean };

export type Presented = {
	title: string;
	/** Right of the title, in the small face: the law, the ECLI, the dossier number. */
	context: string;
	/** A line of the text, or null when the API gives none worth reading. */
	snippet: Segment[] | null;
	/** The Kamer of a stuk: the same kind of stuk exists in both. */
	chamber?: Chamber;
};

/** The Kamer a stuk was published in, as the API gives it (0.73, BE-39). */
export function chamberOfHit(hit: Hit): Chamber | undefined {
	if (hit.collection !== 'documents' && hit.collection !== 'decisions') return undefined;
	const given = extra(hit, 'chamber').toUpperCase();
	return given === 'TK' || given === 'EK' ? given : undefined;
}

/** The heading of a group of hits. Leden: a group holds members of both Kamers and bewindspersonen. */
export const groupLabel = (kind: Collection): string =>
	kind === 'members' ? 'Leden' : bronPlural(kind);

const extra = (hit: Hit, name: string): string => {
	const value = hit.extra?.[name];
	return typeof value === 'string' ? value : '';
};

const extras = (hit: Hit, name: string): string[] => {
	const value = hit.extra?.[name];
	return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `text` in pieces, the words of `query` (three letters or more) marked. */
export function marked(text: string, query: string): Segment[] {
	const words = query
		.split(/\s+/)
		.filter((w) => w.length >= 3)
		.map(escape);
	if (words.length === 0) return [{ text, mark: false }];
	// Split with a capture group: the odd pieces are the matches.
	return text
		.split(new RegExp(`(${words.join('|')})`, 'i'))
		.map((part, i) => ({ text: part, mark: i % 2 === 1 }))
		.filter((s) => s.text !== '');
}

/** The text from a little before the first word searched for, so the line shows it. */
export function around(text: string, query: string, lead = 40): string {
	const words = query
		.split(/\s+/)
		.filter((w) => w.length >= 3)
		.map(escape);
	const at = words.length ? text.search(new RegExp(words.join('|'), 'i')) : -1;
	if (at <= lead) return text;
	const start = text.lastIndexOf(' ', at - lead);
	return `…${text.slice(start < 0 ? at - lead : start + 1)}`;
}

const TRANSLATION = /\((engels|engelse vertaling|english translation)\)\s*$/i;

/** "Hoge Raad 2024-09-24 / 23/02910" in its parts. */
function judgmentParts(name: string): {
	court: string;
	date: string | null;
	caseNumber: string | null;
} {
	const m = /^(.*?)\s+(\d{4}-\d{2}-\d{2})(?:\s*\/\s*(.+))?$/.exec(name);
	return m
		? { court: m[1], date: m[2], caseNumber: m[3] ?? null }
		: { court: name, date: null, caseNumber: null };
}

/** The code a BW book is cited by is `BW`; any other law by its short title. */
function lawOf(hit: Hit): string {
	const title = extra(hit, 'citation_title');
	if (/^Burgerlijk Wetboek Boek /i.test(title)) return 'BW';
	return extra(hit, 'short_title') || title;
}

/**
 * The name a bill is known by, as the source writes it at the end of its title: "(Wet
 * betaalbare huur)" in "Wijziging van de Wet goed verhuurderschap, … (Wet betaalbare huur)".
 * The API's short title first, when a hit carries one. On a phone the long title cuts off
 * before it (UX audit Z5, 9 Oct).
 */
export function citeertitel(hit: Hit): string | null {
	const kort = extra(hit, 'short_title');
	if (kort) return kort;
	const m = /\(([^()]+)\)\s*$/.exec((hit.display_name ?? '').trim());
	const naam = m?.[1].trim();
	// A name starts with a capital ("Wet betaalbare huur"); "(vereenvoudiging van de
	// huurtoeslag)" describes the bill and is no name of it.
	return naam && /^\p{Lu}/u.test(naam) ? naam : null;
}

export function presentHit(hit: Hit, query: string): Presented {
	const snippet = typeof hit.snippet === 'string' ? hit.snippet.trim() : '';
	switch (hit.collection) {
		case 'articles': {
			const number = extra(hit, 'article_number');
			if (!number) break;
			const heading = extra(hit, 'heading');
			return {
				title: `${articleName(extra(hit, 'bwb_id'), number, extra(hit, 'label'))}${heading ? `. ${heading}` : ''}`,
				context: lawOf(hit),
				snippet: snippet ? marked(around(snippet, query), query) : null
			};
		}
		case 'judgments': {
			// Cited as lawyers do, the ECLI under it: HR 19 juli 2019.
			const { court, date, caseNumber } = judgmentParts(hit.display_name ?? '');
			const names = extras(hit, 'names');
			const ecli = extra(hit, 'ecli');
			// A judgment only cited, not in the data, has no date: the year of its ECLI.
			const year = !date && ecli ? (/^ECLI:[^:]+:[^:]+:(\d{4}):/i.exec(ecli)?.[1] ?? null) : null;
			const cited = ecli ? judgmentCite(ecli, date, court).short : null;
			const when = cited
				? year
					? `${cited} ${year}`
					: cited
				: date
					? `${court}, ${formatLongDate(date)}`
					: court;
			// The court publishes a translation under its own ECLI and the same date; the name
			// it gives says so ("(Engels)", "(English translation)"), and the title too.
			const translation = TRANSLATION.test(caseNumber ?? '') ? ', Engelse vertaling' : '';
			return {
				title: `${names.length ? `${when} (${names.join(', ')})` : when || ecli}${translation}`,
				context: ecli,
				snippet: snippet && snippet !== ecli ? marked(around(snippet, query), query) : null
			};
		}
		case 'dossiers': {
			const { outcome, current_phase } = hit.extra ?? {};
			const status = dossierStatus({
				outcome: isOutcome(outcome) ? outcome : null,
				current_phase: typeof current_phase === 'string' ? current_phase : null
			});
			const kort = citeertitel(hit);
			const lang = hit.display_name ?? hit.key;
			return {
				title: kort ?? lang,
				context: [extra(hit, 'number'), status].filter(Boolean).join(', '),
				// The long title below the name it is known by.
				snippet: kort && kort !== lang ? [{ text: lang, mark: false }] : null
			};
		}
		case 'documents': {
			// The name of a Kamerstuk is its dossier's title, the heading it stands under; its
			// kind and number tell stukken apart. A stuk outside a dossier (a stenogram) has
			// its own name: `Stikstof en natuur`, with its kind beside it.
			const kind = extra(hit, 'kind') || (hit.display_name ?? hit.key);
			const chamber = chamberOfHit(hit);
			// The day it was published (BE-1): stukken of one kind differ by it.
			const date = korteDatum(extra(hit, 'date'));
			if (!sectionOf(hit) && hit.display_name && hit.display_name !== kind)
				return {
					title: hit.display_name,
					context: [kind, date].filter(Boolean).join(', '),
					snippet: null,
					chamber
				};
			const sequence = hit.extra?.sequence;
			const number =
				typeof sequence === 'string' || typeof sequence === 'number' ? String(sequence) : '';
			return {
				title: number ? `${kind}, nr. ${number}` : kind,
				context: date,
				snippet: null,
				chamber
			};
		}
		case 'instruments':
			return { title: hit.display_name ?? hit.key, context: extra(hit, 'bwb_id'), snippet: null };
		case 'members':
			return { title: hit.display_name ?? hit.key, context: extra(hit, 'party'), snippet: null };
		case 'commitments': {
			// A toezegging by its text, with its number and the day it was made: "TZ202609-117,
			// 29 sep. 2026", and its status where it is not open.
			const status = extra(hit, 'status');
			return {
				title: hit.display_name ?? hit.key,
				context: [
					extra(hit, 'number'),
					korteDatum(extra(hit, 'made_on')),
					status && status !== 'Openstaand' ? status.toLowerCase() : ''
				]
					.filter(Boolean)
					.join(', '),
				snippet: null
			};
		}
		case 'decisions': {
			// A vote by what it was about, with its outcome and day as the source has them:
			// "Wet toekomstbestendige huurcommissie (36.791)", "aangenomen, 29 sep. 2026".
			const name = hit.display_name ?? hit.key;
			const subject = extra(hit, 'subject') || name.replace(/^[^:]*\d{4}-\d{2}-\d{2}:\s*/, '');
			const passed = hit.extra?.passed;
			return {
				title: subject || name,
				context: [
					passed === true ? 'aangenomen' : passed === false ? 'verworpen' : '',
					korteDatum(extra(hit, 'date'))
				]
					.filter(Boolean)
					.join(', '),
				snippet: null,
				chamber: chamberOfHit(hit)
			};
		}
		case 'cabinets': {
			// "kabinet-Schoof", with its period (BE-35): "2 jul. 2024 tot 23 feb. 2026".
			const from = korteDatum(extra(hit, 'from_date'));
			const to = korteDatum(extra(hit, 'to_date'));
			return {
				title: hit.display_name ?? hit.key,
				context: from ? (to ? `${from} tot ${to}` : `sinds ${from}`) : '',
				snippet: null
			};
		}
	}
	return { title: hit.display_name ?? hit.key, context: '', snippet: null };
}

/** The dossier a stuk belongs to, as its heading reads: `32621 Wet nadeelcompensatie …`. */
export function sectionOf(hit: Hit): string | null {
	if (hit.collection !== 'documents') return null;
	const number = extra(hit, 'dossier_number');
	return number ? `${number} ${citeertitel(hit) ?? hit.display_name ?? ''}`.trim() : null;
}

/** Hits of one section together, in the order their sections first appear. */
export function bySection(hits: Hit[]): Hit[] {
	const order: (string | null)[] = [];
	const buckets = new Map<string | null, Hit[]>();
	for (const hit of hits) {
		const section = sectionOf(hit);
		if (!buckets.has(section)) {
			buckets.set(section, []);
			order.push(section);
		}
		buckets.get(section)!.push(hit);
	}
	return order.flatMap((s) => buckets.get(s)!);
}

/**
 * The groups of a search, the best answer first. /api/search gives every hit a score, its
 * rank tier for the query: an identifier (1), the whole name (0.75), the start of the name
 * (0.5), part of it (0.25) or words of the text only (0.1). A group stands by its best hit:
 * "PVV" names a fractie (1) before the judgments on IB/PVV that only contain it (0.1);
 * "stikstof" names debates (0.5) before judgments. On a tie a name comes first: a fractie,
 * a lid, a dossier, before the papers that name them.
 */
const TIE_ORDER: readonly Collection[] = [
	'cabinets',
	'commitments',
	'factions',
	'members',
	'dossiers',
	'committees',
	'instruments',
	'articles',
	'judgments',
	'documents',
	'decisions'
];

export function orderGroups<G extends { kind: Collection; hits: Hit[] }>(groups: G[]): G[] {
	const best = (g: G) => Math.max(0, ...g.hits.map((h) => h.score ?? 0));
	const tie = (g: G) => {
		const i = TIE_ORDER.indexOf(g.kind);
		return i < 0 ? TIE_ORDER.length : i;
	};
	return [...groups].sort((a, b) => best(b) - best(a) || tie(a) - tie(b));
}

/** How much lower a law's or an article's best hit may score and still come first. */
export const RECHT_MARGE = 0.25;
const RECHT: readonly Collection[] = ['articles', 'instruments'];

/**
 * The one hit above all groups (Thijs, 8 Oct: "Beste treffer"): an identifier where one
 * matches; else an article or a law where its best hit scores nearly as well as the best of
 * all (within RECHT_MARGE), so "huurverhoging" leads with the rule and not with Kamervragen;
 * else the best hit of all. None for a single group, which says it already.
 */
export function besteTreffer<G extends { kind: Collection; hits: Hit[] }>(
	groups: G[]
): { kind: G['kind']; hit: Hit } | null {
	if (groups.length < 2) return null;
	const all = groups.flatMap((g) => g.hits.map((hit) => ({ kind: g.kind, hit })));
	if (!all.length) return null;
	const score = (x: { hit: Hit }) => x.hit.score ?? 0;
	const top = Math.max(...all.map(score));
	const first = (xs: typeof all) =>
		xs.reduce<(typeof all)[number] | null>((m, x) => (!m || score(x) > score(m) ? x : m), null);
	const id = all.find((x) => score(x) >= 1);
	if (id) return id;
	const recht = first(RECHT.flatMap((k) => all.filter((x) => x.kind === k && score(x) > 0)));
	if (recht && score(recht) >= top - RECHT_MARGE) return recht;
	return first(orderGroups(groups).flatMap((g) => all.filter((x) => x.kind === g.kind)));
}
