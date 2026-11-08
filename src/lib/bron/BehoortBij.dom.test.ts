import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { fail, fakeApi } from '$lib/test/fakeApi';
import BehoortBij from './BehoortBij.svelte';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }));

const UITSPRAAK = 'ecli_nl_hr_2019_2006';
const ECLI = 'ECLI:NL:HR:2019:2006';

/** The light node of the Hoge Raad's judgment: its ECLI, which the band asks the course by. */
const licht = { node: { labels: [], props: { ecli: ECLI } }, neighbors: { total: 0, buckets: [] } };

const node = { id: `judgments/${UITSPRAAK}`, collection: 'judgments', key: UITSPRAAK } as never;

/** Its course: the Hof before it, this one. */
const step = (ecli: string, over: Record<string, unknown>) => ({
	ecli,
	key: ecli.toLowerCase().replaceAll(':', '_'),
	court_code: null,
	court_name: null,
	tier: null,
	court_kind: null,
	date: null,
	procedure: null,
	decision_kind: 'uitspraak',
	outcome: null,
	area: null,
	basis: null,
	loaded: true,
	current: false,
	links: [],
	...over
});
const course = {
	steps: [
		step('ECLI:NL:GHDHA:2018:2591', { court_name: 'Gerechtshof Den Haag', date: '2018-10-09' }),
		step(ECLI, { court_name: 'Hoge Raad', date: '2019-12-20', current: true })
	],
	unresolved: [],
	truncated: false
};

beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('BehoortBij', () => {
	it('marks a line onvolledig when what it asks after the light node fails', async () => {
		const { asked } = fakeApi({
			'/api/nodes/{collection}/{key}': licht,
			'/api/judgments/{ecli}/course': fail(500)
		});
		render(BehoortBij, { node });
		const regel = await screen.findByText('Verloop');
		expect(asked('/api/judgments/{ecli}/course').map((p) => p.path?.ecli)).toEqual([ECLI]);
		expect(regel.closest('.regel')?.textContent).toContain('deze uitspraak');
		expect(screen.getByText('onvolledig')).toBeTruthy();
	});

	it('names the instances when the course has come in full', async () => {
		fakeApi({ '/api/nodes/{collection}/{key}': licht, '/api/judgments/{ecli}/course': course });
		render(BehoortBij, { node });
		const naam = await screen.findByText('deze uitspraak');
		expect(naam.closest('.regel')?.textContent).toContain('Gerechtshof Den Haag');
		expect(screen.queryByText('onvolledig')).toBeNull();
	});
});
