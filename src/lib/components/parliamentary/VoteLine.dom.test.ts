import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import type { Schema } from '$lib/api/types';
import VoteLine from './VoteLine.svelte';
import Uitkomst from './Uitkomst.svelte';

type Decision = Schema<'DecisionDTO'>;
const stem = (name: string, choice: string, seats: number) => ({
	voter_id: `factions/${name.toLowerCase()}`,
	voter_key: name.toLowerCase(),
	name,
	choice,
	seats,
	path: null
});
const verworpen = {
	key: 'k',
	chamber: 'TK',
	passed: false,
	date: '2026-09-29',
	tally: { Voor: 54, Tegen: 96 },
	votes: [stem('D66', 'Voor', 54), stem('PVV', 'Tegen', 96)]
} as unknown as Decision;

const paint = (props: Record<string, unknown>, component: typeof VoteLine | typeof Uitkomst) =>
	render(component as typeof VoteLine, props).container.innerHTML;
const text = (html: string) => {
	const el = document.createElement('div');
	el.innerHTML = html;
	return (el.textContent ?? '').replace(/[\s\u00a0]+/g, ' ');
};

describe('VoteLine', () => {
	it('says the tally once: in the Stembalk, not also in the line above it', () => {
		const html = paint({ decision: verworpen }, VoteLine);
		expect(html.match(/<b[^>]*>54<\/b>/g)).toHaveLength(1);
		const regel = /<p class="outcome[^>]*>[\s\S]*?<\/p>/.exec(html)?.[0] ?? '';
		expect(text(regel)).toMatch(/Verworpen op 29 september 2026\s*$/);
		expect(text(regel)).not.toMatch(/voor|tegen/);
	});

	it('keeps a choice the Stembalk does not count in the line', () => {
		const html = paint(
			{ decision: { ...verworpen, tally: { Voor: 54, Tegen: 96, 'Niet deelgenomen': 2 } } },
			VoteLine
		);
		expect(text(html)).toMatch(/Verworpen op .*, 2 niet deelgenomen/);
	});

	it('sets the fracties per side in a description list', () => {
		const html = paint({ decision: verworpen }, VoteLine);
		expect(html).toMatch(/<dl class="sides[^"]*">[\s\S]*<dt[^>]*>[\s\S]*<dd[^>]*>[\s\S]*D66/);
		expect(html).not.toMatch(/class="side[ "]/);
	});
});

describe('Uitkomst', () => {
	it('names a box without a word for a screen reader, not only in its title', () => {
		const html = paint({ tone: 'nee' }, Uitkomst);
		expect(html).toMatch(/class="sr-only"[^>]*>verworpen of tegen:/);
		expect(paint({ tone: 'ja', title: 'voor' }, Uitkomst)).toMatch(/sr-only[^>]*>voor:/);
	});

	it('leaves a box unnamed where the words beside it say it, and one with a word as it is', () => {
		expect(paint({ tone: 'nee', title: '' }, Uitkomst)).not.toMatch(/sr-only|title=/);
		expect(paint({ tone: 'ja', woord: 'Aangenomen' }, Uitkomst)).not.toMatch(/sr-only|title=/);
	});
});
