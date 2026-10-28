// The card of a bron with a lopend voorstel names its dossier and voorstel and offers "Aan het
// netwerk toevoegen" (besluit 37); a voorstel already in the netwerk says so.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import OpenChanges from './OpenChanges.svelte';

const dossiers = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/overlays', () => ({ getInFluxDossiers: dossiers }));

const ID = 'articles/bwbr0001827_17';
const answer = (over = {}) =>
	new Map([
		[
			ID,
			[
				{
					id: 'dossiers/33723',
					dossier_number: '33723',
					title: 'Wet bevordering van mediation',
					bill_id: 'documents/16bc127f_3cdf',
					closed_known: false,
					count: 2,
					...over
				}
			]
		]
	]);

async function settle() {
	for (let i = 0; i < 10; i++) {
		await new Promise((r) => setTimeout(r, 0));
		await tick();
	}
}

describe('OpenChanges', () => {
	it('names the dossier, its voorstel and the open changes; adds the voorstel to the netwerk', async () => {
		dossiers.mockResolvedValueOnce(answer());
		const onAdd = vi.fn();
		render(OpenChanges, { id: ID, onAdd });
		await settle();
		expect(dossiers).toHaveBeenCalledWith([ID], expect.anything());
		expect(screen.getByText('Dossier 33723 Wet bevordering van mediation')).toBeTruthy();
		expect(document.body.textContent).toContain('2 wijzigingen, afloop nog niet vastgesteld');
		expect(screen.getByRole('link', { name: 'Voorstel van wet' })).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Aan het netwerk toevoegen' }));
		expect(onAdd).toHaveBeenCalledWith(
			'documents/16bc127f_3cdf',
			'Dossier 33723 Wet bevordering van mediation'
		);
	});

	it('says a voorstel already in the netwerk, and offers no add for a dossier without bill', async () => {
		dossiers.mockResolvedValueOnce(answer({ closed_known: true, count: 1 }));
		render(OpenChanges, {
			id: ID,
			chosen: new Set(['documents/16bc127f_3cdf']),
			onAdd: () => {}
		});
		await settle();
		const knop = screen.getByRole('button', { name: 'In het netwerk' }) as HTMLButtonElement;
		expect(knop.disabled).toBe(true);
		expect(document.body.textContent).toContain('1 wijziging');
		expect(document.body.textContent).not.toContain('afloop');
	});

	it('leaves the add out where the dossier holds no voorstel', async () => {
		dossiers.mockResolvedValueOnce(answer({ bill_id: null }));
		render(OpenChanges, { id: ID, onAdd: () => {} });
		await settle();
		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.queryByRole('link', { name: 'Voorstel van wet' })).toBeNull();
	});
});
