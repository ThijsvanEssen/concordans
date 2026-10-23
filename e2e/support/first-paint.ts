// The first paint of a reader's address (src/lib/first-paint) in the suite: the page as the
// server gives it, with the bron as the API's /render puts it in (api/seo/paint.py), made here
// of the recorded answers of the API the paint's fields come from, and the build's own
// script of its kind (build/first-paint-article.js). Then the paint and the app that takes it
// over can be held side by side.
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { API_ORIGIN, fileOf, keyOf } from './api';

/** The recorded answer to `path` (with its query) of the API. */
function answer<T = Record<string, unknown>>(path: string): T {
	const recorded = JSON.parse(
		gunzipSync(readFileSync(fileOf(keyOf(API_ORIGIN + path)))).toString()
	) as { body: T };
	return recorded.body;
}

/**
 * What the server gives the first paint of the article `number` of the law `law` (its node
 * `key`): as api/seo/paint.py makes it, of the answers the reader asks for itself.
 */
export function articlePaint(law: string, number: string, key: string) {
	const detail = answer<Record<string, Record<string, unknown>>>(`/api/articles/${law}/${number}`);
	const history = answer<{ versions: unknown[] }>(`/api/articles/${law}/${number}/history`);
	const explained = answer<{ items: unknown[] }>(
		`/api/articles/${law}/${number}/explained-by?limit=50`
	);
	const light = answer<{ node: { props: Record<string, unknown> } }>(
		`/api/nodes/articles/${key}?limit=1`
	);
	const list = answer<{ items: { key: string; stub?: boolean }[] }>(
		`/api/instruments/${law}/articles?limit=2000&text_preview_chars=1`
	).items.filter((a) => !a.stub);
	const at = list.findIndex((a) => a.key === key);
	// The law as api/seo/paint.py gives it: the props of its node.
	const instrument = detail.instrument as Record<string, unknown>;
	const record = answer<Record<string, unknown>>(`/api/instruments/${law}`);
	const props = Object.fromEntries(
		['kind', 'citation_title', 'title', 'bwb_id', 'celex', 'abbreviation']
			.map((name) => [name, record[name] ?? instrument[name]])
			.filter(([, value]) => value)
	);
	const article = detail.article;
	return {
		kind: 'article',
		article: { ...article, law_id: law },
		instrument: detail.instrument,
		completeness: detail.completeness,
		versions: history.versions,
		explained: explained.items,
		mvt: null,
		law: {
			collection: 'instruments',
			key: instrument.key,
			display_name: instrument.display_name,
			props
		},
		node: light.node.props,
		steps: { listed: at >= 0, prev: at > 0, next: at >= 0 && at < list.length - 1 },
		delegations: (detail.delegations as unknown as { start: number; end: number }[]) ?? []
	};
}

/** The relations of a judgment's band (api/seo/paint.py): its procesgang and its conclusie. */
const BAND = ['APPEAL_OF', 'ADVISES_ON'];
/** The props of its light node the band reads. */
const BAND_PROPS = ['outcome', 'unresolved_appeal_targets', 'translation_of'];
/** The characters of its text the paint sets. */
const JUDGMENT_TEXT = 6000;

type Light = {
	node: { props: Record<string, unknown> };
	neighbors: { buckets: { relation: string; direction: string; items: { key: string }[] }[] };
};

/**
 * What the server gives the first paint of the judgment `ecli` (its node `key`): as
 * api/seo/paint.py makes it, of the answers the reader and its band ask for themselves.
 */
