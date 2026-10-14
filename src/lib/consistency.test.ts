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
	it('opens a bron from a click by one rule, $lib/bron/href.ts openHref', () => {
		// A Kamerstuk opens on its text, the rest in the network (Thijs, 12 Oct 2026). A link
		// forced to the network is one that says so: In het netwerk.
		const netwerkLinks: Uitzonderingen = {
			'lib/bron/href.ts': 'the rule itself',
			'lib/verbonden/VerbondenTabel.svelte': 'In het netwerk of an opened row',
			'lib/components/open/PostOpen.svelte': 'In het netwerk of a bewindspersoon'
		};
		expect(offenders((t) => /mode: 'graph'/.test(t), buiten(netwerkLinks))).toEqual([]);
	});

	it('sets footnotes by one component in every reader (Voetnoten, CitedText `noten`)', () => {
		// A judgment, a Kamerstuk and an overweging read in place (its card, Gemarkeerd) show
		// their notes alike: the marker in CitedText, the notes in Voetnoten, one open note.
		const lezers = [
			'lib/components/explore/readers/JudgmentReader.svelte',
			'lib/components/explore/readers/DocumentReader.svelte',
			'lib/bron/Overweging.svelte'
		];
		for (const pad of lezers) {
			const t = sources.find((s) => s.path === pad)!.text;
			expect(t, pad).toMatch(/<Voetnoten\b/);
			expect(t, pad).toMatch(/<CitedText\b[^>]*\bnoten=/);
			expect(t, pad).toMatch(/zetNootStand\(\)/);
		}
		// No other place draws a note or its marker of its own.
		expect(
			offenders(
				(t) => /class="voetnoot"|class="noot-ref/.test(t),
				['lib/components/articles/Voetnoten.svelte', 'lib/components/articles/CitedText.svelte']
			)
		).toEqual([]);
		// The passage with its marked words is one component (Aanhaling) wherever a row or a card shows it.
		expect(
			offenders((t) => /\.before\}<mark>|\{p\.before\}/.test(t), ['lib/verbonden/Aanhaling.svelte'])
		).toEqual([]);
	});

	it('sets how long a request waits only in $lib/api/client.ts (api or zoekApi)', () => {
		// A caller's own timeout can only shorten the client's: 30 s on top of `api` gave up after 10.
		expect(offenders((t) => /AbortSignal\.timeout\(/.test(t), ['lib/api/client.ts'])).toEqual([]);
	});

	it('builds a readable query and patches the address only in $lib/util/address.ts', () => {
		// A copy of its own forgot the comma once: %2C in the address bar of Bladeren.
		expect(offenders((t) => /%2F|%2C/.test(t), ['lib/util/address.ts'])).toEqual([]);
		expect(offenders((t) => /new URL\(page\.url\)/.test(t))).toEqual([]);
	});

	it('makes a filter a step in the history on every page of filters, typing not (#50)', () => {
		// Actueel and Bladeren step on a filter and replace on typing; the overview of a topic
		// has filters only, so every patch it makes is a step.
		const text = (path: string) => sources.find((s) => s.path === path)?.text ?? '';
		for (const path of [
			'routes/(main)/actueel/+page.svelte',
			'lib/components/explore/IndexView.svelte'
		])
			expect(text(path), path).toMatch(/navigate\([^;]*\{ step: !replaceState \}\)/);
		expect(text('routes/(main)/onderwerpen/overzicht/+page.svelte')).toMatch(
			/const zet = [^;]*navigate\([^;]*\{ step: true \}\)/
		);
	});

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

	it('names a date by korteDatum or langeDatum itself, and counts days only in datum.ts', () => {
		const alias =
			/const \w+ = (?:korteDatum|langeDatum);|const \w+ = \([^)]*\)[^=;]*=> (?:korteDatum|langeDatum)\(\w+\)(?: \|\| null)?;/;
		expect(offenders((t) => alias.test(t), ['lib/text/datum.ts'])).toEqual([]);
		expect(offenders((t) => /86_?400_?000|864e5/.test(t), ['lib/text/datum.ts'])).toEqual([]);
		// A day as the URL writes it is checked by isDay.
		expect(
			offenders((t) => t.includes(String.raw`/^\d{4}-\d{2}-\d{2}$/`), ['lib/text/datum.ts'])
		).toEqual([]);
	});

	it('turns a text with the helpers of $lib/text/words.ts (code-eenvoud F45)', () => {
		const words = ['lib/text/words.ts'];
		const rules: [string, RegExp][] = [
			['a capital or a small first letter', /\.charAt\(0\)\.to(?:Upper|Lower)Case\(\)/],
			['a kind without its group', /\\s\*\\\(\.\*\\\)\\s\*\$/],
			[
				'a node prop as text',
				/typeof (\w+) === 'string' &&\s+\1\.trim\(\)\s+\?\s+\1\.trim\(\) : null/
			],
			['a pattern escaped', /'\\\\\$&'/],
			['"a, b en c"', /slice\(0, -1\)\.join\(', '\)\} en /],
			['a noun for a count', /=== 1 \? '/]
		];
		for (const [what, rule] of rules)
			expect(
				offenders((t) => rule.test(t), words),
				what
			).toEqual([]);
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
		// the bron. A row of Verbonden has no panel of actions (Thijs, 10 Oct): its title and the
		// row itself go to the bron in Netwerk; only a Kamerstuk opens in place, on its core text
		// (RijInhoud, as in Actueel and Bronnen; pakket C, 14 Oct).
		const rows = sources.filter(({ text }) =>
			/class="(row-title|row__title)"[\s\S]{0,240}(href=|\{href\})/.test(text)
		);
		expect(rows.length).toBeGreaterThan(0);
		expect(rows.filter(({ text }) => !text.includes('terPlekke')).map((s) => s.path)).toEqual([]);
		const verbonden = rows.find(({ path }) => path.endsWith('verbonden/Verbonden.svelte'))!;
		expect(verbonden.text).toMatch(/opentTerPlekke\(row\) && terPlekke\(/);
	});

	it('marks a line of a timeline with the shape of its kind (vormen.ts), as Verbonden and the network do', () => {
		// The Tijdlijn draws only from VORMEN, no circle or square of its own.
		const tijdlijn = sources.find((s) => s.path === 'lib/components/tijdlijn/Tijdlijn.svelte')!;
		expect(tijdlijn.text).toMatch(/VORMEN\[/);
		expect(tijdlijn.text).not.toMatch(/class="teken"|border-radius:\s*50%/);
		// Required on Actueel's line, so the compiler holds every builder to it.
		const actueel = sources.find((s) => s.path === 'lib/components/actueel/timeline.ts')!;
		expect(actueel.text).toMatch(/\bvorm: Vorm\b/);
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
		const regel = /\.explore-read:not\(\.explore-read--with-nav\) \.col--measure \{([^}]*)\}/.exec(
			verkenner
		)?.[1];
		expect(regel).toMatch(/--reader-col-left:\s*calc\([^;]*--nav-w\b/);
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

	it('keeps a bron for the map through bewaarItem, its group from the bron ($lib/map/map.ts)', () => {
		// A stuk kept from a row and from its reader is one group (F13): no item built by hand.
		const metDeHand = (t: string) =>
			/\bat: ''/.test(t) || /\{[^{}]*\bkort\b[^{}]*\bgroep:[^{}]*\}/.test(t);
		expect(offenders(metDeHand, ['lib/map/map.ts'])).toEqual([]);
	});

	it('cites a kept vote as a vote, from its reader, a row of Bronnen and Verbonden (#54)', () => {
		const kept = sources.filter(({ text }) => /\bvoteCitation\(/.test(text)).map((s) => s.path);
		expect(kept).toEqual(
			expect.arrayContaining([
				'lib/components/explore/readers/DecisionReader.svelte',
				'lib/components/explore/IndexView.svelte',
				'lib/map/rij.ts'
			])
		);
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
		expect(verbonden).toMatch(/row__part--herkomst/);
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

	it('builds and reads an anchor only in $lib/text/anchor.ts (code-eenvoud F123)', () => {
		// `rov-5.1`, `fn-35`, `artikel-658`, `deel-hoofdstuk-3`, `lid-2-onder-a`: a prefix in a
		// string, a template or a pattern, comments left out.
		const prefix = '(?:rov|fn|artikel|deel|lid|tekst|onder)-';
		const hand = new RegExp(
			[
				`['"\`]${prefix}(?:['"\`]|\\$\\{)`,
				`\\^\\(?${prefix.slice(0, -1)}(?:\\|\\w+)*\\)?-`,
				`-onder-\\$\\{`
			].join('|')
		);
		const code = (t: string) =>
			t
				.replace(/<style>[\s\S]*?<\/style>/g, '')
				.replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|(^|[^:])\/\/.*$/gm, '$1');
		expect(offenders((t) => hand.test(code(t)), ['lib/text/anchor.ts'])).toEqual([]);
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
		expect(t).toMatch(/--nav-w-auto:\s*calc\([^;]*var\(--graph-w-auto\)/);
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

	it('loads every reader one way: load() into ReaderFrame, which says loading and failure', () => {
		// Code-eenvoud F10: each reader had its own state machine, attempt counter and error
		// line, and CommitteeReader showed nothing at all when its request failed.
		const lezers = sources.filter(({ path }) =>
			/^lib\/components\/explore\/(readers\/\w+\.svelte|WholeLawReader\.svelte)$/.test(path)
		);
		const own = lezers
			.filter(({ text }) =>
				/let attempt = \$state|class="(?:error|spinner|whole-error|whole-empty)"|class="loading/.test(
					text
				)
			)
			.map((s) => s.path);
		expect(own).toEqual([]);
		const laders = [
			'Annex',
			'Article',
			'Cabinet',
			'Commitment',
			'Committee',
			'Decision',
			'Document',
			'Dossier',
			'Faction',
			'Judgment',
			'Member'
		].map((n) => `lib/components/explore/readers/${n}Reader.svelte`);
		const zonder = laders.filter(
			(path) =>
				!/<ReaderFrame\b[^>]*\bstate=\{[^}]*\}[^>]*\bretry=/.test(
					sources.find((s) => s.path === path)!.text
				)
		);
		expect(zonder).toEqual([]);
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
		expect(artikel).toMatch(/\slaterPlek(=\{true\})?[\s>]/);
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

	it('says why a row of the feed is there by one rule, on Actueel and Gevolgd alike (pakket H)', () => {
		// The words asked for (`q`) are marked where the row shows them, else the line under it
		// says where they are (`In dossier: …`): FeedDay through $lib/text/treffer. Every page
		// with FeedDay passes its words, so a search in Actueel reads as a followed topic does.
		const pages = sources.filter(({ text }) => /<FeedDay\b/.test(text));
		expect(pages.map((s) => s.path).sort()).toEqual([
			'routes/(main)/actueel/+page.svelte',
			'routes/(main)/onderwerpen/+page.svelte'
		]);
		for (const { text } of pages)
			expect(/<FeedDay\b[\s\S]*?\/>/.exec(text)?.[0]).toMatch(/\btermen\b/);
		const day = sources.find((s) => s.path === 'lib/components/actueel/FeedDay.svelte')!.text;
		expect(day).toMatch(/\btermen: readonly string\[\]/);
		expect(day).toMatch(/plekVan\(/);
		// One rule for the words: woordIn and markeer live in treffer.ts alone.
		expect(
			offenders((t) => /export function (woordIn|markeer)\b/.test(t), ['lib/text/treffer.ts'])
		).toEqual([]);
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

	it('says the seats of a cabinet once, on the Kamer’s whole scale (Thijs, 12 Oct)', () => {
		const t = sources.find(
			(s) => s.path === 'lib/components/explore/readers/KamerZetels.svelte'
		)!.text;
		// The majority's line on the scale of zetelHoogte, none to all seats: no scale of its own.
		expect(t).toMatch(/zetelHoogte\([^)]*\bzetelsVanKamer\b/);
		expect(t).not.toMatch(/Math\.(min|max)\(\.\.\.v/);
		// The head figure states the totals: no second sentence or bar of the two sides.
		expect(t).not.toMatch(/<Meerderheid\b|class="aantal"/);
		// Uncertain once, with the count.
		expect(t.match(/['"`]\s*\(onzeker\)['"`]/g)).toHaveLength(1);
		expect(t).not.toContain('de zetels zijn onzeker');
		// The Eerste Kamer's hall always with its seats: today's plan, else the day's by fractie.
		expect(t).toContain('hallOfDay(');
		expect(
			sources.find((s) => s.path === 'lib/components/explore/readers/zetels.ts')!.text
		).toMatch(/export async function hallOfDay[\s\S]*?zaalMetPlan\(/);
		expect(t).toContain('<ZaalTegenover data={zaal}');
		const zaal = sources.find(
			(s) => s.path === 'lib/components/explore/ZaalTegenover.svelte'
		)!.text;
		expect(zaal).toContain('plaatsenOpVolgorde(');
		// A hall drawn by fractie is marked by its date, alike on both pages of the hall.
		for (const pad of [
			'lib/components/explore/readers/KamerZetels.svelte',
			'lib/components/explore/IndexView.svelte'
		])
			expect(sources.find((s) => s.path === pad)!.text).toContain('indelingMarkering(');
	});

	it('sets the places of a hall on one line at the left, in ZaalPlaatsen', () => {
		expect(
			offenders(
				(t) => /<p class="(sleutel|pl)"/.test(t) && /Voorzitter/.test(t),
				['lib/components/explore/ZaalPlaatsen.svelte']
			)
		).toEqual([]);
		const zaal = ['ZaalLegenda', 'ZaalPlaatsen', 'Hemicycle'].map(
			(n) => `lib/components/explore/${n}.svelte`
		);
		expect(
			sources
				.filter((s) => zaal.includes(s.path))
				.filter((s) => /margin:[^;]*\bauto\b|text-align:\s*center/.test(s.text))
				.map((s) => s.path)
		).toEqual([]);
	});

	it('offers a place in a map the reader’s own menu, from the reader’s citation (Thijs, 12 Oct)', () => {
		const src = (pad: string) => sources.find((s) => s.path === pad)!.text;
		const lezer = src('lib/components/explore/readers/ArticleReader.svelte');
		const kaart = src('lib/map/MapInhoud.svelte');
		const uitspraak = src('lib/components/explore/readers/JudgmentReader.svelte');
		// An article: one citation (articleCitation), the law's names recorded alike, and
		// ArticleText given the same citation props as in the reader.
		// The reader records the law's names where it loads the article (readers/article.ts).
		const laden = src('lib/components/explore/readers/article.ts');
		for (const [t, names] of [
			[lezer, laden],
			[kaart, kaart]
		]) {
			expect(t).toContain('articleCitation(');
			expect(names).toContain('recordArticleLaw(');
			const tekst = /<ArticleText\b[\s\S]*?\/>/.exec(t)![0];
			expect(tekst).toMatch(/\{citation\}/);
			expect(tekst).toMatch(
				/bewaar=\{[^}]*citation\s*\?\s*\{\s*id: [\w.]+, groep: citation\.citationTitle, wet: [\w.]+ \}/
			);
		}
		// An overweging: one citation and one Bewaar (overwegingCitaat), in the reader's menu; a
		// map's item shows it with the one Overweging, with its menu (bewaar).
		const overweging = src('lib/bron/Overweging.svelte');
		expect(kaart).toMatch(/<Overweging[\s\S]*?bewaar=\{\{ id: item\.id/);
		for (const t of [uitspraak, overweging]) {
			expect(t).toContain('overwegingCitaat(');
			expect(t).toContain('<PlaatsMenu');
			expect(t).toMatch(/cite=\{citeItems\(forms, forms\.link\)\}/);
		}
		// A place in an article is read with the article's parts (placeCitation), so a
		// definition without a letter is named by its term alike in the reader, its head's
		// Bewaar and a map; no page reads the anchor alone.
		const tekst = src('lib/components/articles/ArticleText.svelte');
		for (const t of [tekst, lezer]) expect(t).toContain('placeCitation(');
		expect(
			offenders((t) => /\bpartOfAnchor\(/.test(t), ['lib/text/cite.ts', 'lib/text/cite.test.ts'])
		).toEqual([]);
	});

	it('shows a note of the reader in one form, an item’s, a group’s and the map’s (Thijs, 12 Oct)', () => {
		// Aantekening sets the reader's own words apart from the law: the page draws no note
		// of its own, no italic and no field beside it.
		const src = (pad: string) => sources.find((s) => s.path === pad)!.text;
		const pagina = src('routes/(main)/gemarkeerd/+page.svelte');
		for (const tekst of [
			'tekst={i.notitie}',
			'tekst={bij}',
			'tekst={m.notitie}',
			'tekst={gedeeld.notitie}'
		])
			expect(pagina).toContain(tekst);
		expect(pagina).not.toMatch(
			/<textarea\b|class="[^"]*\b(?:map-)?notitie(?:-veld)?(?=["\s])|font-style:\s*italic/
		);
		expect(src('lib/map/Aantekening.svelte')).not.toMatch(/font-style:\s*italic|var\(--accent/);
		// The network's card shows the same notes in the same form, read only (Thijs, 12 Oct).
		const kaart = src('lib/components/graph/GraphCitePanel.svelte');
		expect(kaart).toMatch(/\{#each notities as n\b[^}]*\}\s*<Aantekening\b[^>]*tekst=\{n\.tekst\}/);
		expect(kaart).not.toMatch(/<Aantekening\b[^>]*onBewaar/);
		expect(kaart).not.toMatch(/class="[^"]*\bnotitie\b|\.notitie\b|\{n\.tekst\}<\/|\.waar\s*\{/);
		// Every note of the reader renders through Aantekening: no markup prints one itself.
		for (const s of sources.filter((s) => s.path.endsWith('.svelte')))
			expect(s.text, s.path).not.toMatch(/>\s*\{[\w.?]*\b(?:notitie|n\.tekst)\}/);
	});

	it('names where a map’s way on goes: here, or in the reader (Thijs, 12 Oct)', () => {
		const src = (pad: string) => sources.find((s) => s.path === pad)!.text;
		const inhoud = src('lib/map/MapInhoud.svelte');
		expect(inhoud).toContain("'Heel artikel hier'");
		expect(inhoud).toContain("'Heel artikel in de lezer'");
		expect(inhoud).not.toMatch(/>\s*Heel artikel\s*</);
		// The row's own way to the reader, in sight and not on hover: outside .knoppen.
		const pagina = src('routes/(main)/gemarkeerd/+page.svelte');
		const aside = /\{#snippet aside\(\)\}([\s\S]*?)\{\/snippet\}/.exec(pagina)![1];
		expect(aside.slice(aside.lastIndexOf('</span>'))).toContain('>In de lezer</TekstLink');
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

describe('runes', () => {
	it('assigns state in a statement, never as the value of an arrow (assignment_value_stale, #71)', () => {
		// `.then((items) => (lists[list] = items))`: Svelte warns that the value is the right-hand
		// side, not the proxy the state now holds.
		const memberAsValue = /=>\s*\(\s*[\w$]+(?:\.[\w$]+|\[[^\]]+\])+\s*=[^=>]/;
		expect(
			offenders((text) => memberAsValue.test(text)).filter((p) => /\.svelte(\.ts)?$/.test(p))
		).toEqual([]);
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
			'lib/text/version-diff.ts': 'the id of a version, not shown',
			'lib/verbonden/passage.ts': 'the anchor of a paragraph, for an href'
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

	it('says a grondslag in one place ($lib/text/delegaties)', () => {
		// "AMvB op grond van", "Op grond van", "mede op grond van": the row of Verbonden, a map, a
		// regulation under a regulation and the head of a regulation read them from there. The
		// words of the relation itself are hoe.ts's (BASED_ON).
		const zonder = sources
			.filter(({ path }) => path !== 'lib/text/delegaties.ts')
			.flatMap(({ path, text }) =>
				text
					.split('\n')
					.filter((l) => !/^\s*(\/\/|\*|\/\*\*)/.test(l))
					.filter((l) => /['`"][^'`"]*\bop grond van\b/i.test(l))
					.map((l) => `${path}: ${l.trim()}`)
			);
		expect(zonder).toEqual([]);
	});
});

// A failure is handled where its cause is known, or passed on: never swallowed into an
// empty state ($lib/api/errors.ts, $lib/util/load.svelte.ts, LoadState). Code-eenvoud F01.
describe('errors that are not swallowed', () => {
	const QUIET = String.raw`(?:\s*(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/))*\s*`;
	const FALLBACK = String.raw`(?:null|undefined|false|true|-?\d+|''|\[\](?:\s+as\s+[\w.<>[\]]+)?|\(\{\s*\}\)|\{${QUIET}\})`;
	/** `.catch(() => null | [] | {} | …)` and a `catch {}` with nothing but a comment in it. */
	const SWALLOWED = new RegExp(
		String.raw`\.catch\(\s*(?:\(\s*\w*\s*\)|\w+)\s*=>\s*${FALLBACK}\s*\)|\bcatch\s*(?:\(\s*\w*\s*\))?\s*\{${QUIET}\}`,
		'g'
	);
	const swallowed = (text: string) => (text.match(SWALLOWED) ?? []).length;

	it('finds what it guards against, and not a handled failure', () => {
		const found = [
			'get().catch(() => null)',
			'get().catch(() => [])',
			'get().catch(() => {})',
			'get().catch((e) => [] as Lid[])',
			'get().catch(() => {\n\t// stil\n})',
			'try { a(); } catch {}',
			'try { a(); } catch (e) { /* stil */ }'
		];
		for (const code of found) expect(swallowed(code), code).toBe(1);
		const handled = [
			"get().catch(ignore('leesbaar'))",
			"get().catch((e) => report('Verbonden', e))",
			'get().catch((e) => { request = null; throw e; })',
			'try { a(); } catch (e) { if (!isNotFound(e)) throw e; }'
		];
		for (const code of handled) expect(swallowed(code), code).toBe(0);
	});

	it('has one catch-all, at the outer boundary, and one boundary per panel of the Verkenner', () => {
		// hooks.client.ts reports what nobody handled; a panel that fails to draw says so in its
		// place (PanelBoundary), the other panels stay. Code-eenvoud F06.
		expect(offenders((t) => /addEventListener\(\s*'unhandledrejection'/.test(t))).toEqual([
			'hooks.client.ts'
		]);
		expect(offenders((t) => /<svelte:boundary\b/.test(t))).toEqual([
			'lib/components/ui/PanelBoundary.svelte'
		]);
		const explore = sources.find((s) => s.path === 'routes/explore/+page.svelte')!.text;
		const panels = [...explore.matchAll(/<PanelBoundary what="([^"]+)"/g)].map((m) => m[1]);
		expect(new Set(panels)).toEqual(new Set(['De tekst', 'Verbonden', 'Het netwerk']));
	});

	it('defines the quiet line once, in AppShell: no component styles its own .stil', () => {
		// Code-eenvoud F30: the open rows had a smaller one of their own.
		const own = (text: string) =>
			rules(text).some((r) => r.selector.split(',').some((s) => s.trim() === '.stil'));
		expect(offenders(own).filter((p) => p.startsWith('lib/components/'))).toEqual([]);
	});

	it('reads every answer of the API through unwrap, so a failure is an ApiError', () => {
		// `data ?? null` or `response.ok` made a 500 into "geen" (F05); a 404 that means "geen"
		// goes through ifExists ($lib/api/errors.ts).
		const raw = (text: string) =>
			(text.match(/\.GET\(/g) ?? []).length -
			(text.match(/\bunwrap\(\s*[\w.()]+\.GET\(/g) ?? []).length;
		expect(sources.filter(({ text }) => raw(text) > 0).map((s) => s.path)).toEqual([]);
	});

	it('swallows a failure nowhere but in the named places, whose counts only go down', () => {
		// Each count is what the file has now: a package that handles one lowers it, and an
		// entry at 0 comes out. A new file is never added.
		const places: Record<string, number> = {
			// A request whose failure becomes an empty state, a 0 or "niet in de gegevens": the
			// area packages turn each into ifExists, report, ignore or load with LoadState.
			'lib/api/instrument-cache.ts': 2,
			'lib/bron/behoort.ts': 5,
			'lib/components/actueel/wetsnetwerk.ts': 2,
			'lib/components/explore/IndexView.svelte': 1,
			'lib/components/parliamentary/data.ts': 1,
			'lib/graph/store/expansion.ts': 1,
			'lib/map/MapRegelingen.svelte': 1,
			// A throw that is no failure: a popover already in that state, a pointer capture
			// refused, graphology on an edge or node already there or gone, storage or a clipboard
			// that refuses (one storage helper, F32). Each gets a handler that says so.
			'lib/bron/BronLink.svelte': 2,
			'lib/bron/OverwegingKaart.svelte': 2,
			'lib/components/articles/GrondslagFormule.svelte': 2,
			'lib/components/explore/index/pannable.ts': 1,
			'lib/components/graph/GraphCanvas.svelte': 4,
			'lib/components/graph/GraphView.svelte': 5,
			'lib/components/ui/dicht.svelte.ts': 1,
			'lib/map/map.svelte.ts': 1,
			'lib/netwerk/NetwerkPanel.svelte': 1,
			'lib/onderwerpen/onderwerpen.ts': 1,
			'lib/onderwerpen/strekking.ts': 1,
			'routes/(main)/onderwerpen/+page.svelte': 1,
			'routes/explore/+page.svelte': 7
		};
		const found = Object.fromEntries(
			sources.map(({ path, text }) => [path, swallowed(text)]).filter(([, n]) => n)
		);
		expect(found).toEqual(places);
		// No reader swallows one: a secondary part says it failed (code-eenvoud F11).
		expect(Object.keys(found).filter((p) => p.includes('/explore/readers/'))).toEqual([]);
	});
});
