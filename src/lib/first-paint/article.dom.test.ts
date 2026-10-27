// The first paint of an article: the app's elements and words, the room of what comes later.
import { readFileSync } from 'node:fs';
import { langeDatum } from '$lib/text/datum';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	ARTICLES_SOURCE,
	articleColumn,
	articlePaint,
	paintable,
	type ArticlePaint
} from './article';
import { COMPONENTS, type Classes } from './classes';
import { frame } from './paint';

/** Each component's class as the build would give it, here its own name. */
const K = Object.fromEntries(Object.keys(COMPONENTS).map((n) => [n, `K-${n}`])) as Classes;

const TEXT =
	'1. Wie schade lijdt, krijgt die vergoed.\n2. Dit geldt:\na. bij opzet;\nb. bij schuld.';
const ARTICLE: ArticlePaint = {
	kind: 'article',
	article: {
		law_id: 'BWBR0005289',
		bwb_id: 'BWBR0005289',
		article_number: '162',
		label: 'Artikel 162',
		text: TEXT,
		parts: [],
		validity: { state: 'in_force', date: null, as_of: null, successors: [] }
	},
	instrument: { bwb_id: 'BWBR0005289', display_name: 'Burgerlijk Wetboek Boek 6' },
	versions: [
		{
			key: 'v1',
			valid_from: '1992-01-01',
			valid_until: null,
			current: true,
			change: 'establishes',
			text_changed: true,
			changes: [],
			amended_by: {
				dossiers: [{ key: '17541', number: '17541', exists: true, path: '/dossiers/17541' }]
			} as never
		}
	],
	law: {
		collection: 'instruments',
		key: 'bwbr0005289',
		display_name: 'Burgerlijk Wetboek Boek 6',
		props: { kind: 'wet', citation_title: 'Burgerlijk Wetboek Boek 6', bwb_id: 'BWBR0005289' }
	},
	node: {
		breadcrumb: [
			{ type: 'titeldeel', label: 'Titel 3', title: 'Onrechtmatige daad' },
			{ type: 'afdeling', label: 'Afdeling 1', title: 'Algemene bepalingen' }
		],
		instrument_citation_title: 'Burgerlijk Wetboek Boek 6'
	},
	steps: { listed: true, prev: true, next: true },
	delegations: []
};

const html = (v: ArticlePaint = ARTICLE) => {
	const doc = new DOMParser().parseFromString(`<div>${articleColumn(v, K)}</div>`, 'text/html');
	return doc.body.firstElementChild!;
};

