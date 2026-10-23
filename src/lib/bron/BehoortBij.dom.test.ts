import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { fail, fakeApi, type FakeRequest } from '$lib/test/fakeApi';
import BehoortBij from './BehoortBij.svelte';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }));

const UITSPRAAK = 'ecli_nl_hr_2019_2006';
const HOF = 'ecli_nl_ghdha_2018_2591';

/** The light node of the Hoge Raad's judgment: its eerdere aanleg, the Hof. */
const licht = {
	node: { labels: [], props: {} },
	neighbors: {
		total: 1,
		buckets: [
			{
				relation: 'APPEAL_OF',
				direction: 'outbound',
				collection: 'judgments',
				total: 1,
				items: [
					{
						key: HOF,
						collection: 'judgments',
						display_name: 'Gerechtshof Den Haag, 9\u00a0oktober\u00a02018',
						relation: 'APPEAL_OF',
						direction: 'outbound'
					}
				]
			}
		]
	}
};

const node = { id: `judgments/${UITSPRAAK}`, collection: 'judgments', key: UITSPRAAK } as never;

/** The light nodes: the judgment's own, and the Hof's as `hof` answers it. */
const nodes = (hof: unknown) => (r: FakeRequest) =>
	String(r.params.path?.key).toLowerCase() === UITSPRAAK ? licht : hof;

beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('BehoortBij', () => {
	it('marks a line onvolledig when what it asks after the light node fails', async () => {
		const { asked } = fakeApi({ '/api/nodes/{collection}/{key}': nodes(fail(500)) });
		render(BehoortBij, { node });
		const regel = await screen.findByText('Procesgang');
		expect(asked('/api/nodes/{collection}/{key}').map((p) => p.path?.key)).toContain(HOF);
		expect(regel.closest('.regel')?.textContent).toContain('deze uitspraak');
		expect(screen.getByText('onvolledig')).toBeTruthy();
	});

	it('marks nothing when the line has come in full', async () => {
		const hof = { node: { labels: [], props: {} }, neighbors: { total: 0, buckets: [] } };
		fakeApi({ '/api/nodes/{collection}/{key}': nodes(hof) });
		render(BehoortBij, { node });
		await screen.findByText('Procesgang');
		expect(screen.queryByText('onvolledig')).toBeNull();
	});
});
