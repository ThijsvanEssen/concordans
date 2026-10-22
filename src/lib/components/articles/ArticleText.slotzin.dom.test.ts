// B10: the sentence that follows the onderdelen of a lid stands after them, as the law prints
// it (Drinkwaterbesluit art. 47 lid 1: the slotzin after a to c), not before.
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import fixture from '$lib/fixtures/article-drinkwaterbesluit-47-lid1.json';
import ArticleText from './ArticleText.svelte';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }));

describe('the text of a lid after its last onderdeel', () => {
	it('stands after the onderdelen', () => {
		const { container } = render(ArticleText, { text: fixture.text, parts: fixture.parts });
		const text = container.textContent!.replace(/\s+/g, ' ');
		const slot = text.indexOf('De verstorings-risicoanalyse wordt met het oog');
		expect(slot).toBeGreaterThan(-1);
		expect(slot).toBeGreaterThan(text.indexOf('nationale dreigingen en scenario'));
		expect(text.indexOf('Van de verstorings-risicoanalyse maken')).toBeLessThan(
			text.indexOf('de risicobeoordeling')
		);
	});
});
