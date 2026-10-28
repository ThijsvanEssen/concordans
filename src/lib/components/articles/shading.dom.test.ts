// Arceren in the text of an article (O4, besluit 24): the reader's text of every place is the
// text `placeText` counts; words selected open the place's menu by the words, Arceer keeps
// them as a fragment on the place (in Mijn markeringen where it was not kept), and an anchor
// that no longer holds says so in one grey line, never silently.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import art162 from '$lib/fixtures/article-bwbr0005289_162.json';
import art67 from '$lib/fixtures/article-bwbr0001903_67.json';
import art47 from '$lib/fixtures/article-bwbr0001854_47.json';
import { partsOf } from '$lib/text/article-parts';
import { articlePlaces, placeText } from '$lib/text/fragment';
import { PLACE, selectionIn, walkText } from '$lib/actions/selection';
import type { ArticleCitation } from '$lib/text/cite';
import { kaart } from '$lib/map/map.svelte';
import ArticleText from './ArticleText.svelte';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }));

const STORAGE = 'concordans:mappen';
const ID = 'articles/bwbr0005289_162';
const citation = {
	lawId: 'BWBR0005289',
	articleNumber: '6:162',
	citationTitle: 'Burgerlijk Wetboek Boek 6',
	abbreviation: 'BW'
} as unknown as ArticleCitation;
const bewaar = {
	id: ID,
	groep: 'Burgerlijk Wetboek Boek 6',
	wet: 'bwbr0005289',
	versie: '1992-01-01'
};

const EMPTY = {
	mappen: [
		{
			id: 'losse-markeringen',
			naam: 'Mijn markeringen',
			items: [],
			volgorde: 'groep',
			gewijzigd: '2026-10-01T00:00:00Z'
		}
	]
};

/** The article in its reader, with what this browser keeps (read as another tab's write). */
function open(kept: unknown = EMPTY) {
	localStorage.setItem(STORAGE, JSON.stringify(kept));
	window.dispatchEvent(new StorageEvent('storage', { key: STORAGE }));
	return { ...render(ArticleText, { text: art162.article.text, citation, bewaar }), kaart };
}

/** Selects `words` in the place and lets go of the mouse. */
async function select(container: HTMLElement, waar: string, words: string) {
	const el = container.querySelector(`[${PLACE}="${waar}"]`)!;
	const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
	for (let n = tw.nextNode() as Text | null; n; n = tw.nextNode() as Text | null) {
		const i = n.data.indexOf(words);
		if (i < 0) continue;
		const range = document.createRange();
		range.setStart(n, i);
		range.setEnd(n, i + words.length);
		getSelection()!.removeAllRanges();
		getSelection()!.addRange(range);
		el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));
		window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse' }));
		await new Promise((r) => setTimeout(r, 0));
		await tick();
		return;
	}
	throw new Error(`${words} not in ${waar}`);
}

/** A browser's storage in memory. */
const memory = () => {
	const data = new Map<string, string>();
	return {
		getItem: (k: string) => data.get(k) ?? null,
		setItem: (k: string, v: string) => void data.set(k, v),
		removeItem: (k: string) => void data.delete(k)
	};
};

beforeEach(() => {
	vi.stubGlobal('localStorage', memory());
	vi.stubGlobal('sessionStorage', memory());
	// jsdom lays nothing out: a range has no box of its own.
	Range.prototype.getBoundingClientRect ??= () => new DOMRect();
});
afterEach(() => {
	getSelection()?.removeAllRanges();
	vi.unstubAllGlobals();
});