export function judgmentPaint(ecli: string, key: string) {
	const detail = answer<Record<string, unknown> & { judgment: Record<string, unknown> }>(
		`/api/judgments/${encodeURIComponent(ecli)}`
	);
	const j = detail.judgment as Record<string, unknown> & {
		paragraphs: { paragraph_id: string; number?: string | null; text: string }[];
		footnotes?: { paragraph_id?: string | null }[];
		props?: Record<string, unknown>;
	};
	const kept: typeof j.paragraphs = [];
	let size = 0;
	for (const p of j.paragraphs) {
		if (size >= JUDGMENT_TEXT) break;
		kept.push({ ...p, citations: [] } as (typeof kept)[number]);
		size += p.text.length;
	}
	const ids = new Set(kept.map((p) => p.paragraph_id));
	const lightOf = (k: string) => answer<Light>(`/api/nodes/judgments/${k}?limit=1`);
	const earlier = (light: Light) =>
		light.neighbors.buckets.find((b) => b.relation === 'APPEAL_OF' && b.direction === 'outbound')
			?.items[0] ?? null;
	const light = lightOf(key);
	const chain = [];
	for (let step = earlier(light), i = 0; step && i < 3; i++) {
		step = earlier(lightOf(step.key));
		if (step) chain.push(step);
	}
	const { paragraphs, text, footnotes, sections, ...props } = j.props ?? {};
	void [paragraphs, text, footnotes, sections];
	return {
		kind: 'judgment',
		judgment: {
			...j,
			paragraphs: kept,
			footnotes: (j.footnotes ?? []).filter((n) => ids.has(n.paragraph_id ?? '')),
			props
		},
		whole: kept.length === j.paragraphs.length,
		numbers: [...new Set(j.paragraphs.flatMap((p) => (p.number ? [p.number] : [])))].sort(),
		same_as: detail.same_as ?? [],
		conclusions: detail.conclusions ?? [],
		completeness: detail.completeness ?? null,
		light: {
			node: {
				props: Object.fromEntries(
					BAND_PROPS.filter((name) => light.node.props[name]).map((name) => [
						name,
						light.node.props[name]
					])
				)
			},
			neighbors: { buckets: light.neighbors.buckets.filter((b) => BAND.includes(b.relation)) }
		},
		chain
	};
}

/** The articles of a law the paint sets (api/seo/paint.py's `_LAW_ARTICLES`). */
const LAW_ARTICLES = 12;

/**
 * What the server gives the first paint of the law `bwb` (its node `key`) on `day`: as
 * api/seo/paint.py makes it, of the answers its reader asks for its first page.
 */
export function lawPaint(bwb: string, key: string, day: string) {
	type Item = {
		article_number?: string | null;
		text?: string | null;
		text_preview?: string | null;
	};
	const listed = answer<{ total: number; annexes?: unknown[]; items: Item[] }>(
		`/api/instruments/${bwb}/articles?limit=100&offset=0&text_preview_chars=600`
	);
	const at = answer<{ items: (Item & Record<string, unknown>)[] }>(
		`/api/instruments/${bwb}/articles/at/${day}?include_text=true&limit=100&offset=0&text_preview_chars=0`
	);
	const light = answer<Light>(`/api/nodes/instruments/${key}?limit=1`);
	const texts = at.items.slice(0, LAW_ARTICLES).map((a) => ({
		article_number: a.article_number,
		text: a.text,
		parts: a.parts,
		tables: a.tables,
		headings: a.headings,
		footnote_marks: a.footnote_marks,
		footnotes: a.footnotes
	}));
	const withText = new Set(texts.filter((t) => t.text).map((t) => t.article_number));
	return {
		kind: 'law',
		bwb_id: bwb,
		instrument: answer(`/api/instruments/${bwb}`),
		total: listed.total,
		annexes: listed.annexes?.length ?? 0,
		articles: listed.items.slice(0, LAW_ARTICLES).map((a) => ({
			...a,
			text_preview: withText.has(a.article_number) ? null : a.text_preview
		})),
		texts,
		basis: [],
		light: {
			neighbors: {
				buckets: light.neighbors.buckets.filter(
					(b) => b.relation === 'LEGISLATED_IN' && b.direction === 'outbound'
				)
			}
		}
	};
}

/** The characters of a Kamerstuk's text the paint sets (api/seo/paint.py's `_PAPER_TEXT`). */
const PAPER_TEXT = 6000;

/**
 * What the server gives the first paint of the Kamerstuk `key`: as api/seo/paint.py makes it,
 * of the answers its reader and its band ask for themselves.
 */
