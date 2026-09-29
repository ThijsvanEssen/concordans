import { describe, expect, it } from 'vitest';
import {
	countLine,
	dayLabel,
	daysOf,
	publicationCite,
	type FeedItem,
	atomParams,
	dossierLabel
} from './feed';

let n = 0;
const item = (date: string, kind: FeedItem['kind'], dossier: string | null): FeedItem =>
	({
		id: `x/${++n}`,
		kind,
		date,
		title: `${kind} ${n}`,
		summary: null,
		subkind: null,
		node: { collection: 'documents', key: String(n) },
		dossier: dossier ? { key: dossier, number: dossier, title: null, short_title: null } : null,
		persons: [],
		ministry: null,
		cabinet: null,
		official_url: null,
		tk_url: null,
		vote: null,
		commitment: null,
		publication: null,
		commencement: null
	}) as FeedItem;

describe('daysOf', () => {
	it('groups per day and folds many of one kind on one dossier', () => {
		const items = [
			item('2026-09-24', 'motie', '30234'),
			item('2026-09-24', 'brief_regering', null),
			item('2026-09-24', 'motie', '30234'),
			item('2026-09-24', 'motie', '21501-32'),
			item('2026-09-24', 'motie', '30234'),
			item('2026-09-23', 'motie', '30234')
		];
		const days = daysOf(items);
		expect(days.map((d) => d.date)).toEqual(['2026-09-24', '2026-09-23']);
		const [first] = days;
		// The fold stands where its first item stood.
		expect(first.entries.map((e) => ('fold' in e ? e.fold.id : e.item.kind))).toEqual([
			'fold/2026-09-24/motie/30234',
			'brief_regering',
			'motie'
		]);
		expect('fold' in first.entries[0] && first.entries[0].fold.items).toHaveLength(3);
		expect(countLine(first.counts)).toBe('4 moties, 1 brief van de regering');
		// One of a kind on another day does not fold.
		expect(days[1].entries).toHaveLength(1);
	});
});

describe('labels', () => {
	it('names the day and cites a publication', () => {
		expect(dayLabel('2026-09-29', '2026-09-29')).toBe('Vandaag');
		expect(dayLabel('2026-09-28', '2026-09-29')).toBe('Gisteren');
		expect(dayLabel('2026-09-22', '2026-09-29')).toBe('Dinsdag 22 september 2026');
		expect(publicationCite({ series: 'stb', year: 2026, number: '204', instruments: [] })).toBe(
			'Stb. 2026, 204'
		);
	});
});

describe('atomParams', () => {
	it('keeps the filters chosen and leaves out the end of today the page adds', () => {
		const q = { faction: 'd66', until: '2026-09-29', limit: 100, kind: undefined };
		expect(atomParams(q, '').toString()).toBe('faction=d66');
		expect(atomParams(q, '2026-09-29').toString()).toBe('faction=d66&until=2026-09-29');
	});
});

describe('dossierLabel', () => {
	const d = (short_title: string | null, title: string | null) => ({
		key: '36600',
		number: '36600',
		title,
		short_title
	});
	it('uses the short title', () => {
		expect(dossierLabel(d('Begroting JenV', 'Vaststelling van de begrotingsstaten'))).toBe(
			'36600 Begroting JenV'
		);
	});
	it('falls back to the name in brackets at the end of the title', () => {
		expect(
			dossierLabel(d(null, 'Wijziging van de Vreemdelingenwet 2000 (Wet tweestatusstelsel)'))
		).toBe('36600 Wet tweestatusstelsel');
	});
	it('is the number alone without any title', () => {
		expect(dossierLabel(d(null, null))).toBe('36600');
	});
});
