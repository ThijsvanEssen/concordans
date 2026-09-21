import { error, redirect } from '@sveltejs/kit';
import { isCollection } from '$lib/vocabulary';
import type { RequestHandler } from './$types';

// /nodes/{collection}/{key} is the address of a source in the API; the explorer shows it.
export const GET: RequestHandler = ({ params }) => {
	const { collection, key } = params;
	if (!isCollection(collection)) error(404, `Onbekende collectie: ${collection}`);
	redirect(302, `/explore?mode=split&focus=${encodeURIComponent(`${collection}/${key}`)}`);
};