describe('the text of a place on the page', () => {
	it('is the text placeText counts, for every place of an article', () => {
		for (const fixture of [art162, art67, art47]) {
			const text = fixture.article.text;
			const bron = articlePlaces(text, partsOf(text, null));
			const { container, unmount } = render(ArticleText, { text });
			const places = [...container.querySelectorAll<HTMLElement>(`[${PLACE}]`)];
			expect(places.length).toBeGreaterThan(1);
			for (const el of places)
				expect(walkText(el).text, el.getAttribute(PLACE)!).toBe(
					placeText(bron, el.getAttribute(PLACE)!)
				);
			unmount();
		}
	});

	it('a selection over two leden lies in the article; outside the text in none', () => {
		const { container } = render(ArticleText, { text: art162.article.text });
		const root = container.querySelector<HTMLElement>('.article-text')!;
		const [a, b] = ['lid-1', 'lid-2'].map((l) =>
			document
				.createTreeWalker(container.querySelector(`[${PLACE}="${l}"] p`)!, NodeFilter.SHOW_TEXT)
				.nextNode()
		) as Text[];
		const range = document.createRange();
		range.setStart(a, 4);
		range.setEnd(b, 10);
		getSelection()!.addRange(range);
		expect(selectionIn(root)?.place?.id).toBe('artikel');
		const outside = document.createElement('p');
		outside.textContent = 'elders';
		document.body.append(outside);
		range.setEnd(outside.firstChild!, 3);
		getSelection()!.removeAllRanges();
		getSelection()!.addRange(range);
		expect(selectionIn(root)?.place).toBeNull();
	});
});

describe('words selected in a lid', () => {
	it('open the place’s menu by the words, with Arceer and Aantekening', async () => {
		const { container } = open();
		await select(container, 'lid-2', 'ongeschreven recht');
		const menu = screen.getByRole('menu', { name: /^art\. 6:162 lid 2 .*, "ongeschreven recht"$/ });
		expect(menu).toBeTruthy();
		expect(screen.getByRole('menuitem', { name: 'Arceer' })).toBeTruthy();
		expect(screen.getByRole('menuitem', { name: 'Aantekening' })).toBeTruthy();
	});

	it('Arceer keeps the lid in Mijn markeringen with the fragment', async () => {
		const { container, kaart } = open();
		await select(container, 'lid-2', 'ongeschreven recht');
		await fireEvent.click(screen.getByRole('menuitem', { name: 'Arceer' }));
		const [loose] = kaart.mappen;
		expect(loose.items.map((i) => [i.id, i.at, i.versie])).toEqual([[ID, 'lid-2', '1992-01-01']]);
		expect(loose.aantekeningen).toEqual([
			{
				id: expect.stringMatching(/^a-[a-z0-9]{8}$/),
				op: `${ID}#lid-2`,
				fragment: { waar: 'lid-2', exact: 'ongeschreven recht', start: expect.any(Number) }
			}
		]);
	});

	it('Aantekening keeps the words with the note in place in the menu', async () => {
		const { container, kaart } = open();
		await select(container, 'lid-3', 'aan zijn schuld');
		await fireEvent.click(screen.getByRole('menuitem', { name: 'Aantekening' }));
		const field = screen.getByRole('textbox', { name: /^Aantekening bij/ });
		await fireEvent.input(field, { target: { value: 'Schuld, niet risico' } });
		await fireEvent.submit(field.closest('form')!);
		expect(kaart.mappen[0].aantekeningen?.[0]).toMatchObject({
			fragment: { waar: 'lid-3', exact: 'aan zijn schuld' },
			tekst: 'Schuld, niet risico'
		});
	});

	it('hang on the article where the bundel keeps it as a whole', async () => {
		const whole = {
			id: ID,
			at: '',
			kort: 'art. 6:162 BW',
			groep: 'BW',
			groupKey: 'wet:bwbr0005289'
		};
		const { container, kaart } = open({
			mappen: [
				{
					id: 'losse-markeringen',
					naam: 'Mijn markeringen',
					items: [whole],
					volgorde: 'groep',
					gewijzigd: '2026-10-01T00:00:00Z'
				}
			]
		});
		await select(container, 'lid-2', 'ongeschreven recht');
		await fireEvent.click(screen.getByRole('menuitem', { name: 'Arceer' }));
		const [loose] = kaart.mappen;
		expect(loose.items).toHaveLength(1);
		expect(loose.aantekeningen?.[0]).toMatchObject({ op: ID, fragment: { waar: 'lid-2' } });
	});
});

