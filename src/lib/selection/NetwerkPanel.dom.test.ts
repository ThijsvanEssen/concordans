// The panel Bronnen: one place for one function. "Alleen de gekozen bronnen tonen" has no link
// and no menu Meer of its own; the reach is Aantal stappen in the block Weergave.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import NetwerkPanel from './NetwerkPanel.svelte';
import { lezerEerst, type NetwerkEntry } from './netwerk';

const entry = (over: Partial<NetwerkEntry>): NetwerkEntry => ({
	id: 'instruments/bwbr0005290',
	label: 'BW 7',
	collection: 'instruments',
	on: true,
	alone: false,
	...over
});
const none = () => {};
const props = {
	onSelect: none,
	onToggle: none,
	onRemove: none,
	onAdd: none,
	onClear: none
};

describe('NetwerkPanel', () => {
	describe('the lezer (B85)', () => {
		const wvw = entry({ id: 'instruments/bwbr0006622', label: 'WVW' });
		const cbb = entry({ id: 'instruments/bwbr0052875', label: 'Cbb' });
		const rij = (naam: string) =>
			screen.getByRole('button', { name: new RegExp(`${naam} uit het netwerk`) }).closest('li')!;

		it('one bron: In de lezer, no switch and no Wis alles', () => {
			render(NetwerkPanel, {
				...props,
				entries: [{ ...wvw, vast: true }],
				lezer: wvw.id
			});
			expect(within(rij('WVW')).getByRole('link', { name: 'In de lezer' })).toBeTruthy();
			expect(within(rij('WVW')).getByRole('button', { name: 'WVW' })).toHaveProperty(
				'disabled',
				true
			);
			expect(screen.queryByText('Wis alles')).toBeNull();
		});
		it('two bronnen: In de lezer on its own, Lezen on the other, each to its own text', () => {
			render(NetwerkPanel, { ...props, entries: [wvw, cbb], lezer: wvw.id });
			expect(within(rij('WVW')).queryByRole('link', { name: 'WVW lezen' })).toBeNull();
			const lezen = within(rij('Cbb')).getByRole('link', { name: 'Cbb lezen' });
			expect(lezen.getAttribute('href')).toBe('/wetten/BWBR0052875');
			expect(
				within(rij('WVW')).getByRole('link', { name: 'In de lezer' }).getAttribute('href')
			).toBe('/wetten/BWBR0006622');
			expect(screen.getAllByText('Wis alles')).toHaveLength(1);
		});
		it('keeps what is chosen when a row leads to the lezer', async () => {
			const onLezen = vi.fn();
			render(NetwerkPanel, { ...props, entries: [wvw, cbb], lezer: wvw.id, onLezen });
			const link = screen.getByRole('link', { name: 'Cbb lezen' });
			link.addEventListener('click', (e) => e.preventDefault());
			await fireEvent.click(link);
			expect(onLezen).toHaveBeenCalledOnce();
		});
		it('a long name keeps the whole name in the row', () => {
			const lang = 'Besluit aanwijzing ambtenaren belast met opsporing ex artikel 159 WVW';
			render(NetwerkPanel, { ...props, entries: [entry({ label: lang })], lezer: 'x/y' });
			expect(screen.getByText(lang)).toBeTruthy();
		});
		it('a bron not found has no way to the lezer', () => {
			render(NetwerkPanel, { ...props, entries: [{ ...cbb, missing: true }], lezer: wvw.id });
			expect(screen.queryByRole('link', { name: 'Cbb lezen' })).toBeNull();
		});
		it('lezerEerst: the bron of the lezer on top, also past the fold', () => {
			const rest = Array.from({ length: 7 }, (_, i) =>
				entry({ id: `instruments/bwbr000000${i}`, label: `Wet ${i}` })
			);
			render(NetwerkPanel, {
				...props,
				entries: lezerEerst([...rest, wvw], wvw.id),
				lezer: wvw.id
			});
			expect(screen.getByRole('link', { name: 'In de lezer' })).toBeTruthy();
		});
	});
	it('has no Meer and no "Alleen de gekozen bronnen tonen", on a desktop or a phone', () => {
		for (const telefoon of [false, true]) {
			const { unmount } = render(NetwerkPanel, {
				...props,
				telefoon,
				entries: [entry({}), entry({ id: 'instruments/bwbr0005289', label: 'BW 6' })]
			});
			expect(screen.queryByText('Meer')).toBeNull();
			expect(screen.queryByText(/Alleen de gekozen bronnen/)).toBeNull();
			expect(screen.getAllByText('Wis alles')).toHaveLength(1);
			unmount();
		}
	});
	it('says "zonder verbinding" of a bron tied to no other', () => {
		render(NetwerkPanel, { ...props, entries: [entry({ alone: true })] });
		expect(screen.getByText('wet, zonder verbinding')).toBeTruthy();
	});
});
