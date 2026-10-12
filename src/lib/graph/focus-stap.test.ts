import { describe, expect, it } from 'vitest';
import { focusStap, type FocusStand } from './focus-stap';

const NR10 = 'documents/kst-36496-10';
const NR47 = 'documents/kst-36496-47';

const stand = (s: Partial<FocusStand>): FocusStand => ({
	focus: NR10,
	loadedFocus: NR10,
	replaceNext: null,
	zichtbaar: false,
	lichtGeladen: null,
	withNetwerk: false,
	verdiept: null,
	geselecteerd: () => null,
	...s
});
const gekozen = (id: string) => () => ({ id, linkId: id });

describe('a phone on a link to another Kamerstuk with ?paneel=netwerk (#48)', () => {
	// Hard load of nr. 10 on the text tab: its light node only, selected.
	const opNr10 = { lichtGeladen: NR10, geselecteerd: gekozen(NR10) };

	it('loads the new focus when the address changes', () => {
		expect(focusStap(stand({ ...opNr10, focus: NR47 }))).toEqual({ soort: 'laden' });
	});

	it('does not draw the old bron when the Netwerk tab opens before the new one is in', () => {
		// The load of nr. 47 started (loadedFocus), its light node not yet in; the tab
		// switched to Netwerk, nr. 10 still selected.
		const s = stand({
			focus: NR47,
			loadedFocus: NR47,
			zichtbaar: true,
			geselecteerd: gekozen(NR10)
		});
		expect(focusStap(s)).toBeNull();
	});

	it('draws the new bron once its light node is in', () => {
		const s = stand({
			focus: NR47,
			loadedFocus: NR47,
			zichtbaar: true,
			lichtGeladen: NR47,
			geselecteerd: gekozen(NR47)
		});
		expect(focusStap(s)).toEqual({ soort: 'laden' });
	});

	it('the same both ways', () => {
		const s = stand({
			focus: NR10,
			loadedFocus: NR10,
			zichtbaar: true,
			geselecteerd: gekozen(NR47)
		});
		expect(focusStap(s)).toBeNull();
	});
});

describe('the canvas around a focus already loaded', () => {
	it('deepens around the selected focus when the canvas is shown', () => {
		expect(focusStap(stand({ zichtbaar: true, geselecteerd: gekozen(NR10) }))).toEqual({
			soort: 'verdiepen',
			anker: NR10
		});
	});

	it('counts a selection whose link names the focus as the focus', () => {
		const s = stand({ zichtbaar: true, geselecteerd: () => ({ id: 'documents/x', linkId: NR10 }) });
		expect(focusStap(s)).toEqual({ soort: 'verdiepen', anker: 'documents/x' });
	});

	it('keeps the bron it was drawn around, also when another one is selected', () => {
		const s = stand({ zichtbaar: true, verdiept: NR47, geselecteerd: gekozen(NR10) });
		expect(focusStap(s)).toEqual({ soort: 'verdiepen', anker: NR47 });
	});

	it('does nothing while the canvas is hidden or a netwerk holds it', () => {
		expect(focusStap(stand({ geselecteerd: gekozen(NR10) }))).toBeNull();
		expect(
			focusStap(stand({ zichtbaar: true, withNetwerk: true, geselecteerd: gekozen(NR10) }))
		).toBeNull();
	});

	it('draws anew on a double click', () => {
		expect(focusStap(stand({ replaceNext: NR10 }))).toEqual({ soort: 'laden' });
	});
});
