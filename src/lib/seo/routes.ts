// The pages of the app that are not a bron, with their fixed title and description. One
// source for two readers: the pages set their head from it (RouteKop), and the server
// (Back-end #2, ~/Development/seo-html-ontwerp.md) reads the built copy, spa-routes.json
// next to index.html, for the head it serves and to tell a page from a 404.
import routes from './spa-routes.json';

export type SpaRoute = {
	path: string;
	title: string;
	description: string;
	/** `false`: a page of this browser alone (Gemarkeerd), noindex and not in the sitemap. */
	index?: boolean;
};

export const SPA_ROUTES: readonly SpaRoute[] = routes;

/** The head of a page by its path; a path that is not in the list is a mistake. */
export function routeKop(path: string): SpaRoute {
	const r = SPA_ROUTES.find((x) => x.path === path);
	if (!r) throw new Error(`${path} staat niet in src/lib/seo/spa-routes.json`);
	return r;
}

/**
 * The canonical address of a view: the path without the query, the view state. A bron
 * without a readable address is still /explore?focus=…, and is its own canonical.
 */
export function canonical(url: URL): string {
	const focus = url.pathname === '/explore' ? url.searchParams.get('focus') : null;
	return `${url.origin}${url.pathname}${focus ? `?focus=${focus}` : ''}`;
}
