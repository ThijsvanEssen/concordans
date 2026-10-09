// Whether the head is still the server's (~/Development/seo-html-ontwerp.md): a readable
// address or a page served with its title, description, canonical and JSON-LD, each
// marked data-seo. Until the first step to another address the pages set no title or
// description of their own, since Svelte writes document.title over the server's.
export const serverKop = $state({
	actief: typeof document !== 'undefined' && !!document.head.querySelector('title[data-seo]')
});
