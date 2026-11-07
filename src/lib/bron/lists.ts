// The lists of Bladeren, each at its own address (B128): /wetten lists the laws, as
// /wetten/BWBR… is one of them; /bladeren is the overview of them all. The Verkenner serves
// them (hooks.ts) and reads one as `?mode=index&kind=…` (exploreUrl); spa-routes.json gives
// each its head and a place in the sitemap.
import type { IndexCategory } from '$lib/components/explore/index/categories';

export const LIST_PATHS: Readonly<Record<IndexCategory, string>> = {
	instruments: '/wetten',
	judgments: '/uitspraken',
	dossiers: '/dossiers',
	documents: '/kamerstukken',
	decisions: '/stemmingen',
	commitments: '/toezeggingen',
	members: '/leden',
	factions: '/fracties',
	committees: '/commissies',
	cabinets: '/kabinetten',
	ministries: '/ministeries',
	ministers: '/bewindspersonen'
};

/** The overview of Bladeren: every list in its rubriek, with its count. */
export const OVERVIEW_PATH = '/bladeren';

/** The address of a list, the overview without one; an unknown list is the dossiers. */
export const listPath = (kind: string | null): string =>
	kind === null ? OVERVIEW_PATH : (LIST_PATHS[kind as IndexCategory] ?? LIST_PATHS.dossiers);

const bare = (pathname: string) => pathname.replace(/(.)\/$/, '$1');

/** The list at a path (`/wetten`, `/wetten/`), or null for any other, the overview too. */
export function listOfPath(pathname: string): IndexCategory | null {
	const path = bare(pathname);
	const found = Object.entries(LIST_PATHS).find(([, p]) => p === path);
	return found ? (found[0] as IndexCategory) : null;
}

/** Whether a path is Bladeren: a list or the overview. */
export const isIndexPath = (pathname: string): boolean =>
	bare(pathname) === OVERVIEW_PATH || listOfPath(pathname) !== null;
