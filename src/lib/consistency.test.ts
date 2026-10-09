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

	it('fills no missing value with a sign: Waarde leaves it empty, Veld drops the row', () => {
		// "—" or "–" as a value reads as a fact ("unknown") where the data only lacks it.
		const sign = /['"`>][—–]['"`<]/;
		expect(offenders((t) => sign.test(t))).toEqual([]);
	});

	it('heads a section of a reader with Sectie, not a grey label', () => {
		expect(offenders((t) => /class="sec-title"|\.sec-title\b/.test(t))).toEqual([]);
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
			'lib/components/explore/readers/MemberReader.svelte',
			'lib/components/ui/FilterOptie.svelte',
			'lib/onderwerpen/Kruiswoord.svelte',
			'routes/(main)/api/+page.svelte',
			'routes/(main)/onderwerpen/overzicht/+page.svelte',
			'routes/(main)/(prose)/bronnen/+page.svelte',
			'routes/(main)/gemarkeerd/+page.svelte'
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

	it('separates with a comma, not a middle dot (Thijs, 2 October 2026)', () => {
		// "Motie, nr. 21", "Dossier, Kamerstuk 36799", and the browser tab: "Actueel, Concordans".
		expect(offenders((t) => t.includes('\u00b7'))).toEqual([]);
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
