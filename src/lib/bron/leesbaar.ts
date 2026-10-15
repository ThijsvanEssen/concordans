// The resolver of a readable address (its grammar is in ./pad): the focus an address names,
// asked of the API where the address does not say it, with what the reader will want next
// asked beside it.
import { lookup } from '$lib/api/search';
import { ifExists, ignore } from '$lib/api/errors';
import { getArticleDetail, getArticleHistory, onthoudArtikel } from '$lib/api/articles';
import { lawArticleList } from '$lib/api/law-articles';
import { getDocument, getDossierDocuments, getExplainedBy } from '$lib/api/records';
import { wordingsOf } from '$lib/text/version-diff';
import { apiNumber } from '$lib/text/bw';
import { parseNodeId } from '$lib/vocabulary';
import { onForget } from '$lib/util/forget';
import { focusOfPad, keptFocus, lookupQuery, padHref, remember, type Pad } from './address';
// Who resolves an address keeps the ones the API gives (in the app, src/hooks.ts already does).
import './kept-paths';

// The focus the server gave the page, with the address it gave it for: read once, used
// once. After a step in the app location.pathname is the new address while the meta still
// names the first page's bron (UX test 0.79.43, #28: HR 2019:2006, then a Kamerstuk, showed
// the judgment until a reload). The address is the document's own (its navigation entry),
// not the one of the moment.
let paginaFocus: { href: string; focus: string } | null | undefined;
onForget(() => {
	paginaFocus = undefined;
});
function readPageFocus(): { href: string; focus: string } | null {
	const meta = document.querySelector('meta[name="focus"]');
	const focus = meta?.getAttribute('content') ?? null;
	meta?.remove();
	if (!focus || !parseNodeId(focus)) return null;
	const nav = performance.getEntriesByType?.('navigation')[0] as
		| PerformanceNavigationTiming
		| undefined;
	return { href: new URL(nav?.name || location.href).pathname, focus };
}

/**
 * The focus the server's page names (`<meta name="focus" content="documents/…">`, API
 * 0.79.43, #502): after the 301 from /explore?focus=… the key is no longer in the address,
 * and the page says it without a request (cold, the lookup took 1.8 s). Only for the address
 * the page was served for.
 */
export function focusUitPagina(pad: Pad): string | null {
	if (typeof document === 'undefined') return null;
	if (paginaFocus === undefined) paginaFocus = readPageFocus();
	const href = padHref(pad);
	if (!paginaFocus || paginaFocus.href !== href) return null;
	const { focus } = paginaFocus;
	paginaFocus = null;
	remember(href, focus);
	const target = parseNodeId(focus)!;
	// What the lookup would have set going: a Kamerstuk's text beside its node.
	if (target.collection === 'documents') askDocumentAhead(target.key);
	return focus;
}

/** An article's address as the API numbers it (162 for BW 6:162); null for another bron. */
const apiArticle = (pad: Pad) =>
	pad.soort === 'artikel'
		? { wet: pad.wet.toUpperCase(), nummer: apiNumber(pad.wet, pad.nummer) }
		: null;

/**
 * An article's text, asked as soon as its address is known, beside the lookup and the node,
 * so the reader finds it waiting (once() shares the request; Thijs, 10 Oct: lazy, the text
 * first). The text names the article's node key too: where it comes before the lookup, the
 * reader stands on it at once ($lib/bron/first-node). Its tekstversies date the status line ("tekst
 * sinds …"), the list of its law gives the place line and Vorig, Volgend, its explanations the
 * line of the memorie: asked with it, so the head does not grow over the text when they come.
 * By the API's own number (162 for BW 6:162), as the reader asks them. Nobody waits for these:
 * the reader asks again, and a failure is its to say.
 */
function askArticleAhead(pad: Pad, artikel: { wet: string; nummer: string }) {
	getArticleDetail(artikel.wet, artikel.nummer)
		.then((d) => {
			const href = padHref(pad);
			if (d.article?.id && !keptFocus(href)) remember(href, d.article.id);
		})
		.catch(ignore('leesbaar'));
	// Where no EXPLAINS edge names its memorie, the reader looks in the dossier of the wet
	// that gave its text in force: asked as soon as the tekstversies name it.
	getArticleHistory(artikel.wet, artikel.nummer)
		.then((h) => {
			const w = wordingsOf(h.versions ?? []).at(-1);
			const dossier = w && w.until === null ? w.first.amended_by?.dossiers?.[0]?.number : null;
			if (dossier) getDossierDocuments(dossier).catch(ignore('leesbaar'));
		})
		.catch(ignore('leesbaar'));
	lawArticleList(artikel.wet).catch(ignore('leesbaar'));
	getExplainedBy(artikel.wet, artikel.nummer).catch(ignore('leesbaar'));
}

/**
 * A Kamerstuk's text, asked as soon as its key is known, beside its node, not after it (live,
 * 10 Oct: the reader asked it only once the light node was in). The reader asks again.
 */
function askDocumentAhead(key: string) {
	getDocument(key).catch(ignore('leesbaar'));
}

/**
 * The focus of an address that needs the API, by /api/lookup: exact or nothing. A
 * Kamerstuk that is not in the data does not open its dossier instead. Null when the
 * data lacks it (404 `not_in_data`); another failure is thrown, to be said as such.
 */
export async function lookUp(pad: Pad, signal?: AbortSignal): Promise<string | null> {
	const artikel = apiArticle(pad);
	if (artikel) askArticleAhead(pad, artikel);
	const known = focusOfPad(pad) ?? focusUitPagina(pad);
	if (known) {
		const target = parseNodeId(known);
		if (artikel && target) onthoudArtikel(target.key, artikel.wet, artikel.nummer);
		return known;
	}
	return lookUpInData(pad, signal);
}

/**
 * The focus of an address as the data has it, always by /api/lookup: also where
 * `focusOfPad` would name it unasked (a dossier), for whoever must know it exists.
 */
async function lookUpInData(pad: Pad, signal?: AbortSignal): Promise<string | null> {
	const artikel = apiArticle(pad);
	const query = lookupQuery(pad);
	if (!query) return null;
	const data = await ifExists(lookup(query, signal));
	if (!data) return null;
	const focus = `${data.collection}/${data.key}`;
	if (data.collection === 'documents') askDocumentAhead(data.key);
	// The reader stands on the article's detail, asked above, while its node is on its way.
	if (artikel) onthoudArtikel(data.key, artikel.wet, artikel.nummer);
	remember(padHref(pad), focus);
	return focus;
}
