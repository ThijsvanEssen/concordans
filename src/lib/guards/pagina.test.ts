// A page in the frame of Bladeren: one width, one head, one way of scrolling (docs/bediening.md,
// Layout).
import { describe, expect, it } from 'vitest';
import { BRONNEN, bron, overtreders, plek, regels } from '$lib/test/bronnen';

describe('the frame of a page', () => {
	it('scrolls sideways only where it says so: data-zijscroll (lib/dev/zijscroll.ts)', () => {
		// On a phone nothing scrolls sideways; an area that pans on purpose is marked, so the
		// check in development passes it by.
		const pans = /overflow-x:\s*(auto|scroll)/;
		expect(overtreders((t) => pans.test(t) && !t.includes('data-zijscroll'))).toEqual([]);
	});

	it('gives every tab of Bladeren the same width', () => {
		expect(overtreders((t) => /page--wide/.test(t))).toEqual([]);
	});

	it('lays a full-width page in the frame of Bladeren, with no width of its own (docs/bediening.md, Layout)', () => {
		// A page-wide max-width (600 px or more) only in the frame's .blad and the footer.
		const breed = /(?<!@media \(|@container [\w ]*\()max-width:\s*(\d{3,4})px/g;
		const eigen = BRONNEN.filter(
			({ path }) => path.startsWith('routes/(main)') || path.endsWith('IndexOverzicht.svelte')
		).flatMap(({ path, text }) =>
			[...text.matchAll(breed)].filter((m) => Number(m[1]) >= 600).map(() => path)
		);
		expect(eigen).toEqual([]);
		const paginas = BRONNEN.filter(
			({ path }) =>
				/^routes\/\(main\)\/.*\+page\.svelte$/.test(path) || path.endsWith('IndexView.svelte')
		);
		expect(
			paginas.filter(({ text }) => !/class="[^"]*\bblad\b/.test(text)).map((p) => p.path)
		).toEqual([]);
	});

	it('heads every page in the frame with the one head, spaced only by the frame', () => {
		// Thijs, 10 Oct: "een andere verticale uitlijning na de titel". The menu pages and the
		// text pages use .blad__kop and .blad__titel; none styles its h1, its title or its head.
		const menu = [
			'routes/(main)/actueel/+page.svelte',
			'routes/(main)/onderwerpen/+page.svelte',
			'routes/(main)/bundels/+page.svelte',
			'lib/components/explore/index/IndexOverzicht.svelte'
		];
		expect(
			menu.filter((path) => !/class="blad__kop"[\s\S]*?class="blad__titel"/.test(bron(path)))
		).toEqual([]);
		// Every h1 of a page is the one title, the start page's too; the network's for a screen
		// reader only.
		const anders = overtreders((t) =>
			[...t.matchAll(/<h1\b[^>]*>/g)].some((m) => !/class="blad__titel( sr-only)?"/.test(m[0]))
		).filter((p) => /^(routes\/|uitzondering )/.test(p));
		expect(anders).toEqual([]);
		const eigen = overtreders(
			(t) =>
				t.includes('blad__kop') &&
				regels(t).some((r) =>
					/(^|[\s,>])(h1|\.blad__kop|\.blad__titel|\.kop|\.titel|\.title)$/.test(r.selector.trim())
				),
			[plek('lib/styles/frame.css', 'the head itself')]
		);
		expect(eigen).toEqual([]);
	});

	it('lays the bundels in the frame of the menu pages, not as a text page (Thijs, 20 Oct)', () => {
		// The overview, a bundel's page and a shared bundel: the head over both columns, its
		// actions in .blad__acties at the right, what they list in the list column.
		const paginas = [
			'routes/(main)/bundels/+page.svelte',
			'routes/(main)/bundels/[id]/+page.svelte'
		];
		for (const path of paginas) expect(bron(path), path).not.toContain('blad--tekst');
		const overzicht = bron('routes/(main)/bundels/+page.svelte');
		expect(overzicht).toMatch(/class="[^"]*\bblad blad__indeling"/);
		expect(overzicht).toMatch(/class="blad__acties"/);
		expect(overzicht).toMatch(/class="blad__lijst"/);
		const view = bron('lib/map/MapView.svelte');
		expect(view).toMatch(/<article class="bundel blad__indeling"/);
		expect(view).toMatch(/class="blad__acties"/);
		expect(view).toMatch(/class="inhoud blad__lijst"/);
	});

	it('puts the actions of a head in .blad__acties, none in a bar of its own', () => {
		// After A38: Actueel and Gevolgd had their own .acties; the head's actions are one form.
		const eigen = /class="(?:[^"]*\s)?acties[\s"]/;
		expect(
			overtreders(
				(t) =>
					t.includes('blad__kop') &&
					(eigen.test(t) ||
						regels(t).some((r) => r.selector.split(',').some((s) => /\.acties\b/.test(s))))
			)
		).toEqual([]);
		for (const path of [
			'routes/(main)/actueel/+page.svelte',
			'routes/(main)/onderwerpen/+page.svelte',
			'routes/(main)/bundels/+page.svelte',
			'lib/map/MapView.svelte'
		])
			expect(bron(path), path).toMatch(/class="blad__acties"/);
	});

	it('starts the Inhoudsopgave of a bundel on its first group, not on what stands over it', () => {
		// As Bronnen and Gevolgd: what stands over the groups is a row of its own.
		expect(bron('lib/map/MapView.svelte')).toMatch(
			/class="voor blad__lijst"[\s\S]*<Inhoudsopgave[\s\S]*class="inhoud blad__lijst"/
		);
	});

	it('lists the groups of a page in its left column through one component (Inhoudsopgave)', () => {
		// Bronnen, Gevolgd and a bundel's page (Thijs, 20 Oct: "zoals de indeling bij Bronnen").
		expect(
			overtreders((t) => /class="opzij\b/.test(t), [plek('lib/components/ui/Inhoudsopgave.svelte')])
		).toEqual([]);
		for (const path of [
			'lib/components/explore/index/IndexOverzicht.svelte',
			'routes/(main)/onderwerpen/+page.svelte',
			'lib/map/MapView.svelte'
		])
			expect(bron(path), path).toContain('<Inhoudsopgave');
		// The overview of the bundels has none: its rows are the bundels.
		expect(bron('routes/(main)/bundels/+page.svelte')).not.toContain('<Inhoudsopgave');
	});

	it('keeps the footer under the fold and a late band in its place (no layout shift)', () => {
		// Live, 10 Oct: the footer jumped into view on every page when the server's page gave
		// way to the app (0.22 to 0.37 of layout shift), and Actueel dropped under the
		// Wetsnetwerk band on the home page (0.16).
		expect(bron('routes/(main)/+layout.svelte')).toMatch(
			/class="blad-hoogte"[\s\S]*min-height: 100dvh/
		);
		expect(bron('routes/(main)/+page.svelte')).toMatch(
			/\{#if lawNetwork \|\| networkLoading\}[\s\S]*wetsnetwerk-plek/
		);
	});

	it('names the page a subpage belongs to as a crumb: one link, as a reader’s band', () => {
		const kruimels = BRONNEN.flatMap(({ path, text }) =>
			[...text.matchAll(/<(\w+) class="stub-eyebrow"[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => ({
				path,
				tag: m[1],
				inhoud: m[2]
			}))
		);
		expect(kruimels.length).toBeGreaterThan(0);
		expect(
			kruimels
				.filter(
					(k) =>
						k.tag !== 'nav' || !/^<a href=(?:"[^"]+"|\{[\w.]+\})>[^<]+<\/a>$/.test(k.inhoud.trim())
				)
				.map((k) => k.path)
		).toEqual([]);
	});

	it('styles the parts of a text page once, in the frame (.blad--tekst)', () => {
		const delen =
			/^\.(stub-eyebrow|stub-lede|section|section-title|cite|meta-row|meta-link|updated)(:hover)?$/;
		expect(
			BRONNEN.filter(({ path }) => path.startsWith('routes/(main)'))
				.filter(({ text }) =>
					regels(text).some((r) => r.selector.split(',').some((s) => delen.test(s.trim())))
				)
				.map((s) => s.path)
		).toEqual([]);
	});
});

describe('a text page', () => {
	it('heads its parts with Sectie, not a heading of its own', () => {
		expect(
			BRONNEN.filter(({ path }) => path.startsWith('routes/(main)'))
				.filter(({ text }) => /class="section(-title)?"/.test(text))
				.map((s) => s.path)
		).toEqual([]);
	});

	it('lists key and value with KeyList, which breaks a long value on a phone', () => {
		// Three copies drifted apart: /docs did not stack, and its addresses ran past their row
		// at 375 px, cut off (code-eenvoud F24).
		expect(overtreders((t) => /\blist-row\b|\blist-k\b/.test(t))).toEqual([]);
	});

	it('keeps the anchors other pages link to', () => {
		const anchors: [string, string[]][] = [
			['routes/(main)/(prose)/over/+page.svelte', ['contact']],
			['routes/(main)/(prose)/bronnen/+page.svelte', ['herkomst', 'dekking', 'hergebruik']],
			['routes/(main)/docs/methode/+page.svelte', ['betrouwbaarheid', 'grenzen']]
		];
		for (const [path, ids] of anchors)
			for (const id of ids) expect(bron(path), `${path}#${id}`).toContain(`id="${id}"`);
	});
});
