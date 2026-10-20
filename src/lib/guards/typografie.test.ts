// The serif for text, the sans for controls, three weights, and the quiet line once
// (docs/typografie.md).
import { describe, expect, it } from 'vitest';
import { BRONNEN, bron, isControl, overtreders, plek, regels } from '$lib/test/bronnen';

const VOID = new Set([
	'area',
	'base',
	'br',
	'col',
	'embed',
	'hr',
	'img',
	'input',
	'link',
	'meta',
	'source',
	'track',
	'wbr'
]);

/** The classes of the element right around each Sectie in a component's markup: the parent
 *  whose gap stands between two sections. A Sectie at the top of its file has none here. */
function sectieOuders(text: string): string[][] {
	const markup = text.replace(
		/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g,
		''
	);
	const stack: string[][] = [];
	const found: string[][] = [];
	let i = 0;
	while (i < markup.length) {
		if (markup[i] === '{') {
			// An expression or a block tag: skipped whole, braces counted.
			let depth = 0;
			do {
				if (markup[i] === '{') depth++;
				else if (markup[i] === '}') depth--;
				i++;
			} while (depth > 0 && i < markup.length);
			continue;
		}
		if (markup[i] !== '<') {
			i++;
			continue;
		}
		let j = i + 1;
		let depth = 0;
		while (j < markup.length && (depth > 0 || markup[j] !== '>')) {
			if (markup[j] === '{') depth++;
			else if (markup[j] === '}') depth--;
			j++;
		}
		const tag = markup.slice(i + 1, j);
		i = j + 1;
		const closing = tag.startsWith('/');
		const name = /^\/?([\w:.-]+)/.exec(tag)?.[1] ?? '';
		if (!name || /^[A-Z]/.test(name)) {
			if (name === 'Sectie' && !closing && stack.length) found.push(stack.at(-1)!);
			continue;
		}
		if (closing) stack.pop();
		else if (!tag.endsWith('/') && !VOID.has(name))
			stack.push(/\bclass="([^"{]*)"/.exec(tag)?.[1].split(/\s+/).filter(Boolean) ?? []);
	}
	return found;
}

