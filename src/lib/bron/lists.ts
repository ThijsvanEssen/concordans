// The lists of Bladeren, each at its own address (B128): /wetten lists the laws, as
// /wetten/BWBR… is one of them; /bladeren is the overview of them all. The Verkenner serves
// them (hooks.ts) and reads one as `?mode=index&kind=…` (exploreUrl); spa-routes.json gives
// each its head and a place in the sitemap.
export const LIST_PATHS = {
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
} as const;
const PATH_OF: Readonly<Record<string, string>> = LIST_PATHS;

/** The overview of Bladeren: every list in its rubriek, with its count. */
export const OVERVIEW_PATH = '/bladeren';

/** The address of a list, the overview without one; an unknown list is the dossiers. */
export const listPath = (kind: string | null): string =>
	kind === null ? OVERVIEW_PATH : (PATH_OF[kind] ?? LIST_PATHS.dossiers);

const bare = (pathname: string) => pathname.replace(/(.)\/$/, '$1');

/** The list at a path (`/wetten`, `/wetten/`), or null for any other, the overview too. */
export function listOfPath(pathname: string): string | null {
	const path = bare(pathname);
	return Object.entries(PATH_OF).find(([, p]) => p === path)?.[0] ?? null;
}

/** Whether a path is Bladeren: a list or the overview. */
export const isIndexPath = (pathname: string): boolean =>
	bare(pathname) === OVERVIEW_PATH || listOfPath(pathname) !== null;
