// A law a transposition table names by its title, linked only where the API knows that name.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetAll } from '$lib/util/forget';

const resolveQuery = vi.fn();
vi.mock('$lib/api/search', () => ({ resolveQuery: (q: string) => resolveQuery(q) }));

const { namedLaw } = await import('./named-law');

const answer = (match: Record<string, unknown> | null) => ({
	q: 'x',
	kind: match ? 'instrument' : 'none',
	confidence: 0,
	match,
	alternatives: []
});

const gratiewet = {
	id: 'instruments/bwbr0004257',
	kind: 'instrument',
	confidence: 0.9,
	display_name: 'Gratiewet'
};

beforeEach(() => {
	forgetAll();
	resolveQuery.mockReset();
});

describe('namedLaw', () => {
	it('takes a law the API knows by that exact name, asked once', async () => {
		resolveQuery.mockResolvedValue(answer(gratiewet));
		expect(await namedLaw('Gratiewet')).toEqual({ id: 'instruments/bwbr0004257' });
		expect(await namedLaw('Gratiewet')).toEqual({ id: 'instruments/bwbr0004257' });
		expect(resolveQuery).toHaveBeenCalledTimes(1);
	});

	it.each([
		['a guess', answer({ ...gratiewet, confidence: 0.6 })],
		['another kind', answer({ ...gratiewet, kind: 'article' })],
		['nothing', answer(null)]
	])('leaves %s as text', async (_, a) => {
		resolveQuery.mockResolvedValue(a);
		expect(await namedLaw('Gratiewet')).toBeNull();
	});

	it('keeps the name as text when the API fails, and asks again next time', async () => {
		resolveQuery.mockRejectedValueOnce(new Error('down'));
		expect(await namedLaw('Gratiewet')).toBeNull();
		resolveQuery.mockResolvedValueOnce(answer(gratiewet));
		expect(await namedLaw('Gratiewet')).toEqual({ id: 'instruments/bwbr0004257' });
	});
});
