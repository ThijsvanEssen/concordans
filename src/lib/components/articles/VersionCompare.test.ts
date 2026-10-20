import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import type { Schema } from '$lib/api/types';
import VersionCompare from './VersionCompare.svelte';

vi.mock('$app/state', () => ({ page: { url: new URL('http://x/') } }));

type Version = Schema<'ArticleVersionListedDTO'>;

const versions = [
	{
		key: 'v1',
		current: false,
		valid_from: '2002-03-21',
		valid_until: '2017-11-17',
		text_changed: true,
		changes: []
	},
	{
		key: 'v2',
		current: true,
		valid_from: '2017-11-17',
		valid_until: null,
		text_changed: true,
		changes: [{ change: 'changed', kind: 'lid', number: '1', term: null }],
		amended_by: {
			kind: 'Stb',
			year: 2017,
			number: '204',
			signed: '2017-06-01',
			published: '2017-06-20',
			dossiers: [{ key: '34000', number: '34000', title: 'Wet scholen' }]
		},
		commencement: { kind: 'Stb', year: 2017, number: '300', published: '2017-07-01' }
	}
] as unknown as Version[];

const html = (param: string) =>
	render(VersionCompare, {
		props: {
			versions,
			bwbId: 'BWBR0001840',
			articleNumber: '23',
			param,
			link: () => '#',
			go: () => {}
		}
	}).body;

/** The text of each herkomst block, tags and comments out, spaces folded. */
function herkomsten(body: string): string[] {
	const out: string[] = [];
	const open = /<span class="herkomst[ "]/g;
	for (let m = open.exec(body); m; m = open.exec(body)) {
		let depth = 0;
		let end = m.index;
		const tag = /<(\/?)span\b[^>]*>/g;
		tag.lastIndex = m.index;
		for (let t = tag.exec(body); t; t = tag.exec(body)) {
			depth += t[1] ? -1 : 1;
			if (depth === 0) {
				end = t.index + t[0].length;
				break;
			}
		}
		out.push(
			body
				.slice(m.index, end)
				.replace(/<!--[\s\S]*?-->/g, '')
				.replace(/<[^>]+>/g, '')
				.replace(/\s+/g, ' ')
				.trim()
		);
	}
	return out;
}

describe('VersionCompare: where a wording came from', () => {
	it('reads the same in the history of a change, of a lid and in the BWB table', () => {
		// The change between A and B, or the lid's history; then the table, where the oldest
		// version came from no publication in the data.
		const all = [...herkomsten(html('')), ...herkomsten(html('lid-1'))].filter(Boolean);
		expect(all).toHaveLength(4);
		expect(all[0]).toBe('Stb. 2017, 204in werking bij Stb. 2017, 300Kamerstuk 34000 Wet scholen');
		expect(new Set(all).size).toBe(1);
	});

	it('names the day it was laid down and published in the title of the publication', () => {
		const body = html('');
		expect(body).toContain('title="vastgesteld 1 juni 2017, uitgegeven 20 juni 2017"');
		expect(body).toContain('title="uitgegeven 1 juli 2017"');
	});
});
