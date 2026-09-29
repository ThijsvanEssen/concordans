import { describe, expect, it } from 'vitest';
import {
	countLine,
	dayLabel,
	daysOf,
	publicationCite,
	type FeedItem,
	atomParams,
	dossierLabel,
	feedStand,
	foldTitle,
	standLine,
	titleOf
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
		commencement: null,
		headline: {}
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

describe('titleOf', () => {
	const bill = (title: string, dossierTitle: string | null) =>
		({
			...item('2026-09-15', 'wetsvoorstel', '37000'),
			title,
			dossier: { key: '37000', number: '37000', title: dossierTitle, short_title: null }
		}) as FeedItem;
	it('names a bill by its dossier', () => {
		expect(titleOf(bill('Voorstel van wet ', 'Wijziging van enkele belastingwetten'))).toBe(
			'Wijziging van enkele belastingwetten'
		);
	});
	it('keeps the generic title without a dossier title', () => {
		expect(titleOf(bill('Voorstel van wet', null))).toBe('Voorstel van wet');
	});
	it('keeps a title of its own', () => {
		expect(titleOf(bill('Motie van het lid Boomsma', 'Begroting'))).toBe(
			'Motie van het lid Boomsma'
		);
	});
});

describe('the votes of a day', () => {
	const vote = (dossier: string, voor: number, tegen: number, subkind = 'motie') =>
		({
			...item('2026-09-22', 'stemming', dossier),
			subkind,
			vote: { passed: voor > tegen, tally: { Voor: voor, Tegen: tegen } }
		}) as FeedItem;

	it('fold into one line at the top, the bills and the close ones apart', () => {
		const [day] = daysOf([
			item('2026-09-22', 'brief_regering', null),
			vote('29911', 120, 30),
			vote('29754', 20, 130),
			vote('36892', 100, 50, 'amendement'),
			vote('29911', 75, 75),
			vote('36889', 100, 50, 'wetsvoorstel')
		]);
		const [first, ...rest] = day.entries;
		expect('fold' in first && first.fold.id).toBe('fold/2026-09-22/stemming');
		expect('fold' in first && foldTitle(first.fold)).toBe(
			'Kamer stemt over 2 moties: 1 aangenomen, 1 verworpen, en over 1 amendement'
		);
		expect(rest.map((e) => ('item' in e ? e.item.kind : 'fold'))).toEqual([
			'brief_regering',
			'stemming',
			'stemming'
		]);
		expect(day.counts[0]).toEqual({ kind: 'stemming', count: 5 });
		// With the summary, the whole day: bills left out, the rest counted.
		expect(
			'fold' in first &&
				foldTitle(first.fold, [
					{ subkind: 'wetsvoorstel', outcome: 'aangenomen', count: 6 },
					{ subkind: 'motie', outcome: 'aangenomen', count: 88 },
					{ subkind: 'motie', outcome: 'verworpen', count: 37 },
					{ subkind: 'amendement', outcome: 'aangenomen', count: 9 }
				])
		).toBe('Kamer stemt over 125 moties: 88 aangenomen, 37 verworpen, en over 9 amendementen');
	});

	it('stay single lines when there are few', () => {
		const [day] = daysOf([vote('29911', 120, 30), vote('29754', 20, 130)]);
		expect(day.entries.every((e) => 'item' in e)).toBe(true);
	});
});

describe('feedStand', () => {
	it('takes the newest record of the Kamers, and says when it was fetched', () => {
		const stand = feedStand({
			tk: { retrieved_at: '2026-09-24T20:51:42Z', newest: '2026-09-24' },
			eerstekamer: { retrieved_at: '2026-09-23T10:07:37Z', newest: '2026-09-21' },
			rechtspraak: { retrieved_at: '2026-09-29T07:29:57Z', newest: '2026-09-28' }
		});
		expect(stand).toEqual({ newest: '2026-09-24', retrievedAt: '2026-09-24T20:51:42Z' });
		expect(standLine(stand!)).toBe(
			'Stukken van de Kamers tot en met 24 sep 2026, opgehaald op 24 sep 2026'
		);
		expect(feedStand({ bwb: { newest: '2026-09-01' } })).toBeNull();
		expect(feedStand(undefined)).toBeNull();
	});
});
