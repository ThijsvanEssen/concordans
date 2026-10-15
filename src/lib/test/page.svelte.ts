// SvelteKit's page for a DOM test (vi.mock of $app/state and $app/navigation): the address
// reacts, and goto moves it as the app's own navigation does.
export const page = $state({ url: new URL('http://localhost/explore') });

/** Opens the page at `href`, relative to the address it is on. */
export function visit(href: string) {
	page.url = new URL(href, page.url);
}

export const goto = (href: string) => {
	visit(href);
	return Promise.resolve();
};
