// The words of an article's head, one source for its reader and its first paint.
import { describe, expect, it } from 'vitest';
import { langeDatum } from './datum';
import {
	headTitle,
	dossierExplanation,
	explanatoryLabel,
	originVerbOf,
	ownExplanation,
	versionLabelOf
} from './article-head';

const label = (o: Partial<Parameters<typeof versionLabelOf>[0]>) =>
	versionLabelOf({
		stubLabel: null,
		shown: null,
		showStatus: false,
		officialId: null,
		validity: { state: 'in_force', date: null, as_of: null, successors: [] },
		repealed: false,
		lapseFrom: null,
		euAct: false,
		validFrom: '1992-01-01',
		...o
	});

describe('the head of an article', () => {
	it('titles it by its number, a BW article by its book, with its heading', () => {
		expect(headTitle({ bwb_id: 'BWBR0005289', article_number: '162' })).toBe('Artikel 6:162');
		expect(headTitle({ bwb_id: 'BWBR0001840', article_number: '1', heading: 'Gelijkheid' })).toBe(
			'Artikel 1. Gelijkheid'
		);
	});

	it('says the stand where no line of validity does', () => {
		expect(label({})).toBe(`Geldend recht, tekst sinds ${langeDatum('1992-01-01')}`);
		expect(label({ validity: null })).toBe(`Tekst sinds ${langeDatum('1992-01-01')}`);
		expect(label({ showStatus: true })).toBe('');
		expect(label({ euAct: true })).toBeNull();
		expect(label({ shown: { from: '2001-01-01', until: '2002-01-01' } })).toBe(
			`Eerdere tekst, ${langeDatum('2001-01-01')} tot ${langeDatum('2002-01-01')}`
		);
	});

	it('names how the wet under the text made it', () => {
		expect(originVerbOf({ index: 1, first: {} })).toBe('Gewijzigd bij');
		expect(originVerbOf({ index: 0, first: { change: 'establishes' } })).toBe('Vastgesteld bij');
		expect(originVerbOf({ index: 0, first: { change: 'introduces' } })).toBe('Ingevoerd bij');
		expect(originVerbOf({ index: 0, first: {} })).toBe('Tekst uit');
		expect(originVerbOf(null)).toBe('');
	});

	it('names the explanation of the text on screen first, never one of the instrument', () => {
		const doc = (key: string) => ({ key, title: null, kind: 'Memorie van toelichting' });
		const items = [
			{ target: 'instrument', scope: 'article', document: doc('wet') },
			{ target: 'article', scope: 'article', document: doc('artikel') },
			{
				target: 'article_version',
				scope: 'dossier',
				article_version_key: 'v2',
				document: doc('v2')
			}
		];
		expect(ownExplanation(items, ['v2'], '2020-01-01')?.key).toBe('v2');
		expect(ownExplanation(items, ['v1'], null)?.key).toBe('artikel');
		expect(ownExplanation(items.slice(0, 1), [], null)).toBeNull();
		const mvt = dossierExplanation({ key: 'kst', title: null }, '36000', null);
		expect(explanatoryLabel(mvt)).toBe('Memorie van toelichting');
	});
});
