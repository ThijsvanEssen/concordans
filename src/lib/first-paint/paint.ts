// The first paint of a reader's address (V4, besluit 31): the Verkenner with the bron's text in
// the reader's column, in the app's own elements, classes and stylesheets, before the app has
// come. The server puts the bron in the page (`#first-paint-data`, api/seo/paint.py of the
// API) and this script after it, built on its own (vite.config.ts, `first-paint.js` beside
// index.html) and inlined by the server, so it runs before the browser paints. It shows once
// the app's stylesheets are in; the app takes the column over when its reader stands as the
// paint does (takeover.ts).
import { articleColumn, paintable, type ArticlePaint } from './article';
import type { Build, Classes } from './classes';

/** What the server gives the paint of a bron. */
type FirstPaint = ArticlePaint;

/** Where the widths a reader dragged are kept (explore/column-widths.svelte.ts). */
const WIDTHS = 'concordans:panel-widths';

/** The reader's column of the bron, or null where the paint does not set this one. */
export function column(data: FirstPaint, k: Classes): string | null {
	if (data.kind === 'article' && paintable(data.article)) return articleColumn(data, k);
	return null;
}

/** The Verkenner reading a bron (explore/+page.svelte): its contents beside it where it has
 *  them (a column, on a narrow screen the tab Inhoud), the reader, Verbonden; only the reader's
 *  column holds anything. */
export function frame(col: string, k: Classes, contents: boolean, style = ''): string {
	const p = k.page;
	return (
		`<div class="explore-shell ${p}"><div class="explore-content ${p}">` +
		`<div class="explore-read${contents ? ' explore-read--with-nav' : ''} ${p}"${style ? ` style="${style}"` : ''}>` +
		(contents
			? `<nav class="mobile-tabs ${p}"><button type="button" class="mobile-tab mobile-tab--toc ${p}" tabindex="-1" data-later>Inhoud</button></nav>`
			: '') +
		`<div class="col col--nav toc-column ${p}"${contents ? '' : ' hidden'}></div>` +
		`<div class="col col--reader col--measure ${p}"><div class="reader ${p}"><div class="reader__main ${p}">` +
		`<div class="reader-frame ${k.frame}"><div class="reader-frame__col ${k.frame}">${col}</div></div>` +
		'</div></div></div>' +
		`<div class="resize-handle resize-handle--panel ${p}"></div>` +
		`<div class="col col--panel ${p}"></div>` +
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
export function paint(doc: Document, build: Build) {
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
	const col = column(read, build.classes);
	if (!col) return;
	const el = doc.createElement('div');
	el.id = 'first-paint';
	el.className = 'ev';
	// Contents beside the text where its law has more than this one article (contents-state):
	// an article its law lists alone has none; one the list leaves out (repealed) stands in a
	// law that has.
	const steps = read.steps;
	const contents = !steps?.listed || steps.prev || steps.next;
	el.innerHTML = frame(col, build.classes, contents, widths());
	seo.after(el);
	// The letter it is painted in holds for the app's reader too (app.html, .vaste-letter).
	doc.documentElement.classList.add('first-paint');
	stylesheets(doc, build.css, () => el.classList.add('ev--ready'));
}