describe('typography', () => {
	it('sets text in the serif and only controls in the sans (docs/typografie.md, 10 Oct 2026)', () => {
		expect(overtreders((t) => t.includes('var(--font-sans)'))).toEqual([]);
		// The sans only where a control is styled.
		expect(
			overtreders((t) =>
				regels(t).some((r) => r.body.includes('var(--font-ui)') && !isControl(r.selector))
			)
		).toEqual([]);
		// The serif is the page's: a paragraph, a heading, a list or a table, which no control
		// holds, has it without saying so.
		const flow = /(^|[\s>+~])(p|h[1-6]|ul|ol|li|dl|table)(?=$|[.:[\s#])/;
		expect(
			overtreders((t) =>
				regels(t).some(
					(r) =>
						/font-family:\s*var\(--font-serif\)/.test(r.body) &&
						r.selector.split(',').every((part) =>
							flow.test(
								part
									.trim()
									.split(/\s*[>+~]\s*|\s+/)
									.at(-1) ?? ''
							)
						)
				)
			)
		).toEqual([]);
		// Text in three weights: 400, 600, 800. The wordmark is a logo, not a rung.
		expect(
			overtreders(
				(t) =>
					regels(t).some(
						(r) => !isControl(r.selector) && /font-weight:\s*(?!400|600|800)\d+/.test(r.body)
					),
				[plek('lib/components/layout/Wordmark.svelte', 'a logo in its own weight')]
			)
		).toEqual([]);
	});

	it('uses tabular figures only in columns of figures', () => {
		// Tabular figures give a full stop a figure's width: "28 sep . 2026" in a sentence.
		// These files set them on a column of numbers; a new one needs the same reason.
		const columns = [
			'lib/components/articles/VersionCompare.svelte',
			'lib/components/explore/IndexView.svelte',
			'lib/components/explore/index/rows/DecisionRows.svelte',
			'lib/components/explore/ZaalLegenda.svelte',
			'lib/components/explore/readers/CabinetReader.svelte',
			'lib/components/explore/readers/CommitmentReader.svelte',
			'lib/components/explore/readers/DecisionReader.svelte',
			'lib/components/ui/FilterOptie.svelte',
			'lib/components/tijdlijn/Tijdlijn.svelte',
			'lib/components/graph/GraphSidebar.svelte',
			'lib/onderwerpen/Kruiswoord.svelte',
			'routes/(main)/api/+page.svelte',
			'lib/components/explore/index/IndexOverzicht.svelte'
		].map((pad) => plek(pad, 'a column of figures'));
		expect(overtreders((t) => /tabular-nums/.test(t), columns)).toEqual([]);
	});

	it('heads a section of a reader with Sectie, not a grey label', () => {
		expect(overtreders((t) => /class="sec-title"|\.sec-title\b/.test(t))).toEqual([]);
	});

	it('spaces a section in Sectie alone, so every reader gives it the same air', () => {
		expect(bron('lib/components/ui/Sectie.svelte')).toMatch(
			/\.section-block \+ \.section-block\) \{/
		);
		expect(
			overtreders(
				(t) => /:global\(\.(sectie|section-block|inhoud)\b/.test(t),
				[
					plek('lib/components/ui/Sectie.svelte'),
					plek('routes/(main)/onderwerpen/+page.svelte', 'a page of sections, a wider step')
				]
			)
		).toEqual([]);
		// Sectie makes up the step to --s-5 from the gap its parent names: a column of sections
		// with a gap and no --lezer-stap would count both (A10, 20 Oct: 48 became 72px).
		const zonderStap = BRONNEN.filter(({ text }) => text.includes('<Sectie')).flatMap(
			({ path, text }) => {
				const rules = regels(text);
				return sectieOuders(text).flatMap((classes) => {
					const own = rules.filter((r) =>
						classes.some((c) => new RegExp(`\\.${c}(?=$|[\\s,:{])`).test(r.selector))
					);
					const gap = own.some((r) => /(^|[\s;])gap:/.test(r.body));
					const stap = own.some((r) => r.body.includes('--lezer-stap:'));
					return gap && !stap ? [`${path} .${classes.join('.')}`] : [];
				});
			}
		);
		expect(zonderStap).toEqual([]);
	});

	it('says a state where content would be in one quiet line (.stil)', () => {
		// Round 2 of the consistency pass: "Laden…" was italic in the readers and roman on the
		// pages. A row, a caption or the nav column keeps its own smaller line.
		const eigen = /\b(stil|nav-kolom__note|onderschrift|laden|sr-only)\b/;
		const zonder = BRONNEN.flatMap(({ path, text }) =>
			[...text.matchAll(/<p class="([^"]*)"[^>]*>\s*Laden…/g)]
				.filter((m) => !eigen.test(m[1]))
				.map(() => path)
		);
		expect(zonder).toEqual([]);
		expect(
			overtreders((t) =>
				regels(t).some(
					(r) => /\.(loading|leeg|empty|explore-empty)\b/.test(r.selector) && /italic/.test(r.body)
				)
			)
		).toEqual([]);
	});

	it('defines the quiet line once, in the frame: no component styles its own .stil', () => {
		// Code-eenvoud F30: the open rows had a smaller one of their own.
		const own = (text: string) =>
			regels(text).some((r) => r.selector.split(',').some((s) => s.trim() === '.stil'));
		expect(overtreders(own).filter((p) => p.startsWith('lib/components/'))).toEqual([]);
	});

	it('reads what is hidden without taking room: no margin on .sr-only, the live region fixed (#35)', () => {
		expect(bron('lib/styles/basis.css')).toMatch(/\n\.sr-only \{[^}]*margin: 0;/);
		const layout = bron('routes/+layout.svelte');
		expect(layout).toMatch(/class="sr-only aankondiging"/);
		expect(layout).toMatch(/\.aankondiging \{\s*position: fixed;/);
	});

	it('hides text for a screen reader with the one .sr-only', () => {
		expect(
			overtreders(
				(t) => regels(t).some((r) => /clip:\s*rect\(0/.test(r.body)),
				[plek('lib/styles/basis.css', 'the one rule')]
			)
		).toEqual([]);
	});
});
