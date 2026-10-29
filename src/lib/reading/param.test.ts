import { describe, expect, it } from 'vitest';
import { articleRoute, readValue, withRead, parseRead } from './param';

describe('the lees parameter', () => {
	it('reads an article and the part it cites', () => {
		expect(parseRead('articles/bwbr0052872_68.lid-1')).toEqual([
			{ key: 'bwbr0052872_68', at: 'lid-1' }
		]);
		expect(parseRead('articles/bwbr0005289_6:106.lid-1-onder-b')).toEqual([
			{ key: 'bwbr0005289_6:106', at: 'lid-1-onder-b' }
		]);
		expect(parseRead('articles/bwbr0052875_19')).toEqual([{ key: 'bwbr0052875_19', at: null }]);
	});

	it('keeps a dot that is part of the number', () => {
		expect(parseRead('articles/bwbr0037885_1.1')).toEqual([{ key: 'bwbr0037885_1.1', at: null }]);
		expect(parseRead('articles/bwbr0037885_1.1.aanhef')).toEqual([
			{ key: 'bwbr0037885_1.1', at: 'aanhef' }
		]);
	});

	it('reads several in order and leaves out what is no article', () => {
		expect(parseRead('articles/a_19,judgments/x,articles/a_23.lid-1')).toEqual([
			{ key: 'a_19', at: null },
			{ key: 'a_23', at: 'lid-1' }
		]);
		expect(parseRead('')).toEqual([]);
		expect(parseRead(null)).toEqual([]);
	});

	it('writes what it reads', () => {
		const items = [
			{ key: 'bwbr0052875_19', at: null },
			{ key: 'bwbr0052875_23', at: 'lid-1' }
		];
		expect(parseRead(readValue(items))).toEqual(items);
	});

	it('sets and takes away the parameter, other parameters and the fragment kept', () => {
		const url = new URL('https://x.nl/wetten/BWBR0052884?mode=netwerk#lid-2');
		const met = withRead(url, [{ key: 'bwbr0052872_68', at: 'lid-1' }]);
		expect(met).toBe('/wetten/BWBR0052884?mode=netwerk&lees=articles/bwbr0052872_68.lid-1#lid-2');
		expect(withRead(new URL(`https://x.nl${met}`), [])).toBe(
			'/wetten/BWBR0052884?mode=netwerk#lid-2'
		);
	});

	it('makes the route of the API from the node key', () => {
		expect(articleRoute('bwbr0052872_68')).toEqual({ bwbId: 'BWBR0052872', articleNumber: '68' });
		expect(articleRoute('bwbr0005289_6:162')).toEqual({
			bwbId: 'BWBR0005289',
			articleNumber: '6:162'
		});
		expect(articleRoute('32016r0679_6')).toEqual({ bwbId: '32016R0679', articleNumber: '6' });
		expect(articleRoute('stam')).toBeNull();
	});
});
