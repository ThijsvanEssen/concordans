// While developing: what scrolls sideways on a narrow screen, as a warning in the console.
// Nothing may, on a phone: a list, a reader and a page fit their width. What pans on purpose
// (the categories of Bladeren, the cabinets in time, the line of tekstversies) says so with
// `data-zijscroll`.

/** Up to this width a screen counts as narrow. */
const SMAL = 640;

/** The page or a scroll area wider than it is, each as `tag.class +Npx`. */
export function zijscroll(root: Document = document): string[] {
	const out: string[] = [];
	const page = root.documentElement.scrollWidth - root.documentElement.clientWidth;
	if (page > 1) out.push(`pagina +${page}px`);
	for (const e of root.body.querySelectorAll<HTMLElement>('*')) {
		if (e.clientWidth === 0 || e.scrollWidth <= e.clientWidth + 1) continue;
		if (e.closest('[data-zijscroll]')) continue;
		const { overflowX } = getComputedStyle(e);
		if (overflowX !== 'auto' && overflowX !== 'scroll') continue;
		out.push(
			`${e.tagName.toLowerCase()}.${[...e.classList].join('.')} +${e.scrollWidth - e.clientWidth}px`
		);
	}
	return out;
}

/**
 * A page that scrolls in its own columns (a reader, the network: `.explore-graph`,
 * `.explore-read`) and is still taller than the screen, by so many px; 0 where it fits or the
 * page scrolls as a whole. Every reader was 15 px too tall on a phone, so the page slid under
 * the top bar and a tap on its bounce only stopped it (UX-toets 10 Oct, #35).
 */
export function teHoog(root: Document = document): number {
	if (!root.querySelector('.explore-graph, .explore-read')) return 0;
	const over = root.documentElement.scrollHeight - root.documentElement.clientHeight;
	return over > 1 ? over : 0;
}

/** After a page has loaded its data: a warning when something on a narrow screen scrolls sideways. */
export function meldZijscroll(path: string, wait = 4000) {
	setTimeout(() => {
		if (window.innerWidth > SMAL) return;
		const found = zijscroll();
		if (found.length)
			console.warn(`Zijscroll op ${window.innerWidth}px (${path}): ${found.join(', ')}`);
		const hoog = teHoog();
		if (hoog) console.warn(`Te hoog op ${window.innerWidth}px (${path}): pagina +${hoog}px`);
	}, wait);
}
