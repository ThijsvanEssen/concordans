import { api, unwrap } from './client';

// The reader and the panel Verbonden mount together and want the same judgment.
const inflight = new Map<string, ReturnType<typeof fetchJudgment>>();

const fetchJudgment = (ecli: string) =>
	unwrap(api.GET('/api/judgments/{ecli}', { params: { path: { ecli } } }));

export function getJudgmentDetail(ecli: string) {
	let request = inflight.get(ecli);
	if (!request) {
		request = fetchJudgment(ecli).finally(() => inflight.delete(ecli));
		inflight.set(ecli, request);
	}
	return request;
}
