import { describe, expect, it } from 'vitest';
import {
	neighborName,
	isCited,
	announcement,
	spansOf,
	panelTitle,
	lawLine,
	citedBlocks,
	chipName,
	stackTitle,
	stackLaw,
	type ArticleTextData,
	type TextBlock
} from './blocks';

const block = (anchor: string | null, within: string[] = []): TextBlock => ({
	anchor,
	kind: 'lid',
	number: null,
	marker: null,
	within,
	text: 'Met het toezicht, bedoeld in artikel 25, tweede lid, van de wet.',
	links: []
});

const article = {
	label: 'Artikel 68',
	heading: '(toezichthouders)',
	display_name: 'Art. 68 Cbw',
	law: {
		title: 'Cyberbeveiligingswet',
		citation_title: 'Cyberbeveiligingswet',
		abbreviation: 'Cbw'
	}
} as ArticleTextData;

describe('the article of the Zijpaneel', () => {
	it('marks the cited lid with all it holds, and an onderdeel alone', () => {
		expect(isCited(block('lid-1'), 'lid-1')).toBe(true);
		expect(isCited(block('lid-1-onder-a', ['lid-1']), 'lid-1')).toBe(true);
		expect(isCited(block('lid-2'), 'lid-1')).toBe(false);
		expect(isCited(block('lid-1-aanhef', ['lid-1']), 'lid-1-onder-b')).toBe(false);
		expect(isCited(block('lid-1-onder-b', ['lid-1']), 'lid-1-onder-b')).toBe(true);
		expect(isCited(block('lid-1'), null)).toBe(false);
	});

	it('names it in its head', () => {
		expect(panelTitle(article)).toBe('Artikel 68 Cbw');
		expect(lawLine(article)).toBe('Cyberbeveiligingswet (toezichthouders)');
		expect(panelTitle({ ...article, law: null })).toBe('Artikel 68');
		expect(neighborName({ label: 'Artikel 67', address: '67' } as never)).toBe('Art. 67');
	});

	it('says what is cited, and Esc only to a keyboard', () => {
		expect(announcement(article, 'lid-1', true)).toBe(
			'Artikel 68 Cbw, lid 1 geciteerd. Esc sluit.'
		);
		expect(announcement(article, null, false)).toBe('Artikel 68 Cbw.');
	});

	it('gives its links as the spans of a citation', () => {
		const b = {
			...block('lid-1'),
			links: [
				{
					leden: ['2'],
					onderdelen: [],
					aanhef: false,
					start: 29,
					end: 63,
					text: 'artikel 25, tweede lid, van de wet',
					target: {
						id: 'articles/bwbr0052872_25',
						key: 'bwbr0052872_25',
						collection: 'articles',
						bwb_id: 'BWBR0052872',
						celex: null,
						official_id: null,
						article_number: '25',
						path: null
					}
				}
			]
		};
		expect(spansOf(b)[0]).toMatchObject({ start: 29, end: 63, leden: ['2'], kind: 'article' });
	});
});

describe('a stapel', () => {
	const lid = (anchor: string, kind = 'lid', within: string[] = []): TextBlock => ({
		...block(anchor, within),
		kind
	});

	it('shows the cited lid only, and the whole article where it cites none', () => {
		const blocks = [lid('lid-1'), lid('lid-2'), lid('lid-3')];
		expect(citedBlocks(blocks, 'lid-2').map((b) => b.anchor)).toEqual(['lid-2']);
		expect(citedBlocks(blocks, null)).toHaveLength(3);
		expect(citedBlocks(blocks, 'lid-9')).toHaveLength(3);
	});

	it('keeps the aanhef of the lid a cited onderdeel stands in', () => {
		const blocks = [
			lid('lid-1-aanhef', 'aanhef', ['lid-1']),
			lid('lid-1-onder-a', 'onderdeel', ['lid-1']),
			lid('lid-1-onder-b', 'onderdeel', ['lid-1']),
			lid('lid-2')
		];
		expect(citedBlocks(blocks, 'lid-1-onder-b').map((b) => b.anchor)).toEqual([
			'lid-1-aanhef',
			'lid-1-onder-b'
		]);
		expect(citedBlocks(blocks, 'lid-1')).toHaveLength(3);
	});

	it('names its articles once with their law', () => {
		const items = [
			{ key: 'bwbr0052875_19', at: null },
			{ key: 'bwbr0052875_23', at: 'lid-1' },
			{ key: 'bwbr0052875_28', at: null }
		];
		const cbb = { ...article, law: { ...article.law, abbreviation: 'Cbb' } } as ArticleTextData;
		expect(stackTitle(items, [cbb, cbb, cbb])).toBe('Art. 19, 23 lid 1 en 28 Cbb');
		expect(stackTitle(items.slice(0, 2), [cbb, article])).toBe('Art. 19 Cbb en 23 lid 1 Cbw');
		expect(chipName('bwbr0052875_23', 'lid-1')).toBe('23 lid 1');
		expect(stackLaw([cbb, cbb])).toBe('Cyberbeveiligingswet');
		expect(stackLaw([cbb, null])).toBeNull();
	});
});