describe('words selected with a finger (A92)', () => {
	const range = (container: HTMLElement, waar: string, words: string) => {
		const el = container.querySelector(`[${PLACE}="${waar}"]`)!;
		const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
		for (let n = tw.nextNode() as Text | null; n; n = tw.nextNode() as Text | null) {
			const i = n.data.indexOf(words);
			if (i < 0) continue;
			const r = document.createRange();
			r.setStart(n, i);
			r.setEnd(n, i + words.length);
			return r;
		}
		throw new Error(`${words} not in ${waar}`);
	};
	const choose = (r: Range) => {
		getSelection()!.removeAllRanges();
		getSelection()!.addRange(r);
		document.dispatchEvent(new Event('selectionchange'));
	};
	const finger = (type: 'touchstart' | 'touchend') =>
		document.dispatchEvent(Object.assign(new Event(type, { bubbles: true }), { touches: [] }));
	const menu = () => screen.queryByRole('menu', { name: /^art\. 6:162/ });

	it('open nothing and scroll nothing while the finger is down; on letting go, its menu', async () => {
		vi.useFakeTimers();
		// The words low on the screen: on letting go they go up, the menu below them.
		const low = vi
			.spyOn(Range.prototype, 'getBoundingClientRect')
			.mockReturnValue(new DOMRect(0, innerHeight - 40, 100, 20));
		const scrolled = vi.fn();
		vi.stubGlobal('scrollBy', scrolled);
		Element.prototype.scrollBy ??= () => {};
		const columns = vi.spyOn(Element.prototype, 'scrollBy').mockImplementation(scrolled);
		try {
			const { container } = open();
			finger('touchstart');
			choose(range(container, 'lid-2', 'ongeschreven'));
			await vi.advanceTimersByTimeAsync(2000);
			expect(menu()).toBeNull();
			expect(scrolled).not.toHaveBeenCalled();

			finger('touchend');
			await vi.advanceTimersByTimeAsync(400);
			expect(
				screen.getByRole('menu', { name: /^art\. 6:162 lid 2 .*, "ongeschreven"$/ })
			).toBeTruthy();
			expect(scrolled).toHaveBeenCalled();
		} finally {
			low.mockRestore();
			columns.mockRestore();
			vi.useRealTimers();
		}
	});

	it('close the menu while the handles drag them on, and open it again with the new words', async () => {
		vi.useFakeTimers();
		try {
			const { container } = open();
			finger('touchstart');
			choose(range(container, 'lid-2', 'ongeschreven'));
			finger('touchend');
			await vi.advanceTimersByTimeAsync(400);
			expect(menu()).toBeTruthy();

			finger('touchstart');
			choose(range(container, 'lid-2', 'ongeschreven recht'));
			await vi.advanceTimersByTimeAsync(0);
			expect(menu()).toBeNull();
			await vi.advanceTimersByTimeAsync(2000);
			expect(menu()).toBeNull();

			finger('touchend');
			await vi.advanceTimersByTimeAsync(400);
			expect(
				screen.getByRole('menu', { name: /^art\. 6:162 lid 2 .*, "ongeschreven recht"$/ })
			).toBeTruthy();
		} finally {
			vi.useRealTimers();
		}
	});
});

describe('an anchor that no longer holds', () => {
	const kept = (fragment: object) => ({
		mappen: [
			{
				id: 'losse-markeringen',
				naam: 'Mijn markeringen',
				items: [
					{
						id: ID,
						at: 'lid-2',
						kort: 'art. 6:162 lid 2 BW',
						groep: 'BW',
						groupKey: 'wet:bwbr0005289'
					}
				],
				volgorde: 'groep',
				gewijzigd: '2026-10-01T00:00:00Z',
				aantekeningen: [{ id: 'a-12345678', op: `${ID}#lid-2`, fragment }]
			}
		]
	});

	it('says where its words are now', async () => {
		const { container } = open(kept({ waar: 'lid-2', exact: 'aan zijn schuld', start: 4 }));
		const lid3 = container.querySelector(`[${PLACE}="lid-3"]`)!;
		expect(lid3.querySelector('.anchor-line')?.textContent?.trim()).toBe('Nu in lid 3');
		// The line is no word of the place.
		expect(walkText(lid3).text).not.toContain('Nu in lid 3');
	});

	it('keeps its words as a quote where none are found, never silently gone', async () => {
		const { container } = open(kept({ waar: 'lid-2', exact: 'zwaarwegend belang', start: 4 }));
		const line = container.querySelector(`[${PLACE}="lid-2"] .anchor-line`)!;
		expect(line.querySelector('q')?.textContent).toBe('zwaarwegend belang');
		expect(line.textContent).toContain('Passage niet meer in de tekst');
	});
});

