import type { PageLoad } from './$types';
import { api, unwrap } from '$lib/api/client';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ params }) => {
	try {
		return {
			document: await unwrap(
				api.GET('/api/documents/{key}', { params: { path: { key: params.key } } })
			)
		};
	} catch {
		error(404, `Document '${params.key}' niet gevonden.`);
	}
};
