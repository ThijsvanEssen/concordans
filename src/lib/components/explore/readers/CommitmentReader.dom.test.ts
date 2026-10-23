// Where a toezegging belongs, as the API gives it since #888 (`basis`): TZ202603-117 is about
// dossier 29389, where the letter that fulfils it stands; TZ202603-106, still open, only has
// the eight dossiers on the agenda of its debate, which are not its dossier.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { fakeApi } from '$lib/test/fakeApi';
import type { GraphNode } from '$lib/graph/types';
import NAKOMING from '$lib/fixtures/commitments/TZ202603-117.json';
import AGENDA from '$lib/fixtures/commitments/TZ202603-106.json';
import CommitmentReader from './CommitmentReader.svelte';
import ToezeggingInhoud from '$lib/components/open/ToezeggingInhoud.svelte';

vi.mock('$app/state', async () => (await import('$lib/test/navigation.svelte')).appState);
vi.mock('$app/navigation', async () => (await import('$lib/test/navigation.svelte')).appNavigation);

const node = (key: string) =>
	({ id: `commitments/${key}`, key, collection: 'commitments', label: '', raw: null }) as never;

/** Without a basis, as the live API gave it before #888. */
const withoutBasis = {
	...AGENDA,
	dossiers: AGENDA.dossiers.map(({ basis: _, ...d }) => d)
};

const read = async (answer: Record<string, unknown>) => {
	fakeApi({ '/api/commitments/{key}': answer, '/api/cabinets': [] });
	const { container } = render(CommitmentReader, { node: node('k') as GraphNode });
	await screen.findByText(/Toegezegd in/);
	const fields = [...container.querySelectorAll('dt')].map((dt) => [
		dt.textContent?.trim(),
		dt.nextElementSibling as HTMLElement
	]);
	return Object.fromEntries(fields) as Record<string, HTMLElement | undefined>;
};

describe('the dossier of a toezegging in its reader', () => {
	it('names the dossier of the letter that fulfils it as its dossier', async () => {
		const v = await read(NAKOMING);
		expect(v.Dossier?.textContent?.trim()).toBe('29389 Vergrijzing en het integrale ouderenbeleid');
		expect(v.Besproken).toBeUndefined();
	});

	it('names the agenda of its debate under Besproken, never as its dossier', async () => {
		const v = await read(AGENDA);
		expect(v.Dossier).toBeUndefined();
		expect(v.Dossiers).toBeUndefined();
		const line = v.Besproken?.querySelector('span > span');
		expect(line?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
			'in het debat over Staat van de Volkshuisvesting'
		);
		expect(line?.querySelector('a')?.textContent).toBe('Staat van de Volkshuisvesting');
		expect(v.Besproken?.querySelectorAll('.agenda a')).toHaveLength(8);
	});

	it('reads as before where the API gives no basis', async () => {
		const v = await read(withoutBasis);
		expect(v.Dossiers?.querySelectorAll('a')).toHaveLength(8);
		expect(v.Besproken).toBeUndefined();
	});
});

describe('the days of a toezegging (B34)', () => {
	// The debate on 14 October, the Kamer registered it on 21 October.
	const registered = (v: Record<string, HTMLElement | undefined>) =>
		v.Geregistreerd?.textContent?.trim();

	it('reads Geregistreerd from registered_on, `date` being the day of the debate', async () => {
		const v = await read({ ...NAKOMING, date: '2026-10-14', registered_on: '2026-10-21' });
		expect(registered(v)).toBe('21 oktober 2026');
	});

	it('has no Geregistreerd where the Kamer named no day', async () => {
		const v = await read({ ...NAKOMING, date: '2026-10-14', registered_on: null });
		expect(v.Geregistreerd).toBeUndefined();
	});

	it('still reads the registration from `date` on an API before registered_on', async () => {
		const { registered_on: _, ...legacy } = {
			...NAKOMING,
			registered_on: null,
			date: '2026-10-21'
		};
		const v = await read(legacy);
		expect(registered(v)).toBe('21 oktober 2026');
	});
});

describe('the dossier of a toezegging opened in place', () => {
	const openInPlace = (toezegging: object) => {
		fakeApi({});
		render(ToezeggingInhoud, { toezegging: toezegging as never });
	};

	it('links the dossier of the letter that fulfils it among its facts', () => {
		openInPlace(NAKOMING);
		expect(screen.getByRole('link', { name: /Dossier 29389/ })).toBeTruthy();
		expect(screen.queryByText(/Besproken/)).toBeNull();
	});

	it('names the debate and its agenda under their own line', () => {
		openInPlace(AGENDA);
		const line = screen.getByText(/Besproken in het debat over/);
		expect(line.textContent?.replace(/\s+/g, ' ').trim()).toBe(
			'Besproken in het debat over Staat van de Volkshuisvesting'
		);
		expect(line.querySelector('a')?.textContent).toBe('Staat van de Volkshuisvesting');
		const agenda = line.parentElement?.querySelector('.agenda');
		expect(agenda?.querySelectorAll('a')).toHaveLength(8);
	});

	it('lists every dossier among its facts where the API gives no basis', () => {
		openInPlace(withoutBasis);
		expect(screen.queryByText(/Besproken/)).toBeNull();
		expect(screen.getAllByRole('link', { name: /Dossier/ })).toHaveLength(8);
	});
});
