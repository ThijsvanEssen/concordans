// What a reference shows on hover or focus, for any kind of bron: its kind, its name, a
// date, and its first lines. Read from the node the API gives; for an article, the text
// of the part the reference names.
import { api } from '$lib/api/client';
import { getArticleDetail } from '$lib/api/articles';
import { formatLongDate } from '$lib/components/explore/readers/_shared';
import { dossierStatus, isOutcome } from '$lib/components/parliamentary/stages';
import { parseArticleParts, partText } from '$lib/text/article-parts';
import { articleTitle } from '$lib/text/bw';
import { courtName } from '$lib/verbonden/rows';
import { bronLabel, isCollection, type Collection } from '$lib/vocabulary';
import { focusOf, type BronRef } from './href';

export type Preview = {
	/** The kind, and where it helps its place: `Uitspraak · Hoge Raad`. */
	kicker: string;
	title: string;
	date: string | null;
	/** The first lines: an article's text, a judgment's summary, a dossier's phase. */
	lines: string | null;
};

/** How much text a card shows. */
export const PREVIEW_CHARS = 400;

const text = (value: unknown): string | null =>
	typeof value === 'string' && value.trim() ? value.trim() : null;

const clip = (s: string | null) =>
	s && s.length > PREVIEW_CHARS ? `${s.slice(0, PREVIEW_CHARS).trimEnd()}…` : s;

/** The card of a bron from its node: the name, the kind, a date, and what it says first. */
export function previewFromNode(
	collection: Collection,
	displayName: string | null,
	props: Record<string, unknown>
): Preview {
	const kind = bronLabel(collection);
	const name = text(displayName) ?? text(props.name) ?? text(props.title) ?? kind;
	switch (collection) {
		case 'judgments': {
			const court = courtName(text(props.court) ?? text(props.court_code));
			return {
				kicker: court ? `${kind} · ${court}` : kind,
				title: name,
				date: formatLongDate(text(props.date)) || null,
				lines: clip(text(props.summary))
			};
		}
		case 'dossiers': {
			const { outcome, current_phase } = props;
			return {
				kicker: `${kind} ${text(props.label) ?? ''}`.trim(),
				title: text(props.title) ?? name,
				date: formatLongDate(text(props.opened_on)) || null,
				lines: dossierStatus({
					outcome: isOutcome(outcome) ? outcome : null,
					current_phase: typeof current_phase === 'string' ? current_phase : null
				})
			};
		}
		case 'documents':
			return {
				kicker: text(props.kind) ?? kind,
				title: text(props.title) ?? name,
				date: formatLongDate(text(props.date)) || null,
				lines: null
			};
		case 'members':
			return {
				kicker: kind,
				title: text(props.name) ?? name,
				date: null,
				lines: text(props.party)
			};
		case 'factions':
			return {
				kicker: kind,
				title: text(props.name) ?? name,
				date: null,
				lines: text(props.seats) ? `${text(props.seats)} zetels` : null
			};
		case 'cabinets': {
			const from = formatLongDate(text(props.from_date));
			const to = formatLongDate(text(props.to_date));
			return {
				kicker: kind,
				title: name,
				date: from ? (to ? `${from} tot ${to}` : `sinds ${from}`) : null,
				lines: null
			};
		}
		case 'articles':
			return { kicker: kind, title: articleTitle(name, props), date: null, lines: null };
		default:
			return { kicker: kind, title: name, date: null, lines: null };
	}
}

const cache = new Map<string, Promise<Preview | null>>();

/** The card of a bron, asked for once per bron and position. */
export function loadPreview(
	ref: BronRef | string,
	at: string | null = null
): Promise<Preview | null> {
	const id = focusOf(ref);
	if (!id) return Promise.resolve(null);
	const cacheKey = `${id}#${at ?? ''}`;
	let request = cache.get(cacheKey);
	if (!request) {
		request = fetchPreview(id, at).catch(() => null);
		cache.set(cacheKey, request);
	}
	return request;
}

async function fetchPreview(id: string, at: string | null): Promise<Preview | null> {
	const slash = id.indexOf('/');
	const collection = id.slice(0, slash);
	const key = id.slice(slash + 1);
	if (!isCollection(collection)) return null;
	if (collection === 'dossiers') {
		const { data } = await api.GET('/api/dossiers/{number}', { params: { path: { number: key } } });
		return data
			? previewFromNode('dossiers', data.title ?? null, {
					label: data.number,
					title: data.title,
					opened_on: data.opened_on,
					outcome: data.outcome,
					current_phase: data.current_phase
				})
			: null;
	}
	const { data } = await api.GET('/api/nodes/{collection}/{key}', {
		params: { path: { collection, key }, query: { limit: 1 } }
	});
	const node = data?.node;
	if (!node) return null;
	const props = (node.props ?? {}) as Record<string, unknown>;
	const preview = previewFromNode(collection, node.display_name ?? null, props);
	if (collection !== 'articles') return preview;
	// An article shows its text, or the part the reference names.
	const bwb = text(props.bwb_id) ?? text(props.celex);
	const number = text(props.article_number);
	if (!bwb || !number) return preview;
	const { article } = await getArticleDetail(bwb, number);
	const whole = article.text ?? '';
	const part = at ? partText(whole, parseArticleParts(whole), at) : null;
	return {
		...preview,
		title: article.heading ? `${preview.title}. ${article.heading}` : preview.title,
		lines: clip(part || whole || null)
	};
}
