import { describe, expect, it } from 'vitest';
import { collectText, findHits, hitsAsRanges } from './search-in-text';

describe('findHits', () => {
	it('finds every hit apart from case', () => {
		expect(findHits('De Wet en de wet', 'wet')).toEqual([
			{ start: 3, end: 6 },
			{ start: 13, end: 16 }
		]);
	});
	it('finds nothing for one letter or a blank', () => {
		expect(findHits('aaa', 'a')).toEqual([]);
		expect(findHits('aaa', '  ')).toEqual([]);
	});
});

describe('collectText and hitsAsRanges', () => {
	const make = (html: string) => {
		const root = document.createElement('div');
		root.innerHTML = html;
		document.body.append(root);
		return root;
	};
	it('finds a hit across an inline element, not across two blocks', () => {
		const root = make('<p>de zorg<em>plicht</em> geldt</p><p>plicht blijft</p>');
		const { text, parts } = collectText(root);
		const ranges = hitsAsRanges(parts, findHits(text, 'zorgplicht'), document);
		expect(ranges).toHaveLength(1);
		expect(ranges[0].toString()).toBe('zorgplicht');
		const two = hitsAsRanges(parts, findHits(text, 'plicht'), document);
		expect(two.map((r) => r.toString())).toEqual(['plicht', 'plicht']);
		expect(findHits(text, 'geldtplicht')).toEqual([]);
	});
	it('leaves out what is not read on the screen', () => {
		const root = make('<p>zichtbaar</p><p class="sr-only">verborgen</p><p hidden>weg</p>');
		expect(collectText(root).text).toBe('zichtbaar');
	});
});
