// A dossier and what hangs under its number, each asked once: the reader and the panel
// Verbonden of one bron ask for the same lists ($lib/api/records `once`).
import { api, unwrap } from './client';
import { ifExists } from './errors';
import { once } from './records';
import type { Schema } from './types';

export const getDossier = (number: string) =>
	once(`dossier/${number}`, () =>
		unwrap(api.GET('/api/dossiers/{number}', { params: { path: { number } } }))
	);

/**
 * The node key of a dossier by its number (`37020-XV` → `37020_xv`), from the list: 0.2 s,
 * where the dossier's detail can take 5 s (36496 on prod, 9 Oct) and everything after it
 * waited. The detail where the list does not know the number.
 */
export const getDossierKey = (number: string) =>
	once(`dossier-key/${number}`, async () => {
		const found = await unwrap(
			api.GET('/api/dossiers', { params: { query: { number, limit: 5 } } })
		).catch(() => null);
		const exact = found?.items.find((d) => d.number?.toLowerCase() === number.toLowerCase());
		return exact?.key ?? (await getDossier(number)).key;
	});

export const getDossierMutations = (number: string) =>
	once(`mutations/${number}`, () =>
		unwrap(api.GET('/api/dossiers/{number}/mutations', { params: { path: { number } } }))
	);

/**
 * The articles a bill changes, per law (API 0.74.0), or null where the API knows no such
 * dossier (404).
 */
export const getChangedArticles = (
	number: string
): Promise<Schema<'DossierChangedArticlesResponse'> | null> =>
	once(`dossiers/${number}/changed-articles`, () =>
		ifExists(
			unwrap(api.GET('/api/dossiers/{number}/changed-articles', { params: { path: { number } } }))
		)
	);

/** Its amendments as chains of papers with their decision (API 0.79.60). */
export const getDossierAmendments = (number: string) =>
	once(`dossiers/${number}/amendments`, () =>
		unwrap(api.GET('/api/dossiers/{number}/amendments', { params: { path: { number } } }))
	);
