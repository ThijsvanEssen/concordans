import { padOfFocus } from '$lib/bron/leesbaar';
import { describe, expect, it } from 'vitest';
import {
	artikelenGewijzigd,
	errorPlace,
	normalizeItem,
	doorzochtVanaf,
	countLine,
	dayLabel,
	daysOf,
	publicationCite,
	type FeedItem,
	atomHref,
	dossierLabel,
	feedStand,
	foldTitle,
	isFeedKind,
	standLine,
	titleOf
} from './feed';

describe('isFeedKind', () => {
	it('knows a kind as the API names it, and nothing else', () => {
		expect(isFeedKind('Motie')).toBe(true);
		expect(isFeedKind('stemming')).toBe(true);
		expect(isFeedKind('motie')).toBe(false);
	});
});

let n = 0;
const item = (date: string, kind: FeedItem['kind'], dossier: string | null): FeedItem =>
	({
		id: `x/${++n}`,
		path: null,
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
			item('2026-09-24', 'Motie', '30234'),
			item('2026-09-24', 'Brief regering', null),
			item('2026-09-24', 'Motie', '30234'),
			item('2026-09-24', 'Motie', '21501-32'),
			item('2026-09-24', 'Motie', '30234'),
			item('2026-09-23', 'Motie', '30234')
		];
		const days = daysOf(items);
		expect(days.map((d) => d.date)).toEqual(['2026-09-24', '2026-09-23']);
		const [first] = days;
		// The fold stands where its first item stood.
		expect(first.entries.map((e) => ('fold' in e ? e.fold.id : e.item.kind))).toEqual([
			'fold/2026-09-24/Motie/30234',
			'Brief regering',
			'Motie'
		]);
		expect('fold' in first.entries[0] && first.entries[0].fold.items).toHaveLength(3);
		expect(countLine(first.counts)).toBe('4 moties, 1 brief regering');
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

describe('atomHref', () => {
	const atom = (href: string) => href.slice(href.indexOf('/api/'));
	it('links the filters of Actueel, the end of a period only where it is asked', () => {
		expect(atom(atomHref({ faction: 'd66', kind: undefined }))).toBe('/api/feed.atom?faction=d66');
		expect(atom(atomHref({ faction: 'd66', until: '2026-09-29' }))).toBe(
			'/api/feed.atom?faction=d66&until=2026-09-29'
		);
		expect(atom(atomHref({}))).toBe('/api/feed.atom');
	});

	it('gives every word a q of its own, any of them counts', () => {
		expect(atom(atomHref({ q: ['huur', 'woning'] }))).toBe('/api/feed.atom?q=huur&q=woning');
	});

	it('links a law and an article of it', () => {
		expect(atom(atomHref({ instrument: 'BWBR0005289', article: '6:162' }))).toBe(
			'/api/feed.atom?instrument=BWBR0005289&article=6%3A162'
		);
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
			'Kamerstuk 36600 Begroting JenV'
		);
	});
	it('names the law a bill amends as its change', () => {
		expect(
			dossierLabel({
				...d('Vreemdelingenwet 2000', 'Wijziging van de Vreemdelingenwet 2000'),
				short_title_basis: 'amended_law'
			})
		).toBe('Kamerstuk 36600 wijziging van Vreemdelingenwet 2000');
	});
	it('falls back to the whole title, without parsing it', () => {
		expect(
			dossierLabel(d(null, 'Wijziging van de Vreemdelingenwet 2000 (Wet tweestatusstelsel)'))
		).toBe('Kamerstuk 36600 Wijziging van de Vreemdelingenwet 2000 (Wet tweestatusstelsel)');
	});
	it('is the number alone without any title', () => {
		expect(dossierLabel(d(null, null))).toBe('Kamerstuk 36600');
	});
});

