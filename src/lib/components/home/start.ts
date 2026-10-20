// The fixed text of the start page: its heading, what Concordans is, the search field and the
// three ways in. One source for the app and for the server's HTML of `/` (the first paint,
// home.py of the back end): the build puts start.json beside index.html, and a test keeps
// the server's copy (start-server.html) equal to it.
import start from './start.json';
import type { Collection } from '$lib/vocabulary';

type Line = { collection: Collection; label: string; href: string };

export const START = start as Omit<typeof start, 'article' | 'bundle'> & {
	article: Omit<typeof start.article, 'parts'> & {
		parts: { collection: Collection; label: string; bronnen: string }[];
	};
	bundle: Omit<typeof start.bundle, 'lines'> & { lines: Line[] };
};
