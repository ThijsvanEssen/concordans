// The judgment reader on a fixed judgment (Rb. Rotterdam, a herstelbeschikking with its
// connected case): the head, the first overweging, the Samenhangende zaken with their sentence
// and whose inhoudsindicatie it is, and the menu of an overweging.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { fakeApi } from '$lib/test/fakeApi';
import { open } from '$lib/test/navigation.svelte';
import type { GraphNode } from '$lib/graph/types';
import fixture from '$lib/test/judgment.json';
import partiesFixture from '$lib/test/judgment-parties.json';
import JudgmentReader from './JudgmentReader.svelte';
import { overwegingCitaat } from '$lib/text/judgment-cite';

vi.mock('$app/state', async () => (await import('$lib/test/navigation.svelte')).appState);
vi.mock('$app/navigation', async () => (await import('$lib/test/navigation.svelte')).appNavigation);

const { judgment } = fixture.detail;
const node: GraphNode = {
	id: judgment.id,
	collection: 'judgments',
	key: judgment.key,
	drawClass: 'judgment',
	label: judgment.display_name,
	raw: judgment as unknown as GraphNode['raw']
};

let api: ReturnType<typeof fakeApi>;
beforeEach(() => {
	open(`/uitspraken/${judgment.ecli}`);
	api = fakeApi({
		'/api/judgments/{ecli}': fixture.detail,
		'/api/nodes/{collection}/{key}': fixture.related
	});
});
afterEach(() => vi.restoreAllMocks());

async function settle() {
	for (let i = 0; i < 10; i++) {
		await new Promise((r) => setTimeout(r, 0));
		await tick();
	}
}

describe('JudgmentReader', () => {
	it('shows the head, the first overweging and the connected case with its sentences', async () => {
		const { container } = render(JudgmentReader, { node });
		await settle();
		expect(container.querySelector('h1, h2')?.textContent).toContain('Rb. Rotterdam');
		expect(screen.getByRole('button', { name: /^Overweging 2\.1:/ })).toBeTruthy();
		expect(container.textContent).toContain('De kantonrechter zal de beschikking verbeteren');
		// The section stands closed by default: its heading opens it.
		const sectie = screen.getByText('Samenhangende zaken').closest('section')!;
		await fireEvent.click(sectie.querySelector('button')!);
		await settle();
		const zinnen = [...container.querySelectorAll('.samenhang-zin')].map((z) => z.textContent);
		expect(zinnen).toEqual([
			'Zie ook ECLI:NL:RBROT:2026:11738 Inhoudsindicatie van deze uitspraak',
			'Zie ook ECLI:NL:RBROT:2026:12500 Inhoudsindicatie van die uitspraak'
		]);
	});

	it('asks the connected cases alone, in one bucket', async () => {
		render(JudgmentReader, { node });
		await settle();
		const asked = api.asked('/api/nodes/{collection}/{key}');
		expect(asked).toHaveLength(1);
		expect(asked[0].query).toMatchObject({
			relations: 'RELATED_TO',
			node_types: 'judgment',
			limit: 50
		});
		expect(asked[0].query?.direction).toBeUndefined();
	});

	it('opens the menu of an overweging from its number', async () => {
		render(JudgmentReader, { node });
		await settle();
		const nummer = screen.getByRole('button', { name: /^Overweging 2\.1:/ });
		await fireEvent.click(nummer);
		await settle();
		expect(nummer.getAttribute('aria-expanded')).toBe('true');
		expect(screen.getByRole('menu')).toBeTruthy();
	});

	it('closes the menu of an overweging without an error after a copy (F-anker)', async () => {
		const errors: unknown[] = [];
		const capture = (e: ErrorEvent) => {
			e.preventDefault();
			errors.push(e.error);
		};
		window.addEventListener('error', capture);
		render(JudgmentReader, { node });
		await settle();
		await fireEvent.click(screen.getByRole('button', { name: /^Overweging 2\.1:/ }));
		await settle();
		// A copy closes the menu after 600 ms; Escape closed it before.
		await fireEvent.click(screen.getByRole('menuitem', { name: 'Kopieer tekst' }));
		await fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
		await settle();
		expect(screen.queryByRole('menu')).toBeNull();
		await new Promise((r) => setTimeout(r, 700));
		window.removeEventListener('error', capture);
		expect(errors).toEqual([]);
	});

	it('cites each overweging as overwegingCitaat does, whatever overweging the address names', async () => {
		const kort = overwegingCitaat(judgment, '2.1', 'r-2.1', '', null)?.kort;
		expect(kort).toBeTruthy();
		open(`/uitspraken/${judgment.ecli}#r-2.2`);
		render(JudgmentReader, { node });
		await settle();
		await fireEvent.click(screen.getByRole('button', { name: /^Overweging 2\.1:/ }));
		await settle();
		expect(screen.getByRole('menu').getAttribute('aria-label')).toBe(kort);
	});
});

describe('the parties of a judgment', () => {
	it('writes a name and its alias apart, and who acts for a party under it (HR:2025:1319)', async () => {
		const detail = {
			...fixture.detail,
			judgment: { ...judgment, parties: partiesFixture['ECLI:NL:HR:2025:1319'] }
		};
		api = fakeApi({
			'/api/judgments/{ecli}': detail,
			'/api/nodes/{collection}/{key}': fixture.related
		});
		const { container } = render(JudgmentReader, { node });
		await settle();
		const text = (sel: string) => [...container.querySelectorAll(sel)].map((e) => e.textContent);
		expect(text('.reader-party')).toEqual([
			'COBRASPEN VASTGOED ONTWIKKELING B.V.',
			'STORM DUNE FILTERED WATER B.V. (Cobraspen c.s.)',
			'N.V. PWN WATERLEIDINGBEDRIJF NOORD-HOLLAND (PWN)',
			'STICHTING VOLKSSTERRENWACHT COPERNICUS'
		]);
		expect(text('.reader-parties-counsel')).toEqual([
			'R.T. Wiegerink, advocaat',
			'P.A. Fruytier, advocaat',
			'J.P. Jas, advocaat'
		]);
	});
});
