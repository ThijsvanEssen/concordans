// The panel Bronnen: one place for one function. "Alleen de gekozen bronnen tonen" has no link
// and no menu Meer of its own; the filter is the Vinkje "Alleen verbonden bronnen" under Tonen.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import NetwerkPanel from './NetwerkPanel.svelte';
import type { NetwerkEntry } from './netwerk';

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
