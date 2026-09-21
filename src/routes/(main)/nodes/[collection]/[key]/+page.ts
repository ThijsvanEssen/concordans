import type { PageLoad } from './$types';
import { getNodeGraph } from '$lib/api/nodes';
import { redirect } from '@sveltejs/kit';

export const load: PageLoad = async ({ params }) => {
	const { collection, key } = params;

	const nodeGraph = await getNodeGraph(collection, key);

	if (collection === 'instrument_articles') {
		redirect(302, `/explore?mode=split&focus=${encodeURIComponent(`${collection}/${key}`)}`);
	}

	if (collection === 'judgments') {
		redirect(302, `/explore?mode=split&focus=${encodeURIComponent(`${collection}/${key}`)}`);
	}

	return { nodeGraph };
};
