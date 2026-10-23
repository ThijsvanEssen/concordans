import { describe, expect, it } from 'vitest';
import type { Neighbor } from '$lib/api/nodes';
import {
	onlyAround,
	deelVan,
	between,
	isOn,
	netwerkParams,
	parseNetwerk,
	withAdded,
	withRemoved,
	withToggled,
	type Participant
} from './netwerk';

const JETTEN = 'members/jetten';
const BUMA = 'members/buma';
const SR = 'instruments/bwbr0001854';

describe('the netwerk in the URL', () => {
	it('reads the chosen bronnen, the ones switched off and the joining switch', () => {
		const n = parseNetwerk(new URLSearchParams(`netwerk=${JETTEN},${BUMA},${SR}&uit=${BUMA}`));
		expect(n.ids).toEqual([JETTEN, BUMA, SR]);
		expect(isOn(n, JETTEN)).toBe(true);
		expect(isOn(n, BUMA)).toBe(false);
		expect(n.tussen).toBe(true);
	});

	it('ignores what is no bron, a double and an uit that is not chosen', () => {
		const n = parseNetwerk(
			new URLSearchParams(`netwerk=${JETTEN},onzin,${JETTEN}&uit=${SR}&tussen=0`)
		);
		expect(n.ids).toEqual([JETTEN]);
		expect(n.uit.size).toBe(0);
		expect(n.tussen).toBe(false);
	});

	it('writes nothing for an empty netwerk', () => {
		expect(netwerkParams(parseNetwerk(new URLSearchParams('tussen=0')))).toEqual({
			netwerk: null,
			uit: null,
			tussen: null
		});
	});

	it('adds, switches and removes', () => {
		let n = withAdded(parseNetwerk(new URLSearchParams()), JETTEN, BUMA);
		n = withToggled(n, BUMA);
		expect(netwerkParams(n)).toEqual({ netwerk: `${JETTEN},${BUMA}`, uit: BUMA, tussen: null });
		n = withAdded(n, BUMA);
		expect(isOn(n, BUMA)).toBe(true);
		n = withRemoved(withToggled(n, JETTEN), JETTEN);
		expect(netwerkParams(n)).toEqual({ netwerk: BUMA, uit: null, tussen: null });
	});
});

const neighbor = (collection: string, key: string, props: Record<string, unknown> = {}) =>
	({ collection, key, props, relation: 'AUTHORED', direction: 'outbound' }) as unknown as Neighbor;
const lawOf = (n: Neighbor) => (n.props?.bwb_id as string | undefined) ?? null;

describe('what joins the chosen bronnen', () => {
	const jetten: Participant = {
		id: JETTEN,
		lawId: null,
		neighbors: [
			neighbor('documents', 'samen'),
			neighbor('documents', 'alleen-jetten'),
			neighbor('articles', 'bwbr0001854_138ab', { bwb_id: 'BWBR0001854' })
		]
	};
	const buma: Participant = {
		id: BUMA,
		lawId: null,
		neighbors: [neighbor('documents', 'samen'), neighbor('members', 'jetten')]
	};
	const sr: Participant = { id: SR, lawId: 'BWBR0001854', neighbors: [] };

	it('keeps a shared bron, a chosen bron and an article of a chosen wet', () => {
		const b = between([jetten, buma, sr], lawOf, true);
		expect([...b.keep.get(JETTEN)!]).toEqual(['documents/samen', 'articles/bwbr0001854_138ab']);
		expect([...b.keep.get(BUMA)!]).toEqual(['documents/samen', JETTEN]);
		expect([...b.joining]).toEqual(['documents/samen']);
		expect(b.alone.size).toBe(0);
	});

	it('leaves the shared bronnen out when joining is off, and still knows they are tied', () => {
		const b = between([jetten, buma], lawOf, false);
		expect([...b.keep.get(JETTEN)!]).toEqual([]);
		expect(b.joining.size).toBe(0);
		expect(b.alone.size).toBe(0);
	});

	it('names a bron that nothing ties to the rest', () => {
		const b = between([buma, sr], lawOf, true);
		expect([...b.alone]).toEqual([BUMA, SR]);
	});
});

describe('a netwerk on a phone', () => {
	it('starts without the bronnen between, and keeps the choice to show them', () => {
		const q = new URLSearchParams(`netwerk=${JETTEN},${BUMA}`);
		const n = parseNetwerk(q, false);
		expect(n.tussen).toBe(false);
		expect(netwerkParams(n, false).tussen).toBeNull();
		const shown = { ...n, tussen: true };
		expect(netwerkParams(shown, false).tussen).toBe('1');
		expect(parseNetwerk(new URLSearchParams(`netwerk=${JETTEN}&tussen=1`), false).tussen).toBe(
			true
		);
	});

	it('reads ?tussen=0 the same on any screen', () => {
		const q = new URLSearchParams(`netwerk=${JETTEN}&tussen=0`);
		expect(parseNetwerk(q, true).tussen).toBe(false);
		expect(parseNetwerk(q, false).tussen).toBe(false);
	});
});

describe('deelVan', () => {
	it('says how many members a path ran through only where the API took part of them', () => {
		expect(deelVan({ used: 200, total: 846 })).toEqual({ used: 200, total: 846 });
		expect(deelVan({ used: 12, total: 12 })).toBeUndefined();
		expect(deelVan(undefined)).toBeUndefined();
	});
});

describe('onlyAround', () => {
	it('switches the others off and keeps them listed; adds the bron when it is not chosen', () => {
		const n = parseNetwerk(new URLSearchParams(`netwerk=${JETTEN},${BUMA}`));
		const f = onlyAround(n, BUMA);
		expect(f.ids).toEqual([JETTEN, BUMA]);
		expect([...f.uit]).toEqual([JETTEN]);
		expect(n.uit.size).toBe(0);
		expect(onlyAround(n, SR).ids).toEqual([JETTEN, BUMA, SR]);
	});
});
