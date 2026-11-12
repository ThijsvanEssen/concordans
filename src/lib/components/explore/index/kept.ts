// Back from a bron finds a list of Bladeren as it was left: the pages loaded and the place in
// the list, per URL, for as long as the tab is open. What the tab kept is read element by
// element: an old or broken entry is left out, never followed (`k.url` of null threw).
import { arrayOf, readJson, writeJson } from '$lib/util/storage';
import type { Page } from './lists/list';

export type Kept = { url: string; category: string; page: Page<unknown>; scroll: number };

const KEPT = 'concordans:bladeren';
const KEPT_MAX = 6;

const isKept = (k: unknown): k is Kept => {
	const o = k as Partial<Kept> | null;
	return (
		typeof o?.url === 'string' &&
		typeof o.category === 'string' &&
		typeof o.scroll === 'number' &&
		Array.isArray(o.page?.items)
	);
};

/** The lists this tab kept, the most recent first. */
export const readKept = (): Kept[] =>
	readJson('session', KEPT, (raw) => arrayOf(raw).filter(isKept)) ?? [];

/** Keep `entry` first, in place of what was kept under its URL. */
export function keepList(entry: Kept): void {
	const rest = readKept().filter((k) => k.url !== entry.url);
	writeJson('session', KEPT, [entry, ...rest].slice(0, KEPT_MAX));
}
