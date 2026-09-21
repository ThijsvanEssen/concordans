import type { PageLoad } from './$types';
import { getPublicationText } from '$lib/api/mvt';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ params }) => {
	const { key } = params;

	try {
		const publication = await getPublicationText(key);
		return { publication };
	} catch {
		error(404, `Publicatie '${key}' niet gevonden.`);
	}
};
