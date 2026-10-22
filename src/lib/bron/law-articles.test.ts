import { describe, expect, it } from 'vitest';
import { fakeApi } from '$lib/test/fakeApi';
import { buildBronHref } from './href';
import { lawAnnexes } from './law-articles';

const annex = (label: string, preview: string | null, title: string | null = null) => ({
	id: `annexes/bwbr0001941_annex_${label.toLowerCase()}`,
	key: `bwbr0001941_annex_${label.toLowerCase()}`,
	label,
	display_name: `Lijst ${label}`,
	title,
	text_preview: preview,
	path: `/wetten/BWBR0001941/bijlage/${label}`
});

describe('the bijlagen of a law in its table of contents (#870)', () => {
	it('lists those with a text of their own, by their heading, each at its address', async () => {
		fakeApi({
			'/api/instruments/{bwb_id}/articles': {
				bwb_id: 'BWBR0001941',
				total: 0,
				division: null,
				items: [],
				annexes: [annex('I', 'A'), annex('II', 'B', 'Middelen'), annex('III', null)]
			}
		});
		const list = await lawAnnexes('BWBR0001941');
		expect(list.map((a) => [a.name, a.title])).toEqual([
			['Lijst I', null],
			['Lijst II', 'Middelen']
		]);
		expect(
			buildBronHref(new URL('https://concordans.nl/'), { collection: 'annexes', key: list[0].key })
		).toBe('/wetten/BWBR0001941/bijlage/I');
	});

	it('asks the list with a preview of one character, to tell a bijlage of articles only', async () => {
		const fake = fakeApi({
			'/api/instruments/{bwb_id}/articles': { bwb_id: 'X', total: 0, division: null, items: [] }
		});
		expect(await lawAnnexes('BWBR0000001')).toEqual([]);
		expect(fake.asked('/api/instruments/{bwb_id}/articles')[0].query).toMatchObject({
			text_preview_chars: 1
		});
	});
});
