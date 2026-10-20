// Art. 126ffa Sv against art. 2.8.6 of the new code (Stb. 2026, 56): the old text on the left,
// the new on the right, the leden paired as the transposition table places them.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { fakeApi } from '$lib/test/fakeApi';
import ArticleCompare from './ArticleCompare.svelte';

vi.mock('$app/state', async () => (await import('$lib/test/navigation.svelte')).appState);
vi.mock('$app/navigation', async () => (await import('$lib/test/navigation.svelte')).appNavigation);

/** An article text with numbered leden, and its parts as the API delivers them. */
function leden(texts: string[]) {
	let text = '';
	const parts = texts.map((lid, i) => {
		const prefix = `${i + 1}. `;
		if (text) text += '\n';
		const start = text.length + prefix.length;
		text += prefix + lid;
		const number = String(i + 1);
		return {
			id: `lid-${number}`,
			kind: 'lid',
			number,
			start,
			end: start + lid.length,
			text: lid,
			term: null
		};
	});
	return { text, parts };
}

const OLD = leden([
	'De officier van justitie kan een bevel geven.',
	'Het bevel is schriftelijk.',
	'Het bevel vermeldt de gronden.',
	'De rechter-commissaris kan het bevel opheffen.'
]);
const NEW = leden([
	'De officier van justitie kan een schriftelijk bevel geven, dat de gronden vermeldt.',
	'De rechter-commissaris kan het bevel steeds opheffen.'
]);

const HISTORY = '/api/articles/{bwb_id}/{article_number}/history';
const VERSION = '/api/articles/{bwb_id}/{article_number}/history/{version_key}';
const stb = { kind: 'Stb', year: 2026, number: '56', signed: '2026-02-04', dossiers: [] };
const enacted = {
	key: 'stb_2026_56_2_8_6',
	article_number: '2.8.6',
	valid_from: null,
	valid_until: null,
	current: false,
	change: 'establishes',
	text_changed: true,
	changes: [],
	amended_by: stb
};

const api = () =>
	fakeApi({
		[HISTORY]: { article: { key: 'stb_2026_56_2_8_6' }, versions: [enacted] },
		[VERSION]: { ...enacted, ...NEW, tables: [], headings: [] }
	});

const props = (basis: { url: string | null } | null) => ({
	current: {
		name: 'art. 126ffa Sv',
		version: { valid_from: '2024-01-01', amended_by: null },
		...OLD
	},
	target: { law: 'STB-2026-56', number: '2.8.6', name: 'art. 2.8.6 Sv (nieuw)' },
	side: 'old' as const,
	basis,
	pairings: basis
		? [
				{ old: ['1', '2', '3'], new: ['1'] },
				{ old: ['4'], new: ['2'] }
			]
		: [],
	layout: 'naast' as const,
	go: () => {}
});

const TABLE = { url: 'https://zoek.officielebekendmakingen.nl/blg-1081574.html' };

describe('ArticleCompare', () => {
	it('asks the one version of the new article and puts the old text left, the new right', async () => {
		const { asked } = api();
		const { container } = render(ArticleCompare, { props: props(TABLE) });
		await vi.waitFor(() => expect(container.querySelectorAll('.row--changed').length).toBe(1));
		expect(asked(HISTORY)[0].path).toEqual({ bwb_id: 'STB-2026-56', article_number: '2.8.6' });
		expect(asked(VERSION)[0].path?.version_key).toBe('stb_2026_56_2_8_6');

		const heads = [...container.querySelectorAll('.side-head')].map((h) => h.textContent?.trim());
		expect(heads[0]).toMatch(/^Art\. 126ffa Sv, tekst sinds 1 januari 2024/);
		expect(heads[1]).toBe('Art. 2.8.6 Sv (nieuw), Stb. 2026, 56');

		const row = container.querySelector('.row')!.nextElementSibling!;
		const [left, right] = row.querySelectorAll('.row__side');
		expect(left.textContent).toContain('Het bevel is schriftelijk.');
		expect(right.textContent).toContain('dat de gronden vermeldt');
	});

	it('says which leden the transposition table pairs, with the table one step further', async () => {
		api();
		render(ArticleCompare, { props: props(TABLE) });
		const marks = await screen.findAllByRole('link', { name: 'volgens de transponeringstabel' });
		expect(marks).toHaveLength(2);
		expect(marks[0].getAttribute('href')).toBe(TABLE.url);
	});

	it("marks a comparison without a source as the reader's own choice", async () => {
		api();
		const { container } = render(ArticleCompare, { props: props(null) });
		await vi.waitFor(() => expect(container.querySelector('.row__side')).not.toBeNull());
		expect(container.textContent).toContain('eigen keuze');
		expect(container.textContent).not.toMatch(/transponeringstabel/i);
	});
});