export function paperPaint(key: string) {
	type Span = { char_start: number; char_end: number };
	const doc = answer<
		Record<string, unknown> & {
			text: string;
			paragraphs: (Span & { number?: number | null })[];
			sections: (Span & { id: string; heading: string })[];
			tables?: { start: number }[];
			footnotes?: { at?: number | null; section_id?: string | null }[];
		}
	>(`/api/documents/${key}`);
	const light = answer<Light & { node: { key: string; props: Record<string, unknown> } }>(
		`/api/nodes/documents/${key}?limit=1`
	);
	const end = doc.paragraphs.find((p) => p.char_end >= PAPER_TEXT)?.char_end;
	const cut = end ?? doc.text.length;
	const sections = doc.sections.filter((s) => s.char_start < cut);
	const closed = new Set(sections.filter((s) => s.char_end <= cut).map((s) => s.id));
	const lines = new Set(
		doc.text
			.slice(0, cut)
			.split('\n')
			.map((l) => l.trim().toLowerCase())
	);
	return {
		kind: 'paper',
		whole: cut === doc.text.length,
		section_count: doc.sections.length,
		headings: [
			...new Set(
				doc.sections
					.filter((s) => s.char_start >= cut)
					.map((s) => s.heading.trim().toLowerCase())
					.filter((h) => lines.has(h))
			)
		],
		numbers: [
			...new Set(doc.paragraphs.flatMap((p) => (p.number == null ? [] : [String(p.number)])))
		]
			.sort((a, b) => b.length - a.length || a.localeCompare(b))
			.slice(0, 20),
		document: {
			...doc,
			text: doc.text.slice(0, cut),
			paragraphs: doc.paragraphs.filter((p) => p.char_end <= cut),
			sections,
			tables: (doc.tables ?? []).filter((t) => t.start < cut),
			footnotes: (doc.footnotes ?? []).filter((f) =>
				f.at == null ? closed.has(f.section_id ?? '') : f.at < cut
			)
		},
		light: {
			node: {
				key: light.node.key,
				props: Object.fromEntries(
					['session_year', 'dossier_number', 'dossier_suffix', 'kind', 'chamber']
						.filter((name) => light.node.props[name])
						.map((name) => [name, light.node.props[name]])
				)
			},
			neighbors: {
				buckets: light.neighbors.buckets.filter((b) =>
					['PART_OF', 'MADE_IN', 'ACCOMPANIES'].includes(b.relation)
				)
			}
		}
	};
}

/** Serves `path` as the server does: the shell with its content, the bron for the paint and
 *  the paint's script of its kind, the node in its head. */
export async function serveFirstPaint(
	page: Page,
	path: string,
	focus: string,
	paint: { kind: string }
) {
	const script = readFileSync(`build/first-paint-${paint.kind}.js`, 'utf8');
	const data = JSON.stringify(paint).replace(/<\//g, '<\\/');
	await page.route(
		(url) => url.pathname === new URL(path, 'http://x').pathname,
		async (route) => {
			const response = await route.fetch();
			// Replaced by a function: the script's own `$` are no patterns of replace.
			const html = (await response.text())
				.replace('</head>', () => `<meta name="focus" content="${focus}" data-seo /></head>`)
				.replace(
					'<div style="display: contents">',
					() =>
						'<main id="seo"><h1>Bron</h1></main>' +
						`<script type="application/json" id="first-paint-data">${data}</script>` +
						`<script>${script}</script><div style="display: contents">`
				);
			await route.fulfill({ response, body: html });
		}
	);
}

/** Where the title and every block of the text stand in the paint (`paint`) or in the app's
 *  reader, in the page: of a judgment the summary, the parties and each item of its body. */
export const positions = (paint: boolean) => {
	const ev = document.getElementById('first-paint');
	const root = paint
		? ev
		: [...document.querySelectorAll('.col--reader')].find((c) => !ev?.contains(c));
	return root
		? [
				...root.querySelectorAll(
					'.reader-title, .article-text > div, .reader-summary-block, .reader-parties, .reader-body > :not([aria-hidden]), .whole-section, .whole-article, .r-document > .body > :not([aria-hidden])'
				)
			].map((e) => {
				const r = e.getBoundingClientRect();
				return [r.x, r.y, r.width, r.height].map((n) => Math.round(n));
			})
		: null;
};
