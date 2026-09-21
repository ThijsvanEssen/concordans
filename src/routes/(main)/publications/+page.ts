import type { PageLoad } from './$types';
import { api, unwrap } from '$lib/api/client';

// The maximum the API returns; it has no offset, so narrowing by filter is the only way to see more.
const LIMIT = 1000;

export const load: PageLoad = async ({ url }) => {
	const q = url.searchParams.get('q') ?? '';
	const kind = url.searchParams.get('kind') ?? '';
	const chamber = url.searchParams.get('chamber') ?? '';
	try {
		const { items } = await unwrap(
			api.GET('/api/documents', {
				params: {
					query: {
						q: q || undefined,
						kind: kind || undefined,
						chamber: chamber || undefined,
						limit: LIMIT
					}
				}
			})
		);
		return { documents: items, q, kind, chamber, limit: LIMIT, error: null };
	} catch {
		return {
			documents: [],
			q,
			kind,
			chamber,
			limit: LIMIT,
			error: 'Documenten konden niet worden geladen.'
		};
	}
};
