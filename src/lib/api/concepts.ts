import { api, unwrap } from './client';
import { once } from './records';

/**
 * A concept kept by hand (the articles that make one doctrine, and what cites them), once
 * per session: the block under an article asks it, and so does the next article of the concept.
 */
export const getConcept = (key: string) =>
	once(`concepts/${key}`, () =>
		unwrap(api.GET('/api/concepts/{key}', { params: { path: { key } } }))
	);
