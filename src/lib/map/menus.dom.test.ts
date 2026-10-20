// The menus of the bundels that change what they hold: Meer › Voeg toe aan … on a shared
// bundel's page, and the ⋯ of a bundel from a file. Their list of bundels takes the focus, so
// Escape closes it, and the menu opens again on its own items (UX-toets A14 #1).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import type { MapItem } from './map';

vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/bundels'), params: {}, route: { id: '/(main)/bundels' } }
}));
vi.mock('$app/navigation', () => ({ goto: vi.fn(() => Promise.resolve()) }));

const lid: MapItem = {
	id: 'articles/bwbr0005290_658',
	at: 'lid-1',
	kort: 'art. 7:658 lid 1 BW',
	groep: 'Burgerlijk Wetboek Boek 7',
	groupKey: 'wet:bwbr0005290'
};
const shared = {
	naam: 'Thuiswerk',
	items: [lid],
	volgorde: 'groep' as const,
	notitie: null,
	groepNotities: {},
	skipped: 0
};

const items = () => screen.getAllByRole('menuitem').map((b) => b.textContent);
const settle = async () => {
	await tick();
	await new Promise((r) => setTimeout(r));
	await tick();
};

afterEach(() => cleanup());

describe('Meer › Voeg toe aan … on a shared bundel', () => {
	it('puts the focus on the first bundel, closes on Escape and opens again on its items', async () => {
		const { default: MapView } = await import('./MapView.svelte');
		const onShared = vi.fn();
		render(MapView, { shared, onShared });
		const meer = screen.getByRole('button', { name: /^Meer bij Thuiswerk/ });
		await fireEvent.click(meer);
		await settle();
		await fireEvent.click(screen.getByRole('menuitem', { name: 'Voeg toe aan …' }));
		await settle();
		expect(items()).toEqual(['Losse markeringen']);
		expect(document.activeElement?.textContent).toBe('Losse markeringen');
		await fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
		await settle();
		expect(screen.queryByRole('menu')).toBeNull();
		await fireEvent.click(meer);
		await settle();
		expect(items()).toContain('Niet bewaren');
		expect(items()).toContain('Voeg toe aan …');
	});
});

describe('the ⋯ of a bundel from a file', () => {
	it('lists the bundels in place of its items, and goes back once it closes', async () => {
		const { default: Page } = await import('../../routes/(main)/bundels/+page.svelte');
		const { mapFile } = await import('./file');
		const { container } = render(Page);
		const input = container.querySelector<HTMLInputElement>('input[type=file]')!;
		const text = mapFile([{ ...shared, id: 'elders', gewijzigd: '2026-10-20T10:00:00Z' }]);
		const file = new File([text], 'Thuiswerk.json', { type: 'application/json' });
		Object.defineProperty(input, 'files', { value: [file] });
		await fireEvent.change(input);
		await settle();
		const dots = screen.getByRole('button', { name: 'Thuiswerk: meer' });
		await fireEvent.click(dots);
		await settle();
		await fireEvent.click(screen.getByRole('menuitem', { name: 'Voeg toe aan …' }));
		await settle();
		expect(document.activeElement?.textContent).toBe('Losse markeringen');
		await fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
		await settle();
		expect(screen.queryByRole('menu')).toBeNull();
		await fireEvent.click(dots);
		await settle();
		expect(items()).toContain('Niet openen');
	});
});

describe('Bewaard in a reader (the coordinator’s choice 1)', () => {
	it('opens the bundels with their ticks, and takes nothing out', async () => {
		const { kaart } = await import('./map.svelte');
		const { default: Bewaar } = await import('./Bewaar.svelte');
		kaart.keep(lid);
		render(Bewaar, { item: lid });
		const bewaard = screen.getByRole('button', { name: /Bewaard/ });
		await fireEvent.click(bewaard);
		await settle();
		expect(
			screen
				.getByRole('menuitemcheckbox', { name: 'Losse markeringen' })
				.getAttribute('aria-checked')
		).toBe('true');
		expect(kaart.heeft(lid)).toBe(true);
		// Out per bundel, by its tick.
		await fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Losse markeringen' }));
		expect(kaart.heeft(lid)).toBe(false);
	});
});

describe('Andere bron toevoegen on a bundel’s page (the coordinator’s choice 2)', () => {
	it('opens the reader of a recognized bron with the bundel to keep in', async () => {
		const { default: AddSource } = await import('./AddSource.svelte');
		render(AddSource, { bundle: 'k3j2', groups: [], onAdd: vi.fn(), onClose: vi.fn() });
		await fireEvent.input(screen.getByLabelText(/Citeervorm/), {
			target: { value: 'ECLI:NL:HR:2019:1715' }
		});
		await settle();
		const link = screen.getByRole('link', { name: 'Bewaar vanuit de lezer' });
		expect(new URL(link.getAttribute('href')!, 'https://x.nl').searchParams.get('bundel')).toBe(
			'k3j2'
		);
	});
});
