// The first paint of a reader's address (src/lib/first-paint) in the suite: the page as the
// server gives it, with the bron as the API's /render puts it in (api/seo/paint.py), made here
// of the recorded answers of the API the paint's fields come from, and the build's own
// script (build/first-paint.js). Then the paint and the app that takes it over can be held
// side by side.
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

/** Serves `path` as the server does: the shell with its content, the bron for the paint and
 *  the paint's script, the node in its head. */
export async function serveFirstPaint(page: Page, path: string, focus: string, paint: object) {
	const script = readFileSync('build/first-paint.js', 'utf8');
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
						'<main id="seo"><h1>Artikel</h1></main>' +
						`<script type="application/json" id="first-paint-data">${data}</script>` +
						`<script>${script}</script><div style="display: contents">`
				);
			await route.fulfill({ response, body: html });
		}
	);
}

/** Where the title and every block of the text stand in the paint (`paint`) or in the app's
 *  reader, in the page. */
export const positions = (paint: boolean) => {
	const ev = document.getElementById('first-paint');
	const root = paint
		? ev
		: [...document.querySelectorAll('.col--reader')].find((c) => !ev?.contains(c));
	return root
		? [...root.querySelectorAll('.reader-title, .article-text > div')].map((e) => {
				const r = e.getBoundingClientRect();
				return [r.x, r.y, r.width, r.height].map((n) => Math.round(n));
			})
		: null;
};
