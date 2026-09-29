import { judgmentCite } from '$lib/text/judgment-cite';
// How a search result reads: a title that tells it from its neighbours, the context a
// lawyer checks it by, and where the API gives one, a line of the text with the words
// searched for marked. Stukken of one dossier stand under that dossier.
import type { Schema } from '$lib/api/types';
import { formatLongDate } from '$lib/components/explore/readers/_shared';
import { dossierStatus, isOutcome, isStage } from '$lib/components/parliamentary/stages';
import { articleName } from '$lib/text/bw';

type Hit = Schema<'SearchResultItem'>;

export type Segment = { text: string; mark: boolean };

export type Presented = {
	title: string;
	/** Right of the title, in the small face: the law, the ECLI, the dossier number. */
	context: string;
	/** A line of the text, or null when the API gives none worth reading. */
	snippet: Segment[] | null;
};

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
			const { court, date } = judgmentParts(hit.display_name ?? '');
			const names = extras(hit, 'names');
			const ecli = extra(hit, 'ecli');
			const when = ecli
				? judgmentCite(ecli, date, court).short
				: date
					? `${court}, ${formatLongDate(date)}`
					: court;
			return {
				title: names.length ? `${when} (${names.join(', ')})` : when || ecli,
				context: ecli,
				snippet: snippet && snippet !== ecli ? marked(around(snippet, query), query) : null
			};
		}
		case 'dossiers': {
			const { outcome, current_stage } = hit.extra ?? {};
			const status = dossierStatus({
				outcome: isOutcome(outcome) ? outcome : null,
				current_stage: isStage(current_stage) ? current_stage : null
			});
			return {
				title: hit.display_name ?? hit.key,
				context: [extra(hit, 'number'), status].filter(Boolean).join(' · '),
				snippet: null
			};
		}
		case 'documents': {
			// The name of a stuk is its dossier's title; its kind and number tell stukken apart.
			const kind = extra(hit, 'kind') || (hit.display_name ?? hit.key);
			const sequence = hit.extra?.sequence;
			const number =
				typeof sequence === 'string' || typeof sequence === 'number' ? String(sequence) : '';
			return {
				title: number ? `${kind}, nr. ${number}` : kind,
				context: '',
				snippet: null
			};
		}
		case 'instruments':
			return { title: hit.display_name ?? hit.key, context: extra(hit, 'bwb_id'), snippet: null };
		case 'members':
			return { title: hit.display_name ?? hit.key, context: extra(hit, 'party'), snippet: null };
	}
	return { title: hit.display_name ?? hit.key, context: '', snippet: null };
}

/** The dossier a stuk belongs to, as its heading reads: `32621 Wet nadeelcompensatie …`. */
export function sectionOf(hit: Hit): string | null {
	if (hit.collection !== 'documents') return null;
	const number = extra(hit, 'dossier_number');
	return number ? `${number} ${hit.display_name ?? ''}`.trim() : null;
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
