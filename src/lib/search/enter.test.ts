import { describe, expect, it } from 'vitest';
import { EarlyEnter } from './enter.svelte';
import type { Resolved } from './resolve-query';

/** An answer the test lets through when it wants: the API's delay, without a clock. */
function delayed<T>() {
	let release!: (value: T) => void;
	const answer = new Promise<T>((resolve) => (release = resolve));
	return { answer, release };
}

const ARTICLE: Resolved = {
	ref: { collection: 'articles', key: 'bwbr0005289_boek6_art162' },
	at: null,
	label: 'Artikel 6:162 BW'
};

describe('EarlyEnter: an Enter typed before the answer is done once it is in (#79)', () => {
	it('opens "6:162 BW" once the API confirms the article, not before', async () => {
		const resolve = delayed<Resolved>();
		const opened: Resolved[] = [];
		let confirmed: Resolved | null = null;
		const enter = new EarlyEnter(() => {
			if (!confirmed) return false;
			opened.push(confirmed);
			return true;
		});

		const term = '6:162 BW';
		const asked = resolve.answer.then((t) => (confirmed = t));
		enter.press(term);
		enter.answer(term, false);
		expect(opened).toEqual([]);

		resolve.release(ARTICLE);
		await asked;
		enter.answer(term, confirmed !== null);
		expect(opened.map((r) => r.ref.key)).toEqual(['bwbr0005289_boek6_art162']);
		// Spent: the next answer opens nothing more.
		enter.answer(term, true);
		expect(opened).toHaveLength(1);
	});

	it('opens at once what can open, and remembers nothing then', () => {
		let calls = 0;
		const enter = new EarlyEnter(() => (calls++, true));
		enter.press('Awb');
		expect(calls).toBe(1);
		expect(enter.waiting).toBe('');
	});

	it('drops the Enter when the query changes, or when every answer is in and none opens', () => {
		let calls = 0;
		const enter = new EarlyEnter(() => (calls++, false));
		enter.press('huur');
		enter.answer('huurr', true);
		expect(enter.waiting).toBe('');

		enter.press('huur');
		enter.answer('huur', true);
		expect(enter.waiting).toBe('');
		expect(calls).toBe(3);
	});

	it('forgets the Enter when a key moves the choice', () => {
		const enter = new EarlyEnter(() => false);
		enter.press('huur');
		enter.forget();
		expect(enter.waiting).toBe('');
	});
});
