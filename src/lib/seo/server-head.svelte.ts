// Whether the head is still the server's (~/Development/seo-html-ontwerp.md): a readable
// address or a page served with its title, description, canonical and JSON-LD, each
// marked data-seo. Until the first step to another address the pages set no title or
// description of their own, since Svelte writes document.title over the server's.
export const serverKop = $state({
	actief: typeof document !== 'undefined' && !!document.head.querySelector('title[data-seo]'),
	/** The server's head goes; the app sets title, description and canonical itself. */
	clear() {
		for (const el of document.head.querySelectorAll('[data-seo]')) el.remove();
		serverKop.actief = false;
	}
});

/** The title of a page in the browser tab: its name, then the site's. */
export const siteTitle = (name: string): string => `${name}, Concordans`;

/** The title of a page whose bron is still on its way; the page's own name follows. */
export const LADEN_TITEL = siteTitle('Laden…');
