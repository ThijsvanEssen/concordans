// J and K through the rows of a list (Thijs, 10 Oct, from the UX proposal): J the next row,
// K the one before, Enter opens it as a click would; only while the focus is in the list
// (WCAG 2.1.4; Alt K is Keten since 30 Oct). Not while typing. The register (lib/keys) holds it.

import { hasModifier, mayShortcut } from './keys';

/** The row to go to from `nu` (-1 for none yet), one step `richting`, kept inside the list. */
export function stap(nu: number, aantal: number, richting: 1 | -1): number {
	if (aantal === 0) return -1;
	if (nu < 0) return richting === 1 ? 0 : aantal - 1;
	return Math.min(aantal - 1, Math.max(0, nu + richting));
}

type Lijst = { node: HTMLElement; rij: string };
const lijsten = new Set<Lijst>();

const zichtbaar = (el: HTMLElement) => el.offsetParent !== null && el.getClientRects().length > 0;

/** Moves the focus one row on in `lijst`, from the row that holds it. */
function loop(lijst: Lijst, richting: 1 | -1): boolean {
	const actief = document.activeElement as HTMLElement | null;
	const rijen = [...lijst.node.querySelectorAll<HTMLElement>(lijst.rij)].filter(zichtbaar);
	const nu = rijen.findIndex((r) => r === actief || r.contains(actief));
	const i = stap(nu, rijen.length, richting);
	if (i < 0) return false;
	rijen[i].focus({ preventScroll: true });
	rijen[i].scrollIntoView({ block: 'nearest' });
	return true;
}

/** J and K alone: only while the focus is in the list, so a letter is never a key of the page. */
function opToets(e: KeyboardEvent) {
	if (hasModifier(e) || !mayShortcut(e)) return;
	const toets = e.key.toLowerCase();
	if (toets !== 'j' && toets !== 'k') return;
	const actief = document.activeElement as HTMLElement | null;
	const lijst = [...lijsten].find((l) => actief && l.node.contains(actief));
	if (lijst && loop(lijst, toets === 'j' ? 1 : -1)) e.preventDefault();
}

/** `use:rijen={'a.row-title'}`: the selector of the focusable element of a row. */
export function rijen(node: HTMLElement, rij: string) {
	const lijst: Lijst = { node, rij };
	if (lijsten.size === 0) window.addEventListener('keydown', opToets);
	lijsten.add(lijst);
	return {
		update(nieuw: string) {
			lijst.rij = nieuw;
		},
		destroy() {
			lijsten.delete(lijst);
			if (lijsten.size === 0) window.removeEventListener('keydown', opToets);
		}
	};
}

/**
 * After a next page: the focus to the first row it added (`index`), where the button that
 * asked for it gave way to "Laden…" and left the focus on the body: the row itself where it is
 * a link or button, else its first. Focus the reader put elsewhere meanwhile stays.
 */
export function focusFirstNew(node: HTMLElement, rij: string, index: number) {
	const active = document.activeElement;
	if (active && active !== document.body) return;
	const row = node.querySelectorAll<HTMLElement>(rij)[index];
	const control = row?.matches(CONTROL) ? row : row?.querySelector<HTMLElement>(CONTROL);
	control?.focus({ preventScroll: true });
}

/** What takes the focus in a row. */
const CONTROL = 'a[href], button';
