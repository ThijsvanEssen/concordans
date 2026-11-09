import { api, unwrap } from './client';
import { once } from './records';

// The reader and the panel Verbonden mount together and want the same judgment.
export const getJudgmentDetail = (ecli: string) =>
	once(`judgments/${ecli}`, () =>
		unwrap(api.GET('/api/judgments/{ecli}', { params: { path: { ecli } } }))
	);

/** The course of the case of a judgment (Verloop): the band's line and its list, one answer. */
export const getJudgmentCourse = (ecli: string) =>
	once(`judgments/${ecli}/course`, () =>
		unwrap(api.GET('/api/judgments/{ecli}/course', { params: { path: { ecli } } }))
	);

/** The route of a case per area of law and the Bevoegdheidsregeling (Rechtsgang), one answer. */
export const getJudgmentRoutes = () =>
	once('judgments/routes', () => unwrap(api.GET('/api/judgments/routes')));
