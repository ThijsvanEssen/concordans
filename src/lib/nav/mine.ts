// Mijn, the personal part of the navigation (besluit 36): what the reader keeps and follows.
// One list for the menu of the top bar and the sheet of the tab bar.
import { BUNDLES_PATH } from '$lib/map/page';

type MineId = 'bundels' | 'gevolgd';

export const MINE: readonly { id: MineId; label: string; href: string }[] = [
	{ id: 'bundels', label: 'Bundels', href: BUNDLES_PATH },
	{ id: 'gevolgd', label: 'Gevolgd', href: '/onderwerpen' }
];

const onPage = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/** The item of Mijn the page at `path` is, or null. */
export const mineAt = (path: string): MineId | null =>
	MINE.find((m) => onPage(path, m.href))?.id ?? null;
