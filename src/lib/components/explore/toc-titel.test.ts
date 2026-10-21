// The contents beside a stuk and a uitspraak keep the name of the bron while they load, and
// after they failed: the head of the column does not go blank between two bronnen (F6).
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { GraphNode } from '$lib/graph/types';
import DocumentToc from './DocumentToc.svelte';
import JudgmentToc from './JudgmentToc.svelte';

/** The markup without Svelte's hydration comments. */
const html = (body: string) => body.replace(/<!--[^>]*-->/g, '');

const node = (collection: string, key: string, label: string) =>
	({ id: `${collection}/${key}`, collection, key, label, drawClass: 'document' }) as GraphNode;

describe('the contents of a stuk and a uitspraak', () => {
	it('name the bron in their head before the contents are in', () => {
		const stuk = html(
			render(DocumentToc, {
				props: { selection: node('documents', 'kst-36600-3', 'Memorie van toelichting') }
			}).body
		);
		expect(stuk).toMatch(/<h3 class="titel[^"]*">Memorie van toelichting/);
		const uitspraak = html(
			render(JudgmentToc, {
				props: { selection: node('judgments', 'ECLI:NL:HR:2020:1', 'HR 1 januari 2020') }
			}).body
		);
		expect(uitspraak).toMatch(/<h3 class="titel[^"]*">HR 1 januari 2020/);
	});
});
