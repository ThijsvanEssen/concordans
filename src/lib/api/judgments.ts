import { api, unwrap } from './client';

export const getJudgmentDetail = (ecli: string) =>
	unwrap(api.GET('/api/judgments/{ecli}', { params: { path: { ecli } } }));
