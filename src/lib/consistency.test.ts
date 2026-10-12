// What was made one in the polish of October 2026 stays one. Each rule names where the one
// form lives, so a new page uses it instead of a second version beside it.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(process.cwd(), 'src');

function files(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return files(path);
		return /\.(svelte|ts|css)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
	});
}

const sources = files(ROOT)
	.filter((path) => !path.includes(`${join('lib', 'api', 'generated')}`))
	.map((path) => ({ path: relative(ROOT, path), text: readFileSync(path, 'utf8') }));

const offenders = (test: (text: string) => boolean, allowed: string[] = []) =>
	sources.filter(({ path, text }) => !allowed.includes(path) && test(text)).map((s) => s.path);

// The rules of each style block, comments left out: a control is a rule whose subject is a
// button, a field, a key, a choice row, a tab or a menu item.
const CTL_EL = /(^|[\s>+~(,])(button|input|select|textarea|kbd|option|summary)(?=$|[.:[\s#)])/;
const CTL_CLS =
	/\.(?:[\w-]*(?:btn|knop|keuze|toggle|switch|segment|trigger|veld|field|input|menu__item|menuitem|kbd|nav-link)[\w-]*|(?:[\w-]*-)?tabs?(?:[-_][\w-]*)?|act(?:--[\w-]+|__[\w-]+)?)(?=$|[.:[\s#)>+~,])/;
const isControl = (selector: string) =>
	selector.split(',').every((part) => {
		const p = part.replace(/:global\(([^)]*)\)/g, '$1').trim();
		const subject = p.split(/\s*[>+~]\s*|\s+/).at(-1) ?? p;
		return CTL_EL.test(' ' + subject) || CTL_CLS.test(subject);
	});
const rules = (text: string) => {
	const css = /<style>([\s\S]*?)<\/style>/.exec(text)?.[1] ?? '';
	return [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
		selector: m[1].trim(),
		body: m[2]
	}));
};

/**
 * The places that keep an older form, each named with why and until when: an entry comes
 * out when its page is rebuilt to docs/bediening.md (the steps of 9-bediening, Thijs, 10 Oct).
 */
type Uitzonderingen = Record<string, string>;
const buiten = (u: Uitzonderingen) => Object.keys(u);

describe('one form for each thing', () => {
	it('formats a date only in $lib/text/datum.ts', () => {
		const dateFormat = /toLocaleDateString|Intl\.DateTimeFormat|\btoLocaleTimeString\b/;
		const monthNames = /['"](januari|jan\.)['"]/;
		expect(
			offenders((t) => dateFormat.test(t) || monthNames.test(t), ['lib/text/datum.ts'])
		).toEqual([]);
	});

	it('formats a figure only in $lib/text/getal.ts, and takes today from datum.ts', () => {
		const eigen: Uitzonderingen = {
			'lib/text/getal.ts': 'the one place'
		};
		expect(offenders((t) => /\.toLocaleString\(/.test(t), buiten(eigen))).toEqual([]);
		// The UTC day is yesterday between midnight and two; vandaag() is the reader's own day.
		expect(offenders((t) => /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/.test(t))).toEqual([]);
	});

	it('fills no missing value with a sign: Waarde leaves it empty, Veld drops the row', () => {
		// "—" or "–" as a value reads as a fact ("unknown") where the data only lacks it.
		const sign = /['"`>][—–]['"`<]/;
		expect(offenders((t) => sign.test(t))).toEqual([]);
	});

	it('heads a section of a reader with Sectie, not a grey label', () => {
		expect(offenders((t) => /class="sec-title"|\.sec-title\b/.test(t))).toEqual([]);
	});

	it('reads what is hidden without taking room: no margin on .sr-only, the live region fixed (#35)', () => {
		const shell = sources.find((s) => s.path === 'lib/components/layout/AppShell.svelte')!.text;
		expect(shell).toMatch(/:global\(\.sr-only\) \{[^}]*margin: 0;/);
		const layout = sources.find((s) => s.path === 'routes/+layout.svelte')!.text;
		expect(layout).toMatch(/class="sr-only aankondiging"/);
		expect(layout).toMatch(/\.aankondiging \{\s*position: fixed;/);
	});

	it('scrolls sideways only where it says so: data-zijscroll (lib/dev/zijscroll.ts)', () => {
		// On a phone nothing scrolls sideways; an area that pans on purpose is marked, so the
		// check in development passes it by.
		const pans = /overflow-x:\s*(auto|scroll)/;
		expect(offenders((t) => pans.test(t) && !t.includes('data-zijscroll'))).toEqual([]);
	});

	it('gives every tab of Bladeren the same width', () => {
		expect(offenders((t) => /page--wide/.test(t))).toEqual([]);
	});

	it('colours an outcome through its tokens, without a second value beside them', () => {
		expect(offenders((t) => /var\(--uitkomst-(ja|nee),/.test(t))).toEqual([]);
	});

	it('uses tabular figures only in columns of figures', () => {
		// Tabular figures give a full stop a figure's width: "28 sep . 2026" in a sentence.
		// These files set them on a column of numbers; a new one needs the same reason.
		const columns = [
			'lib/components/articles/VersionCompare.svelte',
			'lib/components/explore/IndexView.svelte',
			'lib/components/explore/ZaalLegenda.svelte',
			'lib/components/explore/index/IndexFacets.svelte',
			'lib/components/explore/readers/CabinetReader.svelte',
			'lib/components/explore/readers/CommitmentReader.svelte',
			'lib/components/explore/readers/DecisionReader.svelte',
			'lib/components/ui/FilterOptie.svelte',
			'lib/components/tijdlijn/Tijdlijn.svelte',
			'lib/components/graph/GraphSidebar.svelte',
			'lib/onderwerpen/Kruiswoord.svelte',
			'routes/(main)/api/+page.svelte',
			'routes/(main)/onderwerpen/overzicht/+page.svelte',
			'routes/(main)/(prose)/bronnen/+page.svelte',
			'lib/components/explore/index/IndexOverzicht.svelte'
		];
		expect(offenders((t) => /tabular-nums/.test(t), columns)).toEqual([]);
	});

	it('opens a row in place on one click, through the shared rule', () => {
		// A row whose title is a link to the bron (Actueel, the table) takes the click through
		// terPlekke ($lib/actions/klik), so a plain click opens the row and a cmd-click goes to
		// the bron. A row of Verbonden has no panel (Thijs, 10 Oct): its title and the row
		// itself go to the bron in Netwerk.
		const rows = sources.filter(({ text }) =>
			/class="(row-title|row__title)"[\s\S]{0,80}(href=|\{href\})/.test(text)
		);
		expect(rows.length).toBeGreaterThan(0);
		const verbonden = (path: string) => path.endsWith('verbonden/Verbonden.svelte');
		expect(
			rows
				.filter(({ text, path }) => !verbonden(path) && !text.includes('terPlekke'))
				.map((s) => s.path)
		).toEqual([]);
		expect(rows.filter(({ text, path }) => verbonden(path) && text.includes('terPlekke'))).toEqual(
			[]
		);
	});

	it('marks a line of a timeline with the shape of its kind (vormen.ts), as Verbonden and the network do', () => {
		// The Tijdlijn draws only from VORMEN, no circle or square of its own.
		const tijdlijn = sources.find((s) => s.path === 'lib/components/tijdlijn/Tijdlijn.svelte')!;
		expect(tijdlijn.text).toMatch(/VORMEN\[/);
		expect(tijdlijn.text).not.toMatch(/class="teken"|border-radius:\s*50%/);
		// Required on Actueel's line, so the compiler holds every builder to it.
		const actueel = sources.find((s) => s.path === 'lib/components/actueel/timeline.ts')!;
		expect(actueel.text).toMatch(/\n\tvorm: Vorm;/);
	});

	it('shows every series of dated lines in the one Tijdlijn (tijdlijn-voorstel, Thijs 11 Oct: "Ja, beide")', () => {
		// Actueel and a followed topic, the homepage, the procedure of a dossier, a post in
		// Bladeren, the toezeggingen, Loopbaan and Commissies of a lid, and the changes of an
		// article between A and B: one form, gelijke pagina's, gelijke ervaring.
		const tonen = [
			'lib/components/actueel/FeedDay.svelte',
			'lib/components/parliamentary/BewindspersoonOverzicht.svelte',
			'lib/components/explore/readers/MemberReader.svelte',
			'lib/components/articles/VersionCompare.svelte',
			'lib/components/open/OpenRij.svelte',
			'lib/components/explore/readers/DossierReader.svelte',
			'routes/(main)/+page.svelte'
		];
		const tekst = (path: string) => sources.find((s) => s.path === path)!.text;
		expect(
			tonen.filter((p) => !tekst(p).includes("import Tijdlijn from '$lib/components/tijdlijn/"))
		).toEqual([]);
		// The forms they had of their own are gone.
		expect(
			offenders((t) => /class="career"|history__table|\.formulation::before|<FeedEntry/.test(t))
		).toEqual([]);
		// No list draws a line with dots of its own beside the Tijdlijn.
		const stippen = (t: string) =>
			rules(t).some(
				(r) =>
					/(li|item|step|regel|formulation)[\w-]*::before/.test(r.selector) &&
					/border-radius:\s*50%/.test(r.body)
			);
		expect(offenders(stippen, ['lib/components/tijdlijn/Tijdlijn.svelte'])).toEqual([]);
		// Its date column holds a day and month (the year under it) or a term's years, no more.
		const tl = tekst('lib/components/tijdlijn/Tijdlijn.svelte');
		expect(tl).toMatch(/dagMaand\(/);
		expect(tl).toMatch(/yearsOf\(/);
		expect(tl).not.toMatch(/korteDatum|langeDatum|longDate|formatDate|formatLongDate|maandJaar/);
	});

	it('draws every horizontal time figure on the one Tijdas, a period in small with Strookje (horizontaal-4, Thijs 12 Oct)', () => {
		const tekst = (path: string) => sources.find((s) => s.path === path)!.text;
		// The posts of a cabinet, the cabinets and the seats: one axis, one way of naming phases.
		const figuren = [
			'lib/components/explore/index/CabinetOccupancy.svelte',
			'lib/components/explore/index/KabinettenStrook.svelte',
			'lib/components/explore/readers/KamerZetels.svelte'
		];
		expect(
			figuren.filter((p) => !tekst(p).includes("import Tijdas from '$lib/components/tijdlijn/"))
		).toEqual([]);
		expect(
			offenders((t) => /\b(ticksOf|cabTicks)\(|class="(cab-axis|phase-label)"/.test(t))
		).toEqual([]);
		// A period in small (the posts on a phone, Naast elkaar) is the Strookje, no bar of its own.
		for (const p of [
			'lib/components/explore/index/CabinetOccupancy.svelte',
			'lib/components/explore/index/NaastPosten.svelte'
		])
			expect(tekst(p)).toContain("import Strookje from '$lib/components/tijdlijn/Strookje.svelte'");
		// In rest quiet, a stand-in dotted: no fading bar, no italics, no opacity on a line.
		const lijnen = [
			...figuren,
			'lib/components/explore/index/NaastPosten.svelte',
			'lib/components/tijdlijn/Tijdas.svelte',
			'lib/components/tijdlijn/Fasen.svelte',
			'lib/components/tijdlijn/Strookje.svelte'
		];
		expect(
			lijnen.filter((p) =>
				rules(tekst(p)).some((r) => /linear-gradient|font-style:\s*italic|opacity:/.test(r.body))
			)
		).toEqual([]);
	});

	it('styles the terms of a Tijdlijn by child combinators, so a Tijdlijn opened in a term keeps its own form', () => {
		const tl = sources.find((s) => s.path === 'lib/components/tijdlijn/Tijdlijn.svelte')!.text;
		const perioden = rules(tl).filter((r) => r.selector.includes('.perioden '));
		expect(perioden.length).toBeGreaterThan(0);
		expect(
			perioden.filter((r) => !/^\.perioden > \.groep > \.regels > \.regel\b/.test(r.selector))
		).toEqual([]);
	});

	it('lays a full-width page in the frame of Bladeren, with no width of its own (docs/bediening.md, Layout)', () => {
		// A page-wide max-width (600 px or more) only in AppShell's .blad and the footer.
		const breed = /(?<!@media \(|@container [\w ]*\()max-width:\s*(\d{3,4})px/g;
		const eigen = sources
			.filter(
				({ path }) => path.startsWith('routes/(main)') || path.endsWith('IndexOverzicht.svelte')
			)
			.flatMap(({ path, text }) =>
				[...text.matchAll(breed)].filter((m) => Number(m[1]) >= 600).map(() => path)
			);
		expect(eigen).toEqual([]);
		const paginas = sources.filter(
			({ path }) =>
				/^routes\/\(main\)\/.*\+page\.svelte$/.test(path) || path.endsWith('IndexView.svelte')
		);
		expect(
			paginas.filter(({ text }) => !/class="[^"]*\bblad\b/.test(text)).map((p) => p.path)
		).toEqual([]);
	});

	it('heads every page in the frame with the one head, spaced only by AppShell', () => {
		// Thijs, 10 Oct: "een andere verticale uitlijning na de titel". The menu pages and the
		// text pages use .blad__kop and .blad__titel; none styles its h1, its title or its head.
		const menu = [
			'routes/(main)/actueel/+page.svelte',
			'routes/(main)/onderwerpen/+page.svelte',
			'routes/(main)/gemarkeerd/+page.svelte',
			'lib/components/explore/index/IndexOverzicht.svelte'
		];
		const zonderKop = sources.filter(
			({ path, text }) =>
				menu.includes(path) && !/class="blad__kop"[\s\S]*?class="blad__titel"/.test(text)
		);
		expect(zonderKop.map((s) => s.path)).toEqual([]);
		// Every h1 of a page is the one title (the home page's is the name of the site).
		const anders = offenders(
			(t) => [...t.matchAll(/<h1\b[^>]*>/g)].some((m) => !/class="blad__titel"/.test(m[0])),
			['routes/(main)/+page.svelte']
		).filter((p) => p.startsWith('routes/'));
		expect(anders).toEqual([]);
		const eigen = offenders(
			(t) =>
				t.includes('blad__kop') &&
				rules(t).some((r) =>
					/(^|[\s,>])(h1|\.blad__kop|\.blad__titel|\.kop|\.titel|\.title)$/.test(r.selector.trim())
				),
			['lib/components/layout/AppShell.svelte']
		);
		expect(eigen).toEqual([]);
	});

	it('keeps the footer under the fold and a late band in its place (no layout shift)', () => {
		// Live, 10 Oct: the footer jumped into view on every page when the server's page gave
		// way to the app (0.22 to 0.37 of layout shift), and Actueel dropped under the
		// Wetsnetwerk band on the home page (0.16).
		const laag = sources.find((s) => s.path === 'routes/(main)/+layout.svelte')!.text;
		expect(laag).toMatch(/class="blad-hoogte"[\s\S]*min-height: 100dvh/);
		const thuis = sources.find((s) => s.path === 'routes/(main)/+page.svelte')!.text;
		expect(thuis).toMatch(/\{:else if wetsnetwerkLaden\}/);
	});

	it('starts every reader at one title column where no network stands beside it', () => {
		const verkenner = sources.find((s) => s.path === 'routes/explore/+page.svelte')!.text;
		expect(verkenner).toMatch(
			/\.explore-read:not\(\.explore-read--with-nav\) \.col--measure \{\s*--reader-col-left: calc\(var\(--nav-w, var\(--nav-w-auto\)\) \+ 5px\);/
		);
	});

	it('says a state where content would be in one quiet line (.stil)', () => {
		// Round 2 of the consistency pass: "Laden…" was italic in the readers and roman on the
		// pages. A row, a caption or the nav column keeps its own smaller line.
		const eigen = /\b(stil|nav-kolom__note|onderschrift|laden|sr-only)\b/;
		const zonder = sources.flatMap(({ path, text }) =>
			[...text.matchAll(/<p class="([^"]*)"[^>]*>\s*Laden…/g)]
				.filter((m) => !eigen.test(m[1]))
				.map(() => path)
		);
		expect(zonder).toEqual([]);
		expect(
			offenders((t) =>
				rules(t).some(
					(r) => /\.(loading|leeg|empty|explore-empty)\b/.test(r.selector) && /italic/.test(r.body)
				)
			)
		).toEqual([]);
	});

	it('names the page a subpage belongs to as a crumb: one link, as a reader’s band', () => {
		const kruimels = sources.flatMap(({ path, text }) =>
			[...text.matchAll(/<(\w+) class="stub-eyebrow"[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => ({
				path,
				tag: m[1],
				inhoud: m[2]
			}))
		);
		expect(kruimels.length).toBeGreaterThan(0);
		expect(
			kruimels
				.filter((k) => k.tag !== 'nav' || !/^<a href="[^"]+">[^<]+<\/a>$/.test(k.inhoud.trim()))
				.map((k) => k.path)
		).toEqual([]);
	});

	it('styles the parts of a text page once, in AppShell (.blad--tekst)', () => {
		const delen =
			/^\.(stub-eyebrow|stub-lede|section|section-title|cite|meta-row|meta-link|updated)(:hover)?$/;
		expect(
			sources
				.filter(({ path }) => path.startsWith('routes/(main)'))
				.filter(({ text }) =>
					rules(text).some((r) => r.selector.split(',').some((s) => delen.test(s.trim())))
				)
				.map((s) => s.path)
		).toEqual([]);
	});

	it('sets the choose-line of a list page with Bepaalregel (docs/bediening.md)', () => {
		const lijsten = [
			'lib/components/explore/IndexView.svelte',
			'routes/(main)/actueel/+page.svelte',
			'routes/(main)/onderwerpen/overzicht/+page.svelte'
		];
		expect(
			lijsten.filter((p) => !sources.find((s) => s.path === p)?.text.includes('<Bepaalregel'))
		).toEqual([]);
	});

	it('draws a ticked box with Vinkje: no tick glyph, no native checkbox', () => {
		expect(offenders((t) => /✓|type="checkbox"/.test(t))).toEqual([]);
	});

	it('chooses a Kamer with a Keuze, never with boxes (docs/bediening.md)', () => {
		expect(
			offenders(
				(t) =>
					/kind: 'list',[^}]{0,300}Tweede Kamer/.test(t) ||
					/\[\{ c: 'TK', label: 'Tweede Kamer' \}[^\n]*\n[^\n]*<FilterOptie/.test(t)
			)
		).toEqual([]);
	});

	it('draws every option of a filter with FilterOptie', () => {
		expect(offenders((t) => /class="(box|opt|check__box)"/.test(t))).toEqual([]);
	});

	it('sets text in the serif and only controls in the sans (docs/typografie.md, 10 Oct 2026)', () => {
		expect(offenders((t) => t.includes('var(--font-sans)'))).toEqual([]);
		// The sans only where a control is styled.
		expect(
			offenders(
				(t) => rules(t).some((r) => r.body.includes('var(--font-ui)') && !isControl(r.selector)),
				['lib/components/layout/AppShell.svelte']
			)
		).toEqual([]);
		// Text in three weights: 400, 600, 800. The wordmark is a logo, not a rung.
		expect(
			offenders(
				(t) =>
					rules(t).some(
						(r) => !isControl(r.selector) && /font-weight:\s*(?!400|600|800)\d+/.test(r.body)
					),
				['lib/components/layout/Wordmark.svelte']
			)
		).toEqual([]);
	});

	it('heads every reader with ReaderHead, Bewaar in its place (Thijs, 10 Oct: gelijke pagina’s)', () => {
		// The head of a reader is one form: kind or place, title, status, and the actions at its
		// right (KopActies through ReaderHead, Bewaar always). No reader lays out actions itself.
		const lezers = sources.filter(
			({ path }) =>
				(/^lib\/components\/explore\/readers\/\w+Reader\.svelte$/.test(path) &&
					!path.endsWith('ReaderHead.svelte')) ||
				path === 'lib/components/explore/WholeLawReader.svelte'
		);
		expect(lezers.length).toBeGreaterThan(10);
		expect(
			lezers
				.filter(({ text }) => !/<ReaderHead[\s\S]*?acties=\{\{[\s\S]*?bewaar:/.test(text))
				.map((s) => s.path)
		).toEqual([]);
		expect(
			offenders((t) => /<KopActies\b/.test(t), ['lib/components/explore/readers/ReaderHead.svelte'])
		).toEqual([]);
		// Every branch of a reader too (a bewindspersoon has its own lines): no reader file draws
		// a head of its own, and one that holds a title heads it with ReaderHead (Hosten, 10 Oct:
		// /leden/rob-jetten had no Bewaar).
		const map = sources.filter(({ path }) => path.startsWith('lib/components/explore/readers/'));
		expect(map.filter(({ text }) => /<header\b/.test(text)).map((s) => s.path)).toEqual([]);
		expect(
			map
				.filter(
					({ path, text }) =>
						!path.endsWith('ReaderHead.svelte') &&
						/<h[12]\b/.test(text) &&
						!/<ReaderHead\b/.test(text)
				)
				.map((s) => s.path)
		).toEqual([]);
		// The head ends without a rule of its own: the first section's rule is the one line.
		const kop = sources.find((s) => s.path === 'lib/components/explore/readers/ReaderHead.svelte')!;
		expect(
			[...lezers, kop]
				.filter(({ text }) =>
					rules(text).some(
						(r) =>
							/reader-head|whole-head|(^|\s)\.head$/.test(r.selector) &&
							/border-bottom/.test(r.body)
					)
				)
				.map((s) => s.path)
		).toEqual([]);
	});

	it('keeps red for "nee" and an error, never for a hover or a focus (Thijs, 10 Oct 2026)', () => {
		// "De kleur mag alleen blijven zolang het een doel dient": red says no. A hover, the
		// focus ring and a wash are ink or neutral.
		const eigen: Uitzonderingen = {
			'lib/components/layout/AppShell.svelte': 'the tokens: --accent and --uitkomst-nee',
			'lib/components/layout/Wordmark.svelte': 'the § of the name',
			'routes/(main)/actueel/+page.svelte': 'an error'
		};
		expect(offenders((t) => /var\(--accent\)|--accent-soft/.test(t), buiten(eigen))).toEqual([]);
		const shell = sources.find((s) => s.path === 'lib/components/layout/AppShell.svelte')!.text;
		expect(shell.match(/var\(--accent\)/g)).toHaveLength(1);
	});

	it('keeps red off a menu button that has the focus back after a choice', () => {
		// The guard above lets :focus be red; a TekstMenu button gets the focus back after a
		// choice and stood red at rest (the Legenda's Bronnen, Thijs, 10 Oct).
		const css = (t: string) =>
			(/<style>([\s\S]*?)<\/style>/.exec(t)?.[1] ?? '').replace(/\/\*[\s\S]*?\*\//g, '');
		const rood = (t: string) =>
			[...css(t).matchAll(/([^{}]+)\{([^{}]*)\}/g)].some(
				([, selector, body]) =>
					/tekstmenu__knop[^,{]*:focus/.test(selector) && /var\(--accent\)/.test(body)
			);
		expect(offenders(rood)).toEqual([]);
	});

	it('opens a row of a list on the bron’s content, with Bewaar on the row (Thijs, 10 Oct)', () => {
		// One row for Actueel, Gevolgd and Bladeren (IndexRow): what opens is the content
		// (RijInhoud), the actions are RijActies on the row; no Lees or In het netwerk buttons.
		const rij = sources.find((s) => s.path === 'lib/components/explore/index/IndexRow.svelte')!;
		expect(rij.text).toContain('<RijActies');
		expect(
			offenders(
				(t) => /\/>Lees<\/a|>In het netwerk<\/a/.test(t),
				['lib/components/open/OpenRij.svelte']
			)
		).toEqual([]);
	});

	it('gives the actions of a row one look: two fixed places, a glyph without a frame', () => {
		// Thijs, 10 Oct: "toch wat raar met de verschillen in hoe ze weergegeven worden".
		const t = sources.find((s) => s.path === 'lib/components/ui/RijActies.svelte')!.text;
		expect(t).not.toMatch(/IconKnop/);
		expect(t.match(/<span class="plek">/g)).toHaveLength(2);
		expect(rules(t).some((r) => /(?<![-\w])border:\s*(?!\s|0)/.test(r.body))).toBe(false);
		// Where a verbinding comes from is words in the row's meta line, not a box over the
		// next row ("Herkend in de tekst" was "out of place").
		const verbonden = sources.find((s) => s.path === 'lib/verbonden/Verbonden.svelte')!.text;
		expect(verbonden).not.toMatch(/row__herkomst/);
		expect(verbonden).toMatch(/kind: 'herkomst'/);
	});

	it('keeps the choice of bronnen in the filter, not in the head of Verbonden', () => {
		// Thijs, 11 Oct: the groups below already are the kinds chosen; the menu Bronnen in the
		// choose-line went. The presets and the kinds stay reachable in the filter sheet.
		const text = (path: string) => sources.find((s) => s.path === path)!.text;
		const verbonden = text('lib/verbonden/Verbonden.svelte');
		expect(verbonden).not.toMatch(/label="Bronnen"/);
		expect(verbonden).not.toMatch(/\bPRESETS\b/);
		expect(verbonden).toMatch(/onclick=\{onOpenFilter\}>Filter</);
		const sheet = text('lib/verbonden/FilterSheet.svelte');
		expect(sheet).toMatch(/#each PRESETS as p/);
		expect(sheet).toMatch(/#each BRON_KINDS as k/);
	});

	it('draws a mark in a Keuze in the colour of its option', () => {
		// On the chosen option (ink) an ink mark vanished: the mark follows the text.
		const keuze = sources.find((s) => s.path === 'lib/components/ui/Keuze.svelte')!;
		expect(
			rules(keuze.text).some(
				(r) => r.selector.includes(':global(.kind-glyph)') && /color:\s*currentColor/.test(r.body)
			)
		).toBe(true);
	});

	it('takes every colour in a style from the tokens in AppShell', () => {
		// A hex or rgb() value in a component is a colour beside the palette. A mask's `black`
		// is not a colour; the canvas and the fracties' own colours live in TypeScript.
		const css = (t: string) =>
			(/<style>([\s\S]*?)<\/style>/.exec(t)?.[1] ?? '').replace(/\/\*[\s\S]*?\*\//g, '');
		const eigen: Uitzonderingen = {
			'lib/components/layout/AppShell.svelte': 'the tokens themselves'
		};
		expect(
			offenders((t) => /#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\(/.test(css(t)), buiten(eigen))
		).toEqual([]);
	});

	it('rounds a corner with a radius token', () => {
		const vrij = /^((var\(--r-[\w-]+\)|0)(\s+(var\(--r-[\w-]+\)|0))*|50%|inherit)$/;
		expect(
			offenders((t) =>
				rules(t).some((r) =>
					[...r.body.matchAll(/border-radius:\s*([^;]+);/g)].some((m) => !vrij.test(m[1].trim()))
				)
			)
		).toEqual([]);
	});

	it('names a face only through its token', () => {
		expect(
			offenders(
				(t) =>
					rules(t).some((r) =>
						[...r.body.matchAll(/font-family:\s*([^;]+);/g)].some(
							(m) => !/^var\(--font-(serif|ui)\)$/.test(m[1].trim())
						)
					),
				// The wordmark is a logo in its own face.
				['lib/components/layout/AppShell.svelte', 'lib/components/layout/Wordmark.svelte']
			)
		).toEqual([]);
	});

	it('hides text for a screen reader with the one .sr-only', () => {
		const eigen: Uitzonderingen = {
			'lib/components/layout/AppShell.svelte': 'the one rule'
		};
		expect(
			offenders((t) => rules(t).some((r) => /clip:\s*rect\(0/.test(r.body)), buiten(eigen))
		).toEqual([]);
	});

	it('separates with a comma, not a middle dot (Thijs, 2 October 2026)', () => {
		// "Motie, nr. 21", "Dossier, Kamerstuk 36799", and the browser tab: "Actueel, Concordans".
		expect(offenders((t) => t.includes('\u00b7'))).toEqual([]);
	});

	it('colours a fractie only through partijkleuren: one colour per fractie everywhere (UX #57)', () => {
		expect(
			offenders(
				(t) => t.includes(`'/api/parties/colors'`),
				['lib/components/explore/partijkleuren.svelte.ts']
			)
		).toEqual([]);
	});

	it('names a fractie by its abbreviation through fractieNaam (UX #57)', () => {
		const eigen =
			/\babbreviation \?\? (?:\w+\.(?:faction|faction_key)\b|(?:\w+\.name \?\? )?\w*[nN]aamVan\('factions')/;
		expect(offenders((t) => eigen.test(t))).toEqual([]);
	});

	it('keeps no component that nothing uses', () => {
		const componenten = sources.filter(
			({ path }) => path.startsWith('lib/') && path.endsWith('.svelte')
		);
		expect(
			componenten
				.filter(({ path }) => {
					const naam = `/${path.split('/').at(-1)}'`;
					return !sources.some((s) => s.path !== path && s.text.includes(naam));
				})
				.map((c) => c.path)
		).toEqual([]);
	});

	it('has no prototype switches or study folders left', () => {
		expect(
			offenders((t) => /searchParams\.get\('(ontwerp|contrast)'\)|components\/r[0-9]\//.test(t))
		).toEqual([]);
	});
});

describe('controls in five forms (docs/bediening.md, Thijs, 10 Oct 2026)', () => {
	it('chooses one of many with TekstMenu, not a native select', () => {
		const selects: Uitzonderingen = {
			'lib/components/ui/TekstMenu.svelte': 'the one form'
		};
		expect(offenders((t) => /<select\b/.test(t), buiten(selects))).toEqual([]);
	});

	it('shows a choice in the control itself, without chips', () => {
		const chips: Uitzonderingen = {
			'lib/netwerk/NetwerkPanel.svelte': 'the chosen bronnen: content, not a filter'
		};
		expect(offenders((t) => /class="[^"]*\bchip\b/.test(t), buiten(chips))).toEqual([]);
	});

	it('leads on from a list with AlleN, not a "meer" of its own', () => {
		// A class token named more or meer: `group__more`, `load-more-btn`, `chip--meer`.
		const meer = (t: string) =>
			[...t.matchAll(/class="([^"]*)"/g)].some((m) =>
				m[1].split(/\s+/).some((c) => /(^|[_-])(more|meer)($|[_-])/.test(c))
			);
		const eigen: Uitzonderingen = {};
		expect(offenders(meer, buiten(eigen))).toEqual([]);
	});

	it('frames a button only as the Knop (.btn, is-groot) or the IconKnop', () => {
		// A frame in the control's face, or a frame and a pointer, is a button (a field aside);
		// its one form is in AppShell and IconKnop.
		const knop = (r: { selector: string; body: string }) =>
			/border:\s*1px solid/.test(r.body) &&
			/var\(--font-ui\)|cursor:\s*pointer/.test(r.body) &&
			!/(input|textarea|select|kbd)\b[^,]*$/.test(r.selector);
		const eigen: Uitzonderingen = {
			'lib/components/layout/AppShell.svelte': 'the Knop itself',
			'lib/components/ui/IconKnop.svelte': 'the one icon button',
			'lib/components/layout/TopBar.svelte': 'the search in the bar looks as the field it opens',
			'lib/netwerk/NetwerkPanel.svelte': 'the example in an empty netwerk is a card, not a button'
		};
		expect(offenders((t) => rules(t).some(knop), buiten(eigen))).toEqual([]);
	});

	it('draws an item of a menu with tekstmenu__item', () => {
		// An item's hover is TekstMenu's: a menu of its own adds a class for its layout only.
		const item = (r: { selector: string; body: string }) =>
			/menu-?item|__item\b|-item\b/.test(r.selector) &&
			/background:\s*var\(--paper-2\)/.test(r.body);
		const eigen: Uitzonderingen = {
			'lib/components/ui/TekstMenu.svelte': 'the one item'
		};
		expect(offenders((t) => rules(t).some(item), buiten(eigen))).toEqual([]);
	});

	it('styles Verfijnen once, in AppShell', () => {
		expect(
			offenders(
				(t) =>
					rules(t).some(
						(r) =>
							/\.verfijnen-knop\b/.test(r.selector) && /font-family|text-decoration/.test(r.body)
					),
				['lib/components/layout/AppShell.svelte']
			)
		).toEqual([]);
	});

	it('sizes a control at the height of a page or of a panel', () => {
		// 32 px on a page (--veld-h), 24 px in a panel or a group (--veld-h-klein).
		const hoog = (body: string) =>
			[...body.matchAll(/(?<![-\w])height:\s*([^;]+);/g)].some(
				(m) => !/^(var\(--veld-h(-klein)?\)|auto|100%)$/.test(m[1].trim())
			);
		const anders: Uitzonderingen = {};
		expect(
			offenders((t) => rules(t).some((r) => isControl(r.selector) && hoog(r.body)), buiten(anders))
		).toEqual([]);
	});
});

// An effect whose cleanup writes what the effect reads runs again on its own cleanup: a loop
// that asked the API hundreds of times in seconds (Overzicht, 10 Oct 2026). A flag the
// cleanup resets is only written in the effect; the effect tests a local value.
describe('effects that end', () => {
	/** The block that opens at `start` (a `{`), by counting braces. */
	const blok = (text: string, start: number) => {
		let diep = 0;
		for (let i = start; i < text.length; i++) {
			if (text[i] === '{') diep++;
			else if (text[i] === '}' && --diep === 0) return text.slice(start, i + 1);
		}
		return text.slice(start);
	};
	/** Each effect's body and its cleanup, as written: `$effect(() => { … return () => { … } })`. */
	const effecten = (text: string) =>
		[...text.matchAll(/\$effect(?:\.pre)?\(\s*\(\)\s*=>\s*\{/g)].map((m) => {
			const body = blok(text, m.index! + m[0].length - 1);
			const r = body.search(/return\s*\(\)\s*=>\s*\{/);
			const cleanup = r >= 0 ? blok(body, body.indexOf('{', body.indexOf('=>', r))) : '';
			return { body: r >= 0 ? body.slice(0, r) : body, cleanup };
		});
	const schrijft = (code: string) =>
		new Set([...code.matchAll(/(?<![.\w])(\w+)\s*(?:[+-]?=)(?!=)/g)].map((m) => m[1]));
	const leest = (code: string, naam: string) =>
		new RegExp(`(?<![.\\w])${naam}\\b(?!\\s*[+-]?=(?!=))`).test(code);

	it('writes nothing in a cleanup that the effect reads', () => {
		const lussen = sources
			.filter(({ path }) => path.endsWith('.svelte') || path.endsWith('.svelte.ts'))
			.flatMap(({ path, text }) => {
				// Only state reruns an effect: a plain `let` read in a callback cannot.
				const staat = new Set([...text.matchAll(/let\s+(\w+)\s*=\s*\$state/g)].map((m) => m[1]));
				return effecten(text).flatMap(({ body, cleanup }) =>
					[...schrijft(cleanup)]
						.filter((naam) => staat.has(naam) && leest(body, naam))
						.map((naam) => `${path}: ${naam}`)
				);
			});
		expect(lussen).toEqual([]);
	});

	it('finds the loop it guards against', () => {
		const fout = `$effect(() => {
			laden = !!woorden.length;
			if (!laden) return;
			return () => {
				ac.abort();
				laden = false;
			};
		});`;
		const [e] = effecten(fout);
		expect([...schrijft(e.cleanup)].filter((n) => leest(e.body, n))).toEqual(['laden']);
	});
});

// The cards over the network stand at one width on one right edge (Thijs, 10 Oct); the halls'
// text and bars at the left edge of the frame, the hall alone centred.
describe('canvas cards and halls', () => {
	it('sizes every card over the network with --paneel-breed and --paneel-rand', () => {
		const kaart = /^\.(netwerk|legenda|cluster-kaart)$/;
		expect(
			offenders((t) =>
				rules(t).some(
					(r) =>
						kaart.test(r.selector.trim()) &&
						(/(?<![-\w])width:\s*\d/.test(r.body) || /(?<![-\w])right:\s*var\(--s-/.test(r.body))
				)
			)
		).toEqual([]);
	});

	it('keeps red out of the network: its colours are --netwerk-* tokens (Thijs, 10 Oct)', () => {
		// Red in the network would only say no; the kinds, the focus and a chosen verbinding
		// take the tokens in AppShell.
		const netwerk = (path: string) =>
			/^lib\/(components\/graph|netwerk|graph)\//.test(path) && !/\.test\.ts$/.test(path);
		expect(
			sources
				.filter((s) => netwerk(s.path) && /--accent|\baccent\b|accentSoft|#8c2f28/i.test(s.text))
				.map((s) => s.path)
		).toEqual([]);
	});

	it('gives the cards over the network the controls of the rest of the site', () => {
		// A menu is TekstMenu, an action in a card is text (btn is-text, TekstLink), a filter a
		// FilterOptie or a Keuze: no menu of their own (<details>), no filled button.
		const kaarten = (path: string) => /^lib\/(components\/graph|netwerk)\//.test(path);
		expect(
			sources
				.filter((s) => kaarten(s.path) && /<details\b|class="btn is-primary"/.test(s.text))
				.map((s) => s.path)
		).toEqual([]);
	});

	it('lets a Tab reach the cards over the network before the canvas (keyboard audit)', () => {
		const t = sources.find((s) => s.path === 'lib/components/graph/GraphView.svelte')!.text;
		const opmaak = t.slice(t.indexOf('<div class="graph-view">'));
		const plek = (c: string) => opmaak.indexOf(c);
		expect(plek('class="canvas-overlay"')).toBeGreaterThan(-1);
		expect(plek('class="canvas-overlay"')).toBeLessThan(plek('class="graph-canvas-wrap"'));
		expect(plek('class="legenda"')).toBeLessThan(plek('<CanvasNodeList'));
		expect(plek('<CanvasNodeList')).toBeLessThan(plek('class="graph-canvas-wrap"'));
		// The list of bronnen is visible where it has the focus: the canvas takes its outline.
		expect(t).toMatch(/\.buhne:has\(\.canvas-node-list :focus-visible\) \.graph-canvas-wrap/);
	});

	it('gives the contents the network’s width from 1440, so every reader title starts in one column', () => {
		const t = sources.find((s) => s.path === 'routes/explore/+page.svelte')!.text;
		expect(t).toMatch(/--nav-w-auto: calc\(var\(--graph-w-auto\) \+ var\(--s-6\) - 64px\);/);
	});

	it('centres every reader between the side columns on a wide screen, through ReaderFrame', () => {
		// Thijs, 11 Oct: "De reader mag wel gecentreerd worden tussen de twee zijpanelen". The
		// column sets the margin for every reader alike; no reader frames itself.
		const t = sources.find((s) => s.path === 'routes/explore/+page.svelte')!.text;
		expect(t).toMatch(/\.col--reader \{[^}]*--reader-col-left: auto;/);
		const frame = sources.find(
			(s) => s.path === 'lib/components/explore/readers/ReaderFrame.svelte'
		)!.text;
		expect(frame).toMatch(
			/\.reader-frame__col \{[^}]*margin-left: var\(--reader-col-left, 0\);[^}]*margin-right: auto;/
		);
		const lezers = sources.filter(({ path }) =>
			/^lib\/components\/explore\/readers\/\w+Reader\.svelte$/.test(path)
		);
		expect(lezers.length).toBeGreaterThan(10);
		expect(lezers.filter(({ text }) => !/<ReaderFrame\b/.test(text)).map((s) => s.path)).toEqual(
			[]
		);
	});

	it('puts the actions of a reader on a row of their own, and keeps the line of a late phrase', () => {
		// Thijs, 10 Oct (approved suggestion 5): the status words have the column's width; a
		// phrase that comes after the text (the bills of an article) stands on a line kept from
		// the start, so it moves nothing (Sv 147: 22 px before, 0 at 375 and 1440 after).
		const kop = sources.find(
			(s) => s.path === 'lib/components/explore/readers/ReaderHead.svelte'
		)!.text;
		expect(kop).toMatch(/\.reader-status \{[^}]*flex-direction: column;/);
		expect(kop).toMatch(/class="reader-status__later"/);
		const artikel = sources.find(
			(s) => s.path === 'lib/components/explore/readers/ArticleReader.svelte'
		)!.text;
		expect(artikel).toMatch(/\{#snippet later\(\)\}[\s\S]*?billCount/);
		expect(artikel).toMatch(/\n\t*laterPlek\n/);
	});

	it('says the chain of an amended stuk in the status line, where every reader has its status', () => {
		// "Vervangt nr. 10", "Vervangen door nr. 47": words of the status line through ReaderHead,
		// not a row or a section of their own, on one reader for amendementen and moties alike.
		const lezer = sources.find(
			(s) => s.path === 'lib/components/explore/readers/DocumentReader.svelte'
		)!.text;
		const status = /\{#snippet status\(\)\}([\s\S]*?)\{\/snippet\}/.exec(lezer)?.[1] ?? '';
		expect(status).toMatch(/<Vervanging zinnen=\{vervanging\(doc\)\} \/>/);
		expect(lezer.match(/<Vervanging\b/g)).toHaveLength(1);
		expect(
			offenders(
				(t) => /<Vervanging\b/.test(t),
				['lib/components/explore/readers/DocumentReader.svelte']
			)
		).toEqual([]);
		// Its numbers are BronLinks, inline in the run of words.
		const zin = sources.find(
			(s) => s.path === 'lib/components/parliamentary/Vervanging.svelte'
		)!.text;
		expect(zin).toMatch(/<BronLink\b/);
		expect(zin).not.toMatch(/<(p|div|section|Sectie)\b/);
	});

	it('gives a page with a list a second skip link, through AppShell, and one main', () => {
		const shell = sources.find((s) => s.path === 'lib/components/layout/AppShell.svelte')!.text;
		expect(shell).toMatch(/class="skip-link">Naar de lijst<\/a>/);
		for (const pad of [
			'routes/(main)/actueel/+page.svelte',
			'lib/components/explore/IndexView.svelte'
		])
			expect(sources.find((s) => s.path === pad)!.text).toMatch(/use:lijstDoel/);
		// A bron's panes beside its text, past the text's own tab stops (UX-toets 10 Oct, #22).
		expect(shell).toMatch(/\$paneelSprongen as s/);
		const explore = sources.find((s) => s.path === 'routes/explore/+page.svelte')!.text;
		expect(explore).toMatch(/label: 'Naar Verbonden'/);
		expect(explore).toMatch(/label: 'Naar het netwerk'/);
		// One main on a page: AppShell's.
		const zonderUitleg = (t: string) =>
			t.replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '');
		expect(
			offenders((t) => /<main\b/.test(zonderUitleg(t)), ['lib/components/layout/AppShell.svelte'])
		).toEqual([]);
	});

	it('keeps the canvas and the lists of Bronnen out of the Verkenner’s own chunk', () => {
		// A reader's first request waits for the Verkenner's chunk: the canvas (GraphView with
		// graphology) and IndexView come as chunks of their own (213 → 145 kB gz, 10 Oct).
		const t = sources.find((s) => s.path === 'routes/explore/+page.svelte')!.text;
		expect(t).not.toMatch(/^\s*import (GraphView|IndexView) from/m);
		expect(t).toMatch(/import\('\$lib\/components\/graph\/GraphView\.svelte'\)/);
		expect(t).toMatch(/import\('\$lib\/components\/explore\/IndexView\.svelte'\)/);
	});

	it('draws every card over the network with CanvasKaart: one frame, one width', () => {
		// Thijs, 10 Oct: "Deze mogen even breed zijn en hetzelfde soort component zijn". The
		// folded Netwerk took its content's width (`width: auto`).
		const graph = sources.find((s) => s.path === 'lib/components/graph/GraphView.svelte')!.text;
		const netwerk = sources.find((s) => s.path === 'lib/netwerk/NetwerkPanel.svelte')!.text;
		expect(graph).toMatch(/<CanvasKaart[^>]*klasse="legenda"/);
		expect(graph).toMatch(/<CanvasKaart[^>]*klasse="cluster-kaart"/);
		expect(netwerk).toMatch(/<CanvasKaart[^>]*klasse="netwerk"/);
		const eigenKader = (t: string) =>
			rules(t).some(
				(r) =>
					/\.(netwerk|legenda|cluster-kaart)(?![-\w])/.test(r.selector) &&
					!/netwerk--start/.test(r.selector) &&
					/(?<![-\w])(border|background|box-shadow):|(?<![-\w])width:\s*(?!\s|auto)/.test(r.body)
			);
		expect(
			[
				['lib/components/graph/GraphView.svelte', graph],
				['lib/netwerk/NetwerkPanel.svelte', netwerk]
			]
				.filter(([, t]) => eigenKader(t))
				.map(([p]) => p)
		).toEqual([]);
	});

	it('sets the places of a hall on one line at the left, in ZaalPlaatsen', () => {
		expect(
			offenders(
				(t) => /<p class="(sleutel|pl)"/.test(t) && /Voorzitter/.test(t),
				['lib/components/explore/ZaalPlaatsen.svelte']
			)
		).toEqual([]);
		const zaal = ['Meerderheid', 'ZaalLegenda', 'ZaalPlaatsen', 'Hemicycle'].map(
			(n) => `lib/components/explore/${n}.svelte`
		);
		expect(
			sources
				.filter((s) => zaal.includes(s.path))
				.filter((s) => /margin:[^;]*\bauto\b|text-align:\s*center/.test(s.text))
				.map((s) => s.path)
		).toEqual([]);
	});
});

describe('the keyboard', () => {
	it('lets no focus pass without a mark: every outline taken away is named (audit 3)', () => {
		// The ink ring stands on every focus (AppShell, :focus-visible). A rule that takes the
		// outline away gives the focus another mark that is as plain, and says so here.
		const eigen: Record<string, string> = {
			'lib/search/Search.svelte input': 'its field carries the ring (.field:focus-within)',
			'lib/components/graph/GraphView.svelte .graph-canvas-wrap:focus':
				'a click on the canvas; :focus-visible has the ring',
			'lib/components/ui/TekstMenu.svelte :global(.tekstmenu__item:hover:not(:disabled)), :global(.tekstmenu__item:focus-visible), :global(.tekstmenu__item:focus-within)':
				'an item of an open menu: the wash of the row, as every menu',
			'lib/components/explore/Hemicycle.svelte a': 'a seat of the hall: its sector in ink',
			'lib/components/explore/readers/KamerZetels.svelte .doel': 'a seat: its stroke in ink',
			'lib/onderwerpen/Kruiswoord.svelte .cel.vol:hover, .cel.vol:focus-visible':
				'a cell of the grid: an inset line in ink',
			'lib/onderwerpen/Kruiswoord.svelte .knop:hover, .knop:focus-visible':
				'a total of the grid: an inset line in ink, as a cell',
			"lib/components/layout/AppShell.svelte :global([tabindex='-1']:focus:not(:focus-visible))":
				'a list reached by its skip link (focus by a click or a script): :focus-visible keeps the ring'
		};
		const zonder = sources.flatMap(({ path, text }) =>
			rules(text)
				.filter((r) => /outline:\s*(none|0)\b/.test(r.body))
				.map((r) => `${path} ${r.selector.replace(/\s+/g, ' ')}`)
		);
		expect(zonder.filter((k) => !(k in eigen))).toEqual([]);
	});
});

describe('names, not keys', () => {
	it('falls back to the name of a bron, never to its key or id ($lib/bron/menselijk)', () => {
		// "x ?? y.key" put "bwbr0005537_2022_05_01" and uuids on the screen. A name that may be
		// missing falls back to menselijkeNaam (naamVan, naamVanId); a key or id used as a key
		// (an href, a lookup, a version's id) is named here with what it is for.
		const techniek: Record<string, string> = {
			'lib/components/articles/VersionCompare.svelte': 'the id of a wording, not shown',
			'lib/components/graph/GraphView.svelte': 'node ids for focus and hover',
			'lib/components/explore/IndexView.svelte':
				'the key of a concept for the URL; a fraction key for its colour',
			'lib/components/explore/JudgmentToc.svelte': 'the ECLI asked of the API',
			'lib/components/explore/readers/JudgmentReader.svelte': 'the ECLI asked of the API',
			'lib/components/explore/WholeLawReader.svelte': 'the id of a version, not shown',
			'lib/components/explore/readers/CommitmentReader.svelte': 'the number in a dossier ref',
			'lib/components/actueel/wetsnetwerk.ts': 'the key of an href',
			'lib/components/parliamentary/amendementen.ts': 'the ids of the zaken not done',
			'lib/api/law-articles.ts': 'the address of an article, not its name',
			'lib/text/version-diff.ts': 'the id of a version, not shown'
		};
		const fallback = /(\?\?|\|\|)\s*[A-Za-z_$][\w.?$]*\.(key|id)\b(?!\s*\.|\s*[!=]==|\s*\()/;
		const zonder = sources
			.filter(({ path }) => !path.endsWith('.test.ts') && !(path in techniek))
			.flatMap(({ path, text }) =>
				text
					.split('\n')
					.filter((l) => fallback.test(l))
					.map((l) => `${path}: ${l.trim()}`)
			);
		expect(zonder).toEqual([]);
	});
});
