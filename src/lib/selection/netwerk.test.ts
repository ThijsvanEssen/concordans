import { describe, expect, it } from 'vitest';
import type { Neighbor } from '$lib/api/nodes';
import {
	syncOn,
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
	it('reads the chosen bronnen, and the ones switched off', () => {
		const n = parseNetwerk(new URLSearchParams(`netwerk=${JETTEN},${BUMA},${SR}&uit=${BUMA}`));
		expect(n.ids).toEqual([JETTEN, BUMA, SR]);
		expect(isOn(n, JETTEN)).toBe(true);
		expect(isOn(n, BUMA)).toBe(false);
	});

	it('ignores what is no bron, a double and an uit that is not chosen', () => {
		const n = parseNetwerk(new URLSearchParams(`netwerk=${JETTEN},onzin,${JETTEN}&uit=${SR}`));
		expect(n.ids).toEqual([JETTEN]);
		expect(n.uit.size).toBe(0);
	});

	it('writes nothing for an empty netwerk', () => {
		expect(netwerkParams(parseNetwerk(new URLSearchParams()))).toEqual({
			netwerk: null,
			uit: null
		});
	});

	it('adds, switches and removes', () => {
		let n = withAdded(parseNetwerk(new URLSearchParams()), JETTEN, BUMA);
		n = withToggled(n, BUMA);
		expect(netwerkParams(n)).toEqual({ netwerk: `${JETTEN},${BUMA}`, uit: BUMA });
		n = withAdded(n, BUMA);
		expect(isOn(n, BUMA)).toBe(true);
		n = withRemoved(withToggled(n, JETTEN), JETTEN);
		expect(netwerkParams(n)).toEqual({ netwerk: BUMA, uit: null });
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

describe('an old address with ?tussen', () => {
	it('is read without it: the bronnen between are no longer a choice', () => {
		const n = parseNetwerk(new URLSearchParams(`netwerk=${JETTEN},${BUMA}&tussen=0`));
		expect(n).toEqual({ ids: [JETTEN, BUMA], uit: new Set() });
		expect(netwerkParams(n)).toEqual({ netwerk: `${JETTEN},${BUMA}`, uit: null });
	});
});

describe('syncOn', () => {
	it('turns the entries on again when the address no longer switches them off', () => {
		const off = parseNetwerk(new URLSearchParams(`netwerk=${JETTEN},${BUMA}&uit=${JETTEN}`));
		const entry = (id: string, on: boolean) => ({ id, on }) as never;
		const drawn = [entry(JETTEN, false), entry(BUMA, true)];
		const plain = parseNetwerk(new URLSearchParams(`netwerk=${JETTEN},${BUMA}`));
		expect(syncOn(drawn, plain).map((e) => e.on)).toEqual([true, true]);
		expect(syncOn([entry(JETTEN, true), entry(BUMA, true)], off).map((e) => e.on)).toEqual([
			false,
			true
		]);
	});
});
