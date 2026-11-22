import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const view = readFileSync(new URL('./GraphView.svelte', import.meta.url), 'utf8');

describe('the states of a bron on the canvas (Netwerkcanvas)', () => {
	it('has no heat: the citations per month are gone with their code', () => {
		expect(view).not.toMatch(/heat/i);
	});
});
