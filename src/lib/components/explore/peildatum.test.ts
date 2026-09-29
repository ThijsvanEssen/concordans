import { describe, expect, it } from 'vitest';
import { atArticles, isDay, versionOn, versionsByYear } from './peildatum';

const versions = [
	{ valid_from: '2026-08-15', valid_until: null, current: true },
	{ valid_from: '2026-08-01', valid_until: '2026-08-15', current: false },
	{ valid_from: '2015-04-01', valid_until: '2015-07-01', current: false },
	{ valid_from: '2015-01-01', valid_until: '2015-04-01', current: false }
];

describe('isDay', () => {
	it('takes a day and nothing else', () => {
		expect(isDay('2015-01-01')).toBe(true);
		expect(isDay('2015-1-1')).toBe(false);
		expect(isDay('gisteren')).toBe(false);
		expect(isDay(null)).toBe(false);
	});
});

describe('versionOn', () => {
	it('finds the version whose period holds the day, its end not included', () => {
		expect(versionOn(versions, '2015-03-31')?.valid_from).toBe('2015-01-01');
		expect(versionOn(versions, '2015-04-01')?.valid_from).toBe('2015-04-01');
		expect(versionOn(versions, '2026-09-29')?.current).toBe(true);
	});
	it('is null before the first version', () => {
		expect(versionOn(versions, '2001-01-01')).toBeNull();
	});
});

describe('versionsByYear', () => {
	it('groups by year, newest first', () => {
		expect(versionsByYear(versions).map(([y, vs]) => [y, vs.length])).toEqual([
			['2026', 2],
			['2015', 2]
		]);
	});
});

describe('atArticles', () => {
	const current = [
		{
			key: 'bwbr0005537_1_1',
			article_number: '1:1',
			label: null,
			breadcrumb: [{ type: 'hoofdstuk', label: 'Hoofdstuk 1', title: 'Inleidende bepalingen' }]
		}
	];
	const at = (n: string) => ({
		key: `v_${n}`,
		article_number: n,
		text: 'tekst',
		text_preview: 'tekst',
		valid_from: '2011-02-23',
		valid_until: '2018-05-01'
	});
	it('gives an article that still exists its place and its link', () => {
		const [a] = atArticles([at('1:1')], current);
		expect(a.key).toBe('bwbr0005537_1_1');
		expect(a.breadcrumb[0].label).toBe('Hoofdstuk 1');
	});
	it('leaves an article that lapsed without place and link', () => {
		const [a] = atArticles([at('3:47a')], current);
		expect(a.key).toBeNull();
		expect(a.breadcrumb).toEqual([]);
		expect(a.id).toBe('v_3:47a');
	});
});
