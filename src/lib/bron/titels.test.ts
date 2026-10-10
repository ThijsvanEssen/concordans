import { describe, expect, it } from 'vitest';
import { onthoudTitel, titelVan } from './titels.svelte';

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
