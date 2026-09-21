import type { PageLoad } from './$types';
import { listPublications } from '$lib/api/mvt';

const INITIAL_LIMIT = 1000;

export const load: PageLoad = async () => {
	try {
		const data = await listPublications({ limit: INITIAL_LIMIT });
		return {
			publications: data.items,
			total: data.total,
			initialLimit: INITIAL_LIMIT,
			error: null
		};
	} catch {
		return {
			publications: [],
			total: 0,
			initialLimit: INITIAL_LIMIT,
			error: 'Publicaties konden niet worden geladen.'
		};
	}
};
