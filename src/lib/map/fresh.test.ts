import { describe, expect, it } from 'vitest';
import type { MapItem } from './map';
import { freshAsks, freshLines, newestCiting, type FeedLine } from './fresh';

const item = (id: string, groupKey: string, at = ''): MapItem => ({
	id,
	at,
	kort: id,
	groep: groupKey,
	groupKey
});
const lid = item('articles/bwbr0005290_658', 'wet:bwbr0005290', 'lid-1');
const art = item('articles/bwbr0005290_658', 'wet:bwbr0005290');
const awb = item('articles/bwbr0005537_3_2', 'wet:bwbr0005537');
const law = item('instruments/bwbr0005290', 'wet:bwbr0005290');
const motie = item('documents/kst_36744_12', 'dossier:36744');
const dossier = item('dossiers/36600_xv', 'dossier:36600-XV');
const uitspraak = item('judgments/ecli_nl_hr_2005_au3313', 'judgments/ecli_nl_hr_2005_au3313');
const boek = { ...item('external:ab12cd34', 'groep:Andere bronnen'), kind: 'book' as const };

/** A line of the feed as /api/feed?instrument= gives it. */
const feed = (over: Partial<FeedLine>): FeedLine =>
	({
		id: 'x',
		kind: 'publicatie',
		date: '2026-10-07',
		via: null,
		amends_articles: [],
		commencement: null,
		...over
	}) as unknown as FeedLine;

describe('what a bundel asks for what is new', () => {
	it('asks one feed per law and per dossier, and the newest citing judgment per article', () => {
		expect(freshAsks([lid, art, awb, law, motie, dossier, uitspraak, boek])).toEqual([
			{ kind: 'law', key: 'wet:bwbr0005290', bwb: 'BWBR0005290' },
			{ kind: 'law', key: 'wet:bwbr0005537', bwb: 'BWBR0005537' },
			{ kind: 'dossier', key: 'dossier:36744', dossier: '36744' },
			{ kind: 'dossier', key: 'dossier:36600-XV', dossier: '36600-XV' },
			{ kind: 'article', key: 'articles/bwbr0005290_658', bwb: 'BWBR0005290', number: '658' },
			{ kind: 'article', key: 'articles/bwbr0005537_3_2', bwb: 'BWBR0005537', number: '3_2' }
		]);
	});

	it('asks nothing for a vote, a judgment or a source outside Concordans', () => {
		expect(freshAsks([uitspraak, boek, item('decisions/d1', 'decisions/d1')])).toEqual([]);
	});
});

describe('what is new for an item', () => {
	const amends = feed({ id: 'a', via: { relation: 'amends', article: '658', dossier: null } });
	const version = feed({
		id: 'v',
		kind: 'inwerkingtreding',
		via: { relation: 'version_of', article: null, dossier: null },
		commencement: { articles: ['629', '658'] } as FeedLine['commencement']
	});
	const proposes = feed({
		id: 'p',
		via: { relation: 'proposes', article: null, dossier: '36700' },
		amends_articles: [{ key: 'bwbr0005290_658' }] as FeedLine['amends_articles']
	});
	const basedOn = feed({
		id: 'b',
		kind: 'inwerkingtreding',
		via: { relation: 'based_on', article: '3:2', dossier: null },
		commencement: { articles: ['658'] } as FeedLine['commencement']
	});
	const awbAmends = feed({ id: 'w', via: { relation: 'amends', article: '3:2', dossier: null } });
	const other = feed({ id: 'o', via: { relation: 'amends', article: '611', dossier: null } });
	const all = [amends, version, proposes, basedOn, awbAmends, other];

	it('gives an article what changes it or proposes to: by its number, as its key writes it', () => {
		expect(freshLines(lid, all).map((f) => f.id)).toEqual(['a', 'v', 'p']);
		expect(freshLines(awb, all).map((f) => f.id)).toEqual(['w']);
	});

	it('gives a law or a dossier itself all that came in, and a paper of a dossier nothing', () => {
		expect(freshLines(law, all)).toHaveLength(all.length);
		expect(freshLines(dossier, all)).toHaveLength(all.length);
		expect(freshLines(motie, all)).toEqual([]);
	});
});

describe('the newest judgment citing an article', () => {
	const page = {
		items: [
			{
				judgment: {
					date: '2026-10-07',
					cite: {
						short: 'Rb. Den Haag 7 oktober 2026',
						full: 'Rb. Den Haag 7 oktober 2026, ECLI:X'
					},
					path: '/uitspraken/ECLI:X'
				},
				paragraph_id: 'rov-3.1',
				paragraph_number: '3.1'
			}
		]
	};

	it('is new where it was decided after the visit before, cited at its place', () => {
		expect(newestCiting(page, '2026-10-01')).toEqual({
			date: '2026-10-07',
			cite: 'Rb. Den Haag 7 oktober 2026, ECLI:X',
			place: '3.1',
			href: '/uitspraken/ECLI:X#rov-3.1'
		});
		expect(newestCiting(page, '2026-10-07')).toBeNull();
		expect(newestCiting({ items: [] }, '2026-10-01')).toBeNull();
	});
});
