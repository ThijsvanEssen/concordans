// A colour, a radius, a face and an outcome come from the tokens (lib/styles/tokens.css).
import { describe, expect, it } from 'vitest';
import { overtreders, plek, regels } from '$lib/test/bronnen';

describe('the tokens', () => {
	it('takes every colour in a style from the tokens (lib/styles/tokens.css)', () => {
		// A hex or rgb() value in a component is a colour beside the palette. A mask's `black`
		// is not a colour; the canvas and the fracties' own colours live in TypeScript.
		const css = (t: string) =>
			(/<style>([\s\S]*?)<\/style>/.exec(t)?.[1] ?? '').replace(/\/\*[\s\S]*?\*\//g, '');
		expect(
			overtreders(
				(t) => /#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\(/.test(css(t)),
				[plek('lib/styles/tokens.css', 'the tokens themselves')]
			)
		).toEqual([]);
	});

	it('rounds a corner with a radius token', () => {
		const vrij = /^((var\(--r-[\w-]+\)|0)(\s+(var\(--r-[\w-]+\)|0))*|50%|inherit)$/;
		expect(
			overtreders((t) =>
				regels(t).some((r) =>
					[...r.body.matchAll(/border-radius:\s*([^;]+);/g)].some((m) => !vrij.test(m[1].trim()))
				)
			)
		).toEqual([]);
	});

	it('names a face only through its token', () => {
		expect(
			overtreders(
				(t) =>
					regels(t).some((r) =>
						[...r.body.matchAll(/font-family:\s*([^;]+);/g)].some(
							(m) => !/^var\(--font-(serif|ui)\)$/.test(m[1].trim())
						)
					),
				[
					plek('lib/styles/fonts.css', 'the faces themselves'),
					plek('lib/components/layout/Wordmark.svelte', 'a logo in its own face')
				]
			)
		).toEqual([]);
	});

	it('colours an outcome through its tokens, without a second value beside them', () => {
		expect(overtreders((t) => /var\(--uitkomst-(ja|nee),/.test(t))).toEqual([]);
	});
});
