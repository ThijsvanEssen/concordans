// The first paint of a reader's address (V4, besluit 31): the Verkenner with the bron's text in
// the reader's column, in the app's own elements, classes and stylesheets, before the app has
// come. The server puts the bron in the page (`#first-paint-data`, api/seo/paint.py of the
// API) and this script after it, built on its own (vite.config.ts, `first-paint.js` beside
// index.html) and inlined by the server, so it runs before the browser paints. It shows once
// the app's stylesheets are in; the app takes the column over when its reader stands as the
// paint does (takeover.ts).
import { measurePlaces } from '$lib/bron/place-column';
import type { ArticlePaint } from './article';
import type { Build, Classes } from './classes';
import type { JudgmentPaint } from './judgment';
import type { LawPaint } from './law';
import type { PaperPaint } from './paper';

/** What the server gives the paint of a bron. */
type FirstPaint = ArticlePaint | JudgmentPaint | LawPaint | PaperPaint;

/** The reader's column of a bron and whether contents stand beside it (contents-state). */
export type PaintedColumn = { html: string; contents: boolean };

/** The column per kind of bron a script paints, null where it does not paint this one: the
 *  build makes a script per kind (entry-*.ts), so a page carries only the code of its own. */
type Painters = {
	[K in FirstPaint['kind']]?: (
		data: Extract<FirstPaint, { kind: K }>,
		k: Classes
	) => PaintedColumn | null;
};

/** The column of `data` by the painter of its kind. */
export function column(data: FirstPaint, k: Classes, painters: Painters): PaintedColumn | null {
	if (data.kind === 'article') return painters.article?.(data, k) ?? null;
	if (data.kind === 'judgment') return painters.judgment?.(data, k) ?? null;
	if (data.kind === 'law') return painters.law?.(data, k) ?? null;
	if (data.kind === 'paper') return painters.paper?.(data, k) ?? null;
	return null;
}

/** Where the widths a reader dragged are kept (explore/column-widths.svelte.ts). */
const WIDTHS = 'concordans:panel-widths';

/** The Verkenner reading a bron (explore/+page.svelte): its contents beside it where it has
 *  them (a column, on a narrow screen the tab Inhoud), the reader, Verbonden; only the reader's
 *  column holds anything. */
export function frame(col: string, k: Classes, contents: boolean, style = ''): string {
	const p = k.page;
	return (
		`<div class="explore-shell ${p}"><div class="explore-content ${p}">` +
		`<div class="explore-read${contents ? ' explore-read--with-nav' : ''} ${p}"${style ? ` style="${style}"` : ''}>` +
		// The bar of a narrow screen: on a phone the tabs Tekst and Verbonden, Inhoud where the
		// bron has contents (A197-a).
		`<nav class="mobile-tabs${contents ? '' : ' mobile-tabs--tabs'} ${p}"><div class="lees-tabs ${p}"><div class="keuze vol ${k.choice}" role="group" aria-label="Tekst of Verbonden"><button type="button" class="${k.choice}" aria-pressed="true" tabindex="-1">Tekst</button><button type="button" class="${k.choice}" aria-pressed="false" tabindex="-1">Verbonden</button></div></div>` +
		(contents
			? `<button type="button" class="btn mobile-tab--toc ${p}" tabindex="-1" data-later>Inhoud</button>`
			: '') +
		'</nav>' +
		`<div class="col col--nav toc-column ${p}"${contents ? '' : ' hidden'}></div>` +
		`<div class="col col--reader col--measure ${p}"><div class="reader ${p}"><div class="reader__main ${p}">` +
		`<div class="reader-frame ${k.frame}"><div class="reader-frame__col ${k.frame}">${col}</div></div>` +
		'</div></div></div>' +
		`<div class="resize-handle resize-handle--panel ${p}"></div>` +
		`<div class="col col--panel mobile-hidden ${p}"></div>` +
		'</div></div></div>'
	);
}

/** The widths kept in this browser, as the custom properties of the Verkenner. */
function widths(): string {
	let saved: Record<string, unknown> = {};
	try {
		saved = JSON.parse(localStorage.getItem(WIDTHS) ?? '{}') ?? {};
	} catch {
		return '';
	}
	return ([['panelW', '--panel-w']] as const)
		.flatMap(([name, prop]) => {
			const w = saved[name];
			return typeof w === 'number' && w > 0 ? [`${prop}: ${w}px`] : [];
		})
		.join('; ');
}

/** The app's stylesheets, each once: the paint shows when all are in (or failed). */
function stylesheets(doc: Document, hrefs: string[], done: () => void) {
	let left = hrefs.length;
	const one = () => {
		left -= 1;
		if (left === 0) done();
	};
	if (left === 0) return done();
	for (const href of hrefs) {
		const link = doc.createElement('link');
		link.rel = 'stylesheet';
		link.href = href;
		link.onload = one;
		link.onerror = one;
		doc.head.append(link);
	}
}

/** Paints the bron of `#first-paint-data` after `#seo`. Only an address as it is shared, read
 *  as the app opens it: no view in the query, no place in the fragment (the app lands there
 *  itself). */
export function paint(doc: Document, build: Build, painters: Painters) {
	const data = doc.getElementById('first-paint-data');
	const seo = doc.getElementById('seo');
	if (!data || !seo || !doc.documentElement.classList.contains('js')) return;
	if (doc.location.search || doc.location.hash) return;
	let read: FirstPaint;
	try {
		read = JSON.parse(data.textContent ?? '');
	} catch {
		return;
	}
	const col = column(read, build.classes, painters);
	if (!col) return;
	const el = doc.createElement('div');
	el.id = 'first-paint';
	el.className = 'ev';
	el.innerHTML = frame(col.html, build.classes, col.contents, widths());
	// A bron without contents: the app leaves the tab Inhoud out from the start too
	// (contents-state), so nothing moves when it takes over.
	const focus = doc.querySelector<HTMLMetaElement>('meta[name="focus"]')?.content;
	if (!col.contents && focus) doc.documentElement.dataset.noContents = focus;
	seo.after(el);
	// The letter it is painted in holds for the app's reader too (app.html, .vaste-letter).
	doc.documentElement.classList.add('first-paint');
	// The margin of the numbers as wide as the reader's will be, once the letters are in.
	const places = () => el.querySelectorAll<HTMLElement>('.reader-body').forEach(measurePlaces);
	stylesheets(doc, build.css, () => {
		places();
		el.classList.add('ev--ready');
		// Measured again once the letters are in; as it stands where they never come.
		doc.fonts?.ready.then(places, places);
	});
}