describe('the first paint of an article', () => {
	it('titles it as its reader does, by its record: a BW article by its book and code', () => {
		const h1 = html().querySelector('h1.reader-title.K-head')!;
		expect(h1.textContent).toBe('Artikel 6:162 BW');
		// A break may fall after the colon, as in the reader.
		expect(h1.innerHTML).toBe('Artikel 6:<wbr>162 BW');
	});

	it('sets the leden with their number in the margin, the onderdelen with theirs', () => {
		const leden = [...html().querySelectorAll('.article-text > .lid.K-text')];
		expect(leden.map((l) => l.querySelector('.lid__no')!.textContent)).toEqual(['1.', '2.']);
		const onderdelen = leden[1].querySelectorAll('.part--onderdeel .part__number');
		expect([...onderdelen].map((n) => n.textContent)).toEqual(['a.', 'b.']);
		expect(leden[0].querySelector('p.K-text')!.textContent).toBe(
			'Wie schade lijdt, krijgt die vergoed.'
		);
	});

	it('marks an onderdeel of an act of the EU as the EU does', () => {
		const eu = html({
			...ARTICLE,
			article: { ...ARTICLE.article, law_id: '32016R0679', bwb_id: null }
		});
		expect(eu.querySelector('.part__number')!.textContent).toBe('a)');
	});

	it('keeps the room of what the app adds, unseen: band, place, status, actions, origin', () => {
		const col = html();
		for (const selector of [
			'.kop-rij__band',
			'.reader-place',
			'.reader-nav',
			'.reader-facts',
			'.reader-status__acties',
			'.reader-rijen'
		])
			expect(col.querySelector(selector)?.hasAttribute('data-later'), selector).toBe(true);
		expect(col.querySelector('.reader-title')!.closest('[data-later]')).toBeNull();
		expect(col.querySelector('.article-text')!.closest('[data-later]')).toBeNull();
	});

	it('says in that room what the reader says: its status, its place, its band, its origin', () => {
		const col = html();
		// The stand of a holding article is the strip of its facts, as the law's (A190).
		expect(col.querySelector('.head__stand')).toBeNull();
		expect(col.querySelector('.reader-facts')!.textContent).toContain(
			`Tekst sinds${langeDatum('1992-01-01')}`
		);
		expect(col.querySelector('.reader-place')!.textContent).toBe('Algemene bepalingen');
		expect(col.querySelector('.behoort .term')!.textContent).toBe('Wet');
		expect([...col.querySelectorAll('.lagen .vol')].map((l) => l.textContent)).toEqual([
			'Burgerlijk Wetboek Boek 6',
			'Titel 3 Onrechtmatige daad',
			'Afdeling 1 Algemene bepalingen'
		]);
		expect(col.querySelector('.head__item')!.textContent).toBe('Vastgesteld bij Dossier 17541');
	});

	it('names an article its law does not list (a repealed one) by its kind, without steps', () => {
		const col = html({ ...ARTICLE, steps: { listed: false, prev: false, next: false } });
		expect(col.querySelector('.reader-place')).toBeNull();
		expect(col.querySelector('.reader-kind')!.textContent).toBe(
			'Artikel, Burgerlijk Wetboek Boek 6'
		);
		expect(col.querySelector('.reader-nav')).toBeNull();
	});

	it('sets a formula of delegation as the one control it is in the reader', () => {
		const start = TEXT.indexOf('vergoed');
		const col = html({ ...ARTICLE, delegations: [{ start, end: start + 'vergoed'.length }] });
		expect(col.querySelector('.ev-formula')!.textContent).toBe('vergoed');
	});

	it('paints only what it sets as the app does: no table, no footnote, no empty text', () => {
		expect(paintable(ARTICLE.article)).toBe(true);
		expect(paintable({ ...ARTICLE.article, tables: [{}] })).toBe(false);
		expect(paintable({ ...ARTICLE.article, footnote_marks: [{}] })).toBe(false);
		expect(paintable({ ...ARTICLE.article, text: ' ' })).toBe(false);
		expect(articlePaint({ ...ARTICLE, article: { ...ARTICLE.article, text: '' } }, K)).toBeNull();
	});

	it('stands in the reading view: contents, the reader, Verbonden; the tab Inhoud on a phone', () => {
		const doc = new DOMParser().parseFromString(frame('<p>tekst</p>', K, true), 'text/html');
		const read = doc.querySelector('.explore-read.explore-read--with-nav.K-page')!;
		expect([...read.children].map((c) => [...c.classList].slice(0, 2).join(' '))).toEqual([
			'mobile-tabs K-page',
			'col col--nav',
			'col col--reader',
			'resize-handle resize-handle--panel',
			'col col--panel'
		]);
		expect(read.querySelector('.col--reader .reader-frame.K-frame p')!.textContent).toBe('tekst');
		// Without contents (a law of one article): no Inhoud, the column kept hidden; the phone's
		// tabs Tekst and Verbonden stand (A197-a).
		const bare = new DOMParser().parseFromString(frame('', K, false), 'text/html');
		expect(bare.querySelector('.explore-read--with-nav, .mobile-tab--toc')).toBeNull();
		expect(bare.querySelectorAll('.lees-tabs [role="group"] button')).toHaveLength(2);
		expect(bare.querySelector<HTMLElement>('.col--nav')!.hidden).toBe(true);
	});

	it('names the source of the band as the app does', async () => {
		const { sourceOfCollection } = await import('$lib/nav/sources');
		expect(ARTICLES_SOURCE).toBe(sourceOfCollection('articles').label);
	});
});

describe('the classes of the paint', () => {
	// Each class the paint sets on an element of a component stands in that component: a
	// class renamed in the app is renamed here too, or this fails.
	const source = (name: keyof typeof COMPONENTS) =>
		readFileSync(join(process.cwd(), COMPONENTS[name]), 'utf8');
	const doc = new DOMParser().parseFromString(
		frame(
			articleColumn(
				{
					...ARTICLE,
					versions: [...ARTICLE.versions!, { ...ARTICLE.versions![0], key: 'v2' }],
					explained: [
						{ target: 'article', scope: 'article', document: { key: 'd', kind: 'Toelichting' } }
					],
					completeness: { references: { state: 'partial', missing: 2 } }
				},
				K
			),
			K,
			true
		),
		'text/html'
	);

	it.each(Object.keys(COMPONENTS) as (keyof typeof COMPONENTS)[])('%s', (name) => {
		const own = source(name);
		const classes = new Set(
			[...doc.querySelectorAll(`.K-${name}`)].flatMap((el) =>
				[...el.classList].filter((c) => !c.startsWith('K-') && !c.startsWith('ev-'))
			)
		);
		for (const c of classes) {
			const base = c.replace(/--[a-z-]+$/, '--');
			expect(own.includes(c) || own.includes(`${base}{`), `${c} in ${COMPONENTS[name]}`).toBe(true);
		}
	});
});
