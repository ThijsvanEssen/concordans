// The grondslag in the head of a regulation: the articles it rests on as links, the sentence
// once on the page (not again beside it), a second law one click away.
import { fireEvent, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeApi } from '$lib/test/fakeApi';
import { open } from '$lib/test/navigation.svelte';
import fixture from '$lib/test/law-paint.json';
import WholeLawReader from './WholeLawReader.svelte';

vi.mock('$app/state', async () => (await import('$lib/test/navigation.svelte')).appState);
vi.mock('$app/navigation', async () => (await import('$lib/test/navigation.svelte')).appNavigation);

const wet = (key: string, naam: string, nrs: [string, string[]][]) => ({
	instrument: { ...fixture.instrument, id: `instruments/${key}`, key, citation_title: naam },
	kind: 'amvb',
	expired_on: null,
	basis_kind: 'delegates',
	articles: nrs.map(([nr, leden]) => ({
		key: `${key}_${nr}`,
		article_number: nr,
		leden,
		onderdelen: []
	}))
});

async function settle() {
	for (let i = 0; i < 20; i++) {
		await new Promise((r) => setTimeout(r, 0));
		await tick();
	}
}

const zinnen = (el: Element) =>
	[...el.querySelectorAll('p.whole-count')].filter((p) =>
		/^\s*Op grond van\b/.test(p.textContent!)
	);

describe('the grondslag in the head of a regulation', () => {
	beforeEach(() => {
		vi.stubGlobal(
			'IntersectionObserver',
			class {
				observe() {}
				disconnect() {}
			}
		);
		open('/wetten/BWBR0052884');
	});
	afterEach(() => vi.unstubAllGlobals());

	const toon = async (items: unknown[]) => {
		fakeApi({
			'/api/instruments/{identifier}': {
				...fixture.instrument,
				kind: 'ministeriele-regeling',
				bwb_id: 'BWBR0052884'
			},
			'/api/instruments/{bwb_id}/articles': fixture.articles,
			'/api/instruments/{bwb_id}/articles/at/{at_date}': fixture.at,
			'/api/instruments/{bwb_id}/versions': { items: [] },
			'/api/instruments/{bwb_id}/basis': { bwb_id: 'BWBR0052884', total: items.length, items },
			'/api/instruments': { items: [] }
		});
		const { container } = render(WholeLawReader, { bwbId: 'BWBR0052884' });
		await settle();
		return container;
	};

	it('says the articles as links, once on the page', async () => {
		const c = await toon([
			wet('bwbr0052875', 'Cyberbeveiligingsbesluit', [
				['19', []],
				['23', ['1']],
				['28', []]
			])
		]);
		const zin = zinnen(c);
		expect(zin).toHaveLength(1);
		expect(zin[0].textContent!.replace(/\s+/g, ' ').trim()).toBe(
			'Op grond van art. 19, 23 lid 1 en 28 van het Cyberbeveiligingsbesluit.'
		);
		expect([...zin[0].querySelectorAll('a')].map((a) => a.textContent)).toEqual([
			'19',
			'23 lid 1',
			'28',
			'Cyberbeveiligingsbesluit'
		]);
	});

	it('names the first law and opens the rest in place', async () => {
		const c = await toon([
			wet('bwbr0052875', 'Cyberbeveiligingsbesluit', [['19', []]]),
			wet('bwbr0026338', 'Drinkwaterwet', [['3', []]])
		]);
		expect(zinnen(c)[0].textContent).not.toContain('Drinkwaterwet');
		await fireEvent.click(c.querySelector('p.whole-count button')!);
		expect(zinnen(c)).toHaveLength(1);
		expect(zinnen(c)[0].textContent!.replace(/\s+/g, ' ')).toContain('art. 3 van de Drinkwaterwet');
	});
});
