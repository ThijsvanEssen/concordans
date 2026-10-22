// The first paint and the first navigation: what a page shows before the app runs, and
// what lets the app take over its links.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(process.cwd(), 'src');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

function files(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return files(path);
		return /\.(svelte|ts)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
	});
}

/** The custom properties a block of CSS declares, by name. */
const tokens = (css: string) =>
	new Map(
		[...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [
			m[1],
			m[2].trim().replace(/\s+/g, ' ')
		])
	);

describe('the server HTML before the app', () => {
	const style = /<style>([\s\S]*?)<\/style>/.exec(read('app.html'))?.[1] ?? '';
	const vooraf = /:root:has\(#seo\)\s*\{([^}]*)\}/.exec(style)?.[1] ?? '';

	it('uses the values of the app tokens (app.html against tokens.css)', () => {
		const app = tokens(/:root\s*\{([\s\S]*?)\n\}/.exec(read('lib/styles/tokens.css'))?.[1] ?? '');
		expect(tokens(vooraf).size).toBeGreaterThan(0);
		for (const [name, value] of tokens(vooraf))
			expect([name, app.get(name)]).toEqual([name, value]);
	});

	it('takes the frame from the tokens: the top bar, the width of a page and of its text', () => {
		for (const name of ['--topbar-h', '--blad-max', '--blad-tekst'])
			expect(style.replace(vooraf, '')).toContain(`var(${name})`);
		expect(style.replace(vooraf, '')).not.toMatch(/\b(60|720|1440)px\b/);
	});

	it('declares its font as the app does (app.html against fonts.css)', () => {
		const face = (css: string) => /@font-face\s*\{[^}]*\}/.exec(css)?.[0].replace(/\s+/g, ' ');
		expect(face(style)).toBeTruthy();
		expect(face(style)).toEqual(face(read('lib/styles/fonts.css')));
	});

	it('has a fallback sized to Newsreader where Georgia is not (Android, Linux), in both', () => {
		const faces = (css: string) =>
			[...css.matchAll(/@font-face\s*\{[^}]*Newsreader Fallback[^}]*\}/g)].map((m) =>
				m[0].replace(/\s+/g, ' ')
			);
		const app = faces(style);
		expect(app.join()).toMatch(/local\('Noto Serif'\)/);
		expect(app.join()).toMatch(/local\('DejaVu Serif'\)/);
		expect(app).toEqual(faces(read('lib/styles/fonts.css')));
		const stack = tokens(vooraf).get('--font-serif') ?? '';
		expect(stack.indexOf('Newsreader Fallback Noto')).toBeGreaterThan(-1);
		expect(stack.indexOf('Newsreader Fallback Noto')).toBeLessThan(stack.indexOf('Georgia,'));
	});

	it('stays hidden while the app comes, and shows when it does not', () => {
		const head = read('app.html').split('</head>')[0];
		const script = head.indexOf("classList.add('js'");
		expect(script).toBeGreaterThan(-1);
		// Before the first style, so nothing paints the text first.
		expect(script).toBeLessThan(head.indexOf('<style>'));
		expect(head).toMatch(/setTimeout\([\s\S]*?classList\.remove\('js'\)/);
		expect(head).toMatch(/\.js #seo:not\(:has\(> \.entrances\)\) \{\s*display: none;/);
		expect(read('routes/+layout.svelte')).toContain('clearTimeout(window.__seoTerug)');
		expect(read('routes/+layout.svelte')).toContain('removeServerText(document)');
	});

	it('declares the italic of Newsreader as the app does, for the placeholder and the note', () => {
		const italic = (css: string) =>
			/@font-face\s*\{[^}]*Newsreader-VariableItalic\.woff2[^}]*\}/
				.exec(css)?.[0]
				.replace(/\s+/g, ' ');
		expect(italic(style)).toBeTruthy();
		expect(italic(style)).toEqual(italic(read('lib/styles/fonts.css')));
	});

	it('loads its font from the head, before any script', () => {
		const head = read('app.html').split('</head>')[0];
		expect(head).toMatch(/rel="preload"[\s\S]*?Newsreader-Variable\.woff2/);
		expect(head).toContain("url('/fonts/Newsreader-Variable.woff2')");
	});
});

