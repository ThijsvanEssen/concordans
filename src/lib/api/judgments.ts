import { api, unwrap } from './client';
import { once } from './records';

// The reader and the panel Verbonden mount together and want the same judgment.
export const getJudgmentDetail = (ecli: string) =>
	once(`judgments/${ecli}`, () =>
		unwrap(api.GET('/api/judgments/{ecli}', { params: { path: { ecli } } }))
	);
