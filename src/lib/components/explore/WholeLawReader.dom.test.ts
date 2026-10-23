// The head of a law on what the dataset lacks of it (besluit 23): an act of the EU has its text
// as adopted only, on any day asked; a regeling without articles has no text read. One line of
// Dekking, never a claim of geldende tekst.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { fakeApi } from '$lib/test/fakeApi';
import { open } from '$lib/test/navigation.svelte';
import WholeLawReader from './WholeLawReader.svelte';

vi.mock('$app/state', async () => (await import('$lib/test/navigation.svelte')).appState);
vi.mock('$app/navigation', async () => (await import('$lib/test/navigation.svelte')).appNavigation);

const instrument = (o: Record<string, unknown>) => ({
	id: `instruments/${String(o.key)}`,
	celex: null,
	bwb_id: null,
	title: null,
	official_title: null,
	citation_title: null,
	short_title: null,
	abbreviation: null,
	display_name: null,
	kind: null,
	jurisdiction: 'nl',
	article_count: 0,
	inbound_citation_count: 0,
	date_signed: null,
	date_in_force: null,
	version_date_in_force: null,
	official_url: null,
	same_treaty: [],
	...o
});

const AVG = instrument({
	key: '32016r0679',
	celex: '32016R0679',
	citation_title: 'Verordening (EU) 2016/679',
	jurisdiction: 'eu',
	article_count: 99,
	date_signed: '2016-04-27',
	official_url: 'https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=CELEX:32016R0679'
});
const AFPAKKEN = instrument({
	key: 'bwbr0038996',
	bwb_id: 'BWBR0038996',
	title: 'Aanwijzing afpakken',
	kind: 'beleidsregel',
	date_in_force: '2017-01-01',
	official_url: 'https://wetten.overheid.nl/BWBR0038996'
});
const EMPTY = { total: 0, division: null, items: [] };

function routes(detail: Record<string, unknown>, versions: unknown[]) {
	fakeApi({
		'/api/instruments/{identifier}': detail,
		'/api/instruments/{bwb_id}/versions': { items: versions },
		'/api/instruments/{bwb_id}/articles': EMPTY,
		'/api/instruments/{bwb_id}/articles/at/{at_date}': EMPTY,
		'/api/instruments': { items: [] }
	});
}

async function settle() {
	for (let i = 0; i < 10; i++) {
		await new Promise((r) => setTimeout(r, 0));
		await tick();
	}
}

beforeEach(() => vi.useRealTimers());
afterEach(() => vi.restoreAllMocks());

describe('WholeLawReader, what the dataset lacks', () => {
	it('says of an act of the EU on a peildatum that its text is as adopted, never geldend', async () => {
		open('/wetten/32016R0679?peildatum=2015-01-01');
		routes(AVG, []);
		const { container } = render(WholeLawReader, { bwbId: '32016R0679' });
		await settle();
		const text = container.textContent ?? '';
		expect(text).not.toContain('geldende tekst in de gegevens');
		expect([...container.querySelectorAll('.dekking')].map((d) => d.textContent)).toEqual([
			'Tekst zoals vastgesteld op 27\u00a0april\u00a02016, latere wijzigingen niet verwerkt, EUR-Lex ↗'
		]);
	});

	it('says of a regeling without articles that its text was not read', async () => {
		open('/wetten/BWBR0038996');
		routes(AFPAKKEN, [{ key: 'v', valid_from: '2017-01-01', valid_until: null, current: true }]);
		const { container } = render(WholeLawReader, { bwbId: 'BWBR0038996' });
		await settle();
		expect([...container.querySelectorAll('.dekking')].map((d) => d.textContent)).toEqual([
			'Tekst niet in de gegevens, wetten.overheid.nl ↗'
		]);
		expect(container.textContent).not.toContain('Tekst geldend op');
	});
});

describe('WholeLawReader, whether the law holds (besluit 30)', () => {
	const successor = {
		id: 'instruments/bwbr0099',
		key: 'bwbr0099',
		bwb_id: 'BWBR0099',
		celex: null,
		official_id: null,
		title: 'Nieuwe wet',
		citation_title: 'Nieuwe wet',
		articles: 5,
		path: '/wetten/BWBR0099'
	};
	const versions = [
		{ key: 'v2', valid_from: '2015-01-01', valid_until: null, current: true },
		{ key: 'v1', valid_from: '2000-01-01', valid_until: '2015-01-01', current: false }
	];
	const law = (validity: unknown) =>
		instrument({
			key: 'bwbr0001',
			bwb_id: 'BWBR0001',
			title: 'Oude wet',
			kind: 'wet',
			article_count: 3,
			date_in_force: '2000-01-01',
			version_date_in_force: '2015-01-01',
			...(validity === 'absent' ? {} : { validity })
		});

	it('says vervallen with the successor and never Geldende tekst or today', async () => {
		open('/wetten/BWBR0001');
		routes(
			law({ state: 'expired', date: '2020-01-01', as_of: '2026-10-21', successors: [successor] }),
			versions
		);
		const { container } = render(WholeLawReader, { bwbId: 'BWBR0001' });
		await settle();
		const stand = container.querySelector('.validity')!;
		expect(stand.textContent?.replace(/\s+/g, ' ').trim()).toBe(
			'Vervallen per 1 januari 2020, opvolger: Nieuwe wet'
		);
		const text = container.textContent ?? '';
		expect(text).not.toContain('Geldende tekst');
		expect(text).not.toContain('Tekst geldend op');
		expect(text).toContain('Laatste tekst geldend sinds');
	});

	it('changes nothing on an API without validity', async () => {
		open('/wetten/BWBR0001');
		routes(law('absent'), versions);
		const { container } = render(WholeLawReader, { bwbId: 'BWBR0001' });
		await settle();
		expect(container.querySelector('.validity')).toBeNull();
		expect(container.textContent).toContain('Tekst geldend op');
	});
});