describe('the note of an arcering (O4 step 6)', () => {
	const bron = articlePlaces(art162.article.text, partsOf(art162.article.text, null));
	const words = 'ongeschreven recht';
	const start = placeText(bron, 'lid-2')!.indexOf(words);
	const map = (id: string, naam: string, fragment: object, tekst = 'Ook ongeschreven') => ({
		id,
		naam,
		items: [
			{ id: ID, at: 'lid-2', kort: 'art. 6:162 lid 2 BW', groep: 'BW', groupKey: 'wet:bwbr0005289' }
		],
		volgorde: 'groep',
		gewijzigd: '2026-10-01T00:00:00Z',
		aantekeningen: [
			{ id: id === 'onderzoek' ? 'a-00000002' : 'a-00000001', op: `${ID}#lid-2`, fragment, tekst }
		]
	});
	const here = { waar: 'lid-2', exact: words, start };

	it('stands under its place at rest, no word of it, in the form of Aantekening', () => {
		const { container } = open({ mappen: [map('losse-markeringen', 'Mijn markeringen', here)] });
		const lid2 = container.querySelector(`[${PLACE}="lid-2"]`)!;
		const note = lid2.querySelector('.noot .aantekening')!;
		expect(note.textContent).toContain('Ook ongeschreven');
		expect(note.querySelector('.label')?.textContent).toBe('Mijn markeringen');
		expect(walkText(lid2).text).toBe(placeText(bron, 'lid-2'));
		expect(container.querySelectorAll('.noot')).toHaveLength(1);
	});

	it('opens the menu of its arcering on a click, where it is changed', async () => {
		const { container, kaart } = open({
			mappen: [map('losse-markeringen', 'Mijn markeringen', here)]
		});
		const button = container.querySelector<HTMLElement>('.noot button')!;
		expect(button.getAttribute('aria-haspopup')).toBe('menu');
		await fireEvent.click(button);
		expect(screen.getByRole('menu', { name: /, "ongeschreven recht"$/ })).toBeTruthy();
		await fireEvent.click(screen.getByRole('menuitem', { name: 'Wijzig aantekening' }));
		const field = screen.getByRole('textbox', { name: /^Aantekening bij/ });
		expect((field as HTMLTextAreaElement).value).toBe('Ook ongeschreven');
		await fireEvent.input(field, { target: { value: 'Ongeschreven recht telt mee' } });
		await fireEvent.submit(field.closest('form')!);
		expect(kaart.mappen[0].aantekeningen?.[0].tekst).toBe('Ongeschreven recht telt mee');
		await tick();
		expect(container.querySelector('.noot')?.textContent).toContain('Ongeschreven recht telt mee');
	});

	it('names its bundel in the label of each note', () => {
		const { container } = open({
			mappen: [
				map('losse-markeringen', 'Mijn markeringen', here),
				map('onderzoek', 'Onderzoek art. 6:162 BW', here, 'Zie ook lid 3')
			]
		});
		expect(
			[...container.querySelectorAll('.noot .label')].map((l) => l.textContent).sort()
		).toEqual(['Mijn markeringen', 'Onderzoek art. 6:162 BW']);
	});

	it('stands under the line of an arcering whose words are no longer found', () => {
		const { container } = open({
			mappen: [
				map('losse-markeringen', 'Mijn markeringen', {
					waar: 'lid-2',
					exact: 'zwaarwegend belang',
					start: 4
				})
			]
		});
		const line = container.querySelector(`[${PLACE}="lid-2"] .anchor-line`)!;
		expect(line.nextElementSibling?.classList.contains('noot')).toBe(true);
		expect(container.querySelectorAll('.noot')).toHaveLength(1);
	});
});
