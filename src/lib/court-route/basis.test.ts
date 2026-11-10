import { describe, expect, it } from 'vitest';
import type { CourseStep } from '$lib/bron/course-layers';
import { articleOfBasis, basisArticle } from './basis';

const withBasis = (basis: CourseStep['basis']) => ({ basis }) as CourseStep;

describe('the article of a step', () => {
	it('cites the article with its law, its node and its readable address', () => {
		expect(articleOfBasis({ bwb_id: 'BWBR0001830', article_number: '42' })).toEqual({
			name: 'art. 42 RO',
			ref: { collection: 'articles', key: 'bwbr0001830_42' },
			path: '/wetten/BWBR0001830/artikel/42'
		});
		expect(basisArticle(withBasis({ bwb_id: 'BWBR0005537', article_number: '8:105' }))).toEqual({
			name: 'art. 8:105 Awb',
			ref: { collection: 'articles', key: 'bwbr0005537_8_105' },
			path: '/wetten/BWBR0005537/artikel/8:105'
		});
	});

	it('gives an article of a bijlage no address: its number has none (readable_paths)', () => {
		expect(
			articleOfBasis({ bwb_id: 'BWBR0005537', article_number: 'bijlage 2 artikel 9' })
		).toEqual({
			name: 'art. 9 bijlage 2 Awb',
			ref: { collection: 'articles', key: 'bwbr0005537_bijlage_2_artikel_9' },
			path: null
		});
	});

	it('gives nothing where the API has no article', () => {
		expect(basisArticle(withBasis(null))).toBeNull();
	});
});