describe('titleOf', () => {
	const bill = (title: string, dossierTitle: string | null) =>
		({
			...item('2026-09-15', 'Voorstel van wet', '37000'),
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
	const vote = (dossier: string, voor: number, tegen: number, subkind = 'Motie') =>
		({
			...item('2026-09-22', 'stemming', dossier),
			subkind,
			vote: { chamber: 'TK', passed: voor > tegen, tally: { Voor: voor, Tegen: tegen } }
		}) as FeedItem;

	it('fold into one line at the top, the bills and the close ones apart', () => {
		const [day] = daysOf([
			item('2026-09-22', 'Brief regering', null),
			vote('29911', 120, 30),
			vote('29754', 20, 130),
			vote('36892', 100, 50, 'Amendement'),
			vote('29911', 75, 75),
			vote('36889', 100, 50, 'Wetgeving')
		]);
		const [first, ...rest] = day.entries;
		expect('fold' in first && first.fold.id).toBe('fold/2026-09-22/stemming');
		expect('fold' in first && foldTitle(first.fold)).toBe(
			'Tweede Kamer stemt over 2 moties: 1 aangenomen, 1 verworpen, en over 1 amendement'
		);
		expect(rest.map((e) => ('item' in e ? e.item.kind : 'fold'))).toEqual([
			'Brief regering',
			'stemming',
			'stemming'
		]);
		expect(day.counts[0]).toEqual({ kind: 'stemming', count: 5 });
		// With the summary, the whole day: bills left out, the rest counted.
		expect(
			'fold' in first &&
				foldTitle(first.fold, [
					{ chamber: 'TK', subkind: 'Wetgeving', outcome: 'aangenomen', count: 6 },
					{ chamber: 'TK', subkind: 'Motie', outcome: 'aangenomen', count: 88 },
					{ chamber: 'TK', subkind: 'Motie', outcome: 'verworpen', count: 37 },
					{ chamber: 'TK', subkind: 'Amendement', outcome: 'aangenomen', count: 9 }
				])
		).toBe(
			'Tweede Kamer stemt over 125 moties: 88 aangenomen, 37 verworpen, en over 9 amendementen'
		);
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
			'Stukken van de Kamers tot en met 24 sep. 2026, opgehaald op 24 sep. 2026'
		);
		expect(feedStand({ bwb: { newest: '2026-09-01' } })).toBeNull();
		expect(feedStand(undefined)).toBeNull();
	});
});

describe('doorzochtVanaf', () => {
	it('alleen bij een deels doorzochte periode, en de dag ervoor voor verder terug', () => {
		expect(doorzochtVanaf({ partial: true, searched_from: '2026-07-01' })).toBe('2026-07-01');
		expect(doorzochtVanaf({ partial: true, searched_from: null })).toBeNull();
		expect(doorzochtVanaf({ partial: false })).toBeNull();
	});
});

describe('the address of an item', () => {
	it('keeps a Kamerstuk by its dossier and number, so a link to it is readable', () => {
		normalizeItem({
			kind: 'Amendement',
			date: '2026-10-09',
			title: 'Amendement van het lid Keijzer',
			node: { collection: 'documents', key: 'adres_test_1' },
			dossier: { key: '37022', number: '37022', title: 'Belastingplan 2027' },
			number: '13'
		} as never);
		expect(padOfFocus('documents/adres_test_1')).toBe('/kamerstukken/37022/13');
	});

	it('keeps the path the API gives, and nothing for a paper without one', () => {
		normalizeItem({
			kind: 'Motie',
			date: '2026-10-09',
			title: 'Motie',
			node: { collection: 'documents', key: 'adres_test_2' },
			path: '/kamerstukken/36600-VII/12'
		} as never);
		expect(padOfFocus('documents/adres_test_2')).toBe('/kamerstukken/36600-VII/12');
		normalizeItem({
			kind: 'Motie',
			date: '2026-10-09',
			title: 'Motie',
			node: { collection: 'documents', key: 'adres_test_3' }
		} as never);
		expect(padOfFocus('documents/adres_test_3')).toBeNull();
	});

	it('keeps its persons by their own address (UX-toets 0.79.44, #47)', () => {
		normalizeItem({
			kind: 'Motie',
			date: '2026-10-09',
			title: 'Motie',
			node: { collection: 'documents', key: 'adres_test_4' },
			persons: [
				{
					key: 'lid_adres_1',
					name: 'Simon Ceulemans',
					role: 'indiener',
					path: '/leden/simon-ceulemans'
				},
				{ key: 'lid_adres_2', name: 'Zonder adres', role: 'medeindiener' }
			]
		} as never);
		expect(padOfFocus('members/lid_adres_1')).toBe('/leden/simon-ceulemans');
		expect(padOfFocus('members/lid_adres_2')).toBeNull();
	});
});

describe('the articles a version changed', () => {
	it('counts them of all, or says all', () => {
		expect(artikelenGewijzigd({ changed_articles: 8, article_count: 11 } as never)).toBe(
			'8 van 11 artikelen gewijzigd'
		);
		expect(artikelenGewijzigd({ changed_articles: 111, article_count: 111 } as never)).toBe(
			'alle 111 artikelen'
		);
		expect(artikelenGewijzigd({ changed_articles: 3, article_count: null } as never)).toBeNull();
		expect(artikelenGewijzigd(null)).toBeNull();
	});
});

describe('where a failure of the feed is said', () => {
	it('under the list it could not lengthen, or in place of a list it left empty', () => {
		expect(errorPlace('De volgende dagen konden niet worden geladen.', 40)).toBe('below');
		expect(errorPlace('Actueel kon niet worden geladen.', 0)).toBe('instead');
		expect(errorPlace(null, 40)).toBe('none');
		expect(errorPlace(null, 0)).toBe('none');
	});
});
