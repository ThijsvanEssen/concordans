// The menus of the bundels that change what they hold: Meer › Toevoegen aan … on a shared
// bundel's page, and the ⋯ of a bundel from a file. Their list of bundels takes the focus, so
// Escape closes it, and the menu opens again on its own items (UX-toets A14 #1).
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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
	aantekeningen: [],
	skipped: 0
};

const items = () => screen.getAllByRole('menuitem').map((b) => b.textContent);
const settle = async () => {
	await tick();
	await new Promise((r) => setTimeout(r));
	await tick();
};

afterEach(() => cleanup());

// The components compile on their first import: under load that took longer than one test's
// time. Compiled once here, with time of its own, each test finds them in the module cache.
beforeAll(async () => {
	await Promise.all([
		import('./MapView.svelte'),
		import('../../routes/(main)/bundels/+page.svelte'),
		import('./file'),
		import('./map.svelte'),
		import('./Bewaar.svelte'),
		import('./AddSource.svelte')
	]);
}, 60_000);

describe('Meer › Toevoegen aan … on a shared bundel', () => {
	it('puts the focus on the first bundel, closes on Escape and opens again on its items', async () => {
		const { default: MapView } = await import('./MapView.svelte');
		const onShared = vi.fn();
		render(MapView, { shared, onShared });
		const meer = screen.getByRole('button', { name: /^Meer bij Thuiswerk/ });
		await fireEvent.click(meer);
		await settle();
		await fireEvent.click(screen.getByRole('menuitem', { name: 'Toevoegen aan …' }));
		await settle();
		expect(items()).toEqual(['Losse markeringen']);
		expect(document.activeElement?.textContent).toBe('Losse markeringen');
		await fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
		await settle();
		expect(screen.queryByRole('menu')).toBeNull();
		await fireEvent.click(meer);
		await settle();
		expect(items()).toContain('Niet bewaren');
		expect(items()).toContain('Toevoegen aan …');
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
		await fireEvent.click(screen.getByRole('menuitem', { name: 'Toevoegen aan …' }));
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

describe('a reader keeping in a bundel (UX-toets A21 #1)', () => {
	it('says so on Bewaar, with the way back and Klaar, and keeps there until it ends', async () => {
		const { kaart } = await import('./map.svelte');
		const { default: Bewaar } = await import('./Bewaar.svelte');
		const other = kaart.nieuw('Thuiswerk');
		const art: MapItem = { ...lid, id: 'articles/bwbr0005290_611', at: '', kort: 'art. 7:611 BW' };
		kaart.keepIn(other.id);
		render(Bewaar, { item: art });
		await fireEvent.click(screen.getByRole('button', { name: /^Bewaar in Thuiswerk/ }));
		expect(kaart.holding(art).map((m) => m.naam)).toEqual(['Thuiswerk']);
		expect(screen.getByRole('button', { name: /^Bewaard in Thuiswerk/ })).toBeTruthy();
		expect(screen.getByRole('link', { name: 'Naar Thuiswerk' }).getAttribute('href')).toBe(
			`/bundels/${other.id}`
		);
		await fireEvent.click(screen.getByRole('button', { name: 'Klaar met bewaren in Thuiswerk' }));
		await settle();
		expect(kaart.keeping).toBeNull();
		expect(screen.queryByRole('link', { name: 'Naar Thuiswerk' })).toBeNull();
	});
});

describe('Klaar beside Bewaar in a bundel', () => {
	it('ends the keeping in the bundel and gives the focus back to Bewaar (UX-toets A27 #5)', async () => {
		const { default: Bewaar } = await import('./Bewaar.svelte');
		const { kaart } = await import('./map.svelte');
		const bundel = kaart.nieuw('Onrechtmatige overheidsdaad');
		kaart.keepIn(bundel.id);
		render(Bewaar, { item: lid });
		await settle();
		await fireEvent.click(screen.getByLabelText(/^Klaar met bewaren in/));
		await settle();
		expect(screen.queryByText('Klaar')).toBeNull();
		expect(document.activeElement).toBe(screen.getByRole('button', { pressed: false }));
	});
});