describe('the start page: the server HTML as the first paint', () => {
	const style = /<style>([\s\S]*?)<\/style>/.exec(read('app.html'))?.[1] ?? '';
	const server = read('lib/components/home/start-server.html');
	const home = read('routes/(main)/+page.svelte');
	const vooraf = tokens(/:root:has\(#seo\)\s*\{([^}]*)\}/.exec(style)?.[1] ?? '');
	/** The declarations of the rule with this selector in app.html (the first one). */
	const rule = (selector: string, css = style) => {
		const at = css.indexOf(`${selector} {`);
		expect(at, selector).toBeGreaterThan(-1);
		return css.slice(at, css.indexOf('}', at));
	};

	it('is shown with scripts only where the server writes the three ways in: the start page', () => {
		// The top level of the server's page: the head, the search form, the ways in.
		const top = [...server.matchAll(/<(\w+) class="([^"]+)"[^>]*>/g)][0];
		expect(top[2]).toBe('blad__kop intro');
		expect(server).toMatch(
			/<\/header><form [^>]*class="search"[^>]*>.*<\/form><div class="entrances">/s
		);
		expect(server.trim().endsWith('</div>')).toBe(true);
		expect(style).toContain('.js #seo:not(:has(> .entrances))');
	});

	it('keeps the room of what the app adds, with scripts only: the scopes and the law network', () => {
		// Keuze is one height, on a phone too (besluit 33): no smaller step in +page.svelte.
		expect(home).not.toMatch(/\.scopes :global\(\.keuze\) \{\s*height:/);
		expect(rule('#seo:has(> .entrances) > .search')).not.toContain('padding-top');
		// Not js, which goes when the app is 4 s late: the room would close under the reader.
		expect(read('app.html')).toContain("classList.add('js', 'scripts')");
		expect(rule('.scripts #seo:has(> .entrances) > .search')).toContain(
			'padding-top: calc(var(--veld-h) + var(--s-3))'
		);
		expect(style).not.toMatch(/@media \(width <= 600px\) \{\s*\.scripts #seo/);
		// The band of the law network while it is asked: the same heights.
		const plek = [...home.matchAll(/\.wetsnetwerk-plek \{[^}]*?min-height: (\d+px);/g)].map(
			(m) => m[1]
		);
		const band = [
			...style.matchAll(
				/\.scripts #seo:has\(> \.entrances\) > \.search::after \{[^}]*?min-height: (\d+px);/g
			)
		].map((m) => m[1]);
		expect(plek.length).toBe(2);
		expect(band).toEqual(plek);
		expect(home).toMatch(/@media \(max-width: 640px\) \{\s*\.wetsnetwerk-plek/);
		expect(style).toMatch(
			/@media \(max-width: 640px\) \{\s*\.scripts #seo:has\(> \.entrances\) > \.search::after/
		);
	});

	it('marks each line with the glyph of its kind (vormen.ts)', async () => {
		const { VORMEN } = await import('$lib/bron/vormen');
		for (const vorm of ['regel-o', 'uitspraak', 'stuk'] as const)
			expect(style).toContain(`path d='${VORMEN[vorm].d}'`);
	});

	it('keeps the letter of the first paint: the stack of the app without Newsreader', () => {
		const stack = (css: string) => css.replace(/\s+/g, ' ').trim();
		const app = stack(vooraf.get('--font-serif') ?? '');
		expect(app.startsWith("'Newsreader', ")).toBe(true);
		const vast = /--font-serif:([^;]+);/.exec(rule('.vaste-letter .home'))?.[1] ?? '';
		expect(style).toContain('.vaste-letter #seo:has(> .entrances),\n\t\t\t.vaste-letter .home {');
		// Until the reader leaves the start page.
		expect(read('routes/+layout.svelte')).toContain("classList.remove('vaste-letter')");
		expect(stack(vast)).toBe(app.replace("'Newsreader', ", ''));
		const head = read('app.html').split('</head>')[0];
		expect(head).toMatch(
			/requestAnimationFrame\([\s\S]*?document\.fonts\.check\("16px 'Newsreader'"\)[\s\S]*?'vaste-letter'/
		);
		// A stylesheet of the app that names a face for the title does not change it.
		expect(rule('#seo:has(> .entrances) h1')).toContain('font-family: inherit');
	});
});

describe('the first navigation', () => {
	// On the first page SvelteKit can hand `from` without a url. A callback that reads it
	// throws, the first navigation never ends, and SvelteKit never takes over the links:
	// every click loads the whole page (production only, 10 Oct 2026; docs/bediening.md).
	it('reads the url of from and to in a navigation callback only when it is there', () => {
		const sources = files(ROOT).map((path) => ({
			path: relative(ROOT, path),
			text: readFileSync(path, 'utf8')
		}));
		const offenders = sources
			.filter(({ text }) => /\b(after|before)Navigate\(/.test(text))
			.filter(({ text }) => /\b(?:from|to)!?\.url\b/.test(text))
			.map((s) => s.path);
		expect(offenders).toEqual([]);
	});
});
