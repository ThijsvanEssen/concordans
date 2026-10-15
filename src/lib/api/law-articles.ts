// The articles of a law in order, each with its place in the law: one request per law,
// shared by the table of contents (LezenNav) and by the place line with Vorig and Volgend
// above an article, in Netwerk as in Tekst. The whole Awb is 584 articles, 16 kB gzipped
// (about 0.1 s on PostgreSQL); a route per division (BE-6) would make it smaller. Their
// labels and places: $lib/bron/law-articles.
import { api, unwrap } from './client';
import { volledig } from './limits';
import type { Schema } from './types';
import { onForget } from '$lib/util/forget';

/** The largest page the API gives: the whole list of a law in one request. */
const WHOLE_LIST = volledig('/api/instruments/{bwb_id}/articles');

const lists = new Map<string, Promise<Schema<'InstrumentArticlesResponse'>>>();
onForget(() => lists.clear());

/**
 * The list of a law as the API gives it, asked once per law: the table of contents, the
 * place line, the group in Verbonden and the whole-law reader share it. A failed request is
 * asked again next time.
 */
export function lawArticleList(bwb: string): Promise<Schema<'InstrumentArticlesResponse'>> {
	let request = lists.get(bwb);
	if (!request) {
		request = unwrap(
			api.GET('/api/instruments/{bwb_id}/articles', {
				params: { path: { bwb_id: bwb }, query: { text_preview_chars: 0, limit: WHOLE_LIST } }
			})
		);
		request.catch(() => lists.delete(bwb));
		lists.set(bwb, request);
	}
	return request;
}
