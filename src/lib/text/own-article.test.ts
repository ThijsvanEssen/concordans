import { describe, expect, it } from 'vitest';
import { ownArticleAnchor } from './own-article.svelte';

const target = (t: {
	bwb_id?: string | null;
	official_id?: string | null;
	nr?: string | null;
}) => ({
	id: 'articles/x',
	key: 'x',
	collection: 'articles' as const,
	bwb_id: t.bwb_id ?? null,
	official_id: t.official_id ?? null,
	article_number: t.nr ?? null,
	display_name: null
});

describe('a reference in the whole law to an article of that law', () => {
	it('jumps to the article in place', () => {
		expect(ownArticleAnchor(target({ bwb_id: 'BWBR0005537', nr: '3:5' }), 'BWBR0005537')).toBe(
			'artikel-3:5'
		);
		expect(
			ownArticleAnchor(target({ official_id: 'stb-2026-56', nr: '2.8.16' }), 'STB-2026-56')
		).toBe('artikel-2.8.16');
	});

	it('opens an article of another law, a law or an article without number as before', () => {
		expect(ownArticleAnchor(target({ bwb_id: 'BWBR0001840', nr: '1' }), 'BWBR0005537')).toBeNull();
		expect(ownArticleAnchor(target({ bwb_id: 'BWBR0005537' }), 'BWBR0005537')).toBeNull();
		expect(
			ownArticleAnchor(
				{ ...target({ bwb_id: 'BWBR0005537', nr: '3:5' }), collection: 'instruments' },
				'BWBR0005537'
			)
		).toBeNull();
		expect(ownArticleAnchor(target({ bwb_id: 'BWBR0005537', nr: '3:5' }), null)).toBeNull();
	});
});
