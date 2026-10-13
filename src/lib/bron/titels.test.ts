import { describe, expect, it } from 'vitest';
import { onthoudTitel, titelVan, zonderKopInKapitalen } from './titels.svelte';

describe('titelVan', () => {
	it("keeps a node answer's title by the node's id, whole", () => {
		const title =
			'Motie 36496-71 Bolhuis over een AI-killswitch die over meer dan tachtig tekens gaat';
		onthoudTitel({ node: { id: 'documents/m71' }, title, neighbors: {} });
		expect(titelVan('documents/m71')).toBe(title);
	});

	it('keeps nothing from an answer without a title or a node', () => {
		onthoudTitel({ node: { id: 'documents/leeg' }, title: '  ' });
		onthoudTitel({ title: 'Los' });
		expect(titelVan('documents/leeg')).toBeNull();
	});
});

describe('zonderKopInKapitalen', () => {
	it('leaves a heading of the text in capitals out of the title', () => {
		onthoudTitel({
			node: { id: 'instruments/stb_2026_187' },
			title: 'Stb. 2026, 187: BEGRIPSBEPALING'
		});
		expect(titelVan('instruments/stb_2026_187')).toBe('Stb. 2026, 187');
		expect(zonderKopInKapitalen('Kamerstuk 36764: Memorie van toelichting')).toBe(
			'Kamerstuk 36764: Memorie van toelichting'
		);
		expect(zonderKopInKapitalen('Richtlijn: NIS2')).toBe('Richtlijn: NIS2');
	});
});
