// Moving through the bronnen on the canvas by keyboard: ↑ and ↓ step, Home and End jump,
// and the list wraps neither way, so the ends are felt.
import { NL } from '$lib/text/collator';

export function moveIndex(key: string, index: number, count: number): number | null {
	if (count === 0) return null;
	switch (key) {
		case 'ArrowDown':
			return Math.min(index + 1, count - 1);
		case 'ArrowUp':
			return Math.max(index - 1, 0);
		case 'Home':
			return 0;
		case 'End':
			return count - 1;
		default:
			return null;
	}
}

/** The order the list reads the canvas in: the selected bron first, then by name. */
export function readingOrder<T extends { id: string; label: string }>(
	nodes: T[],
	selectedId: string | null
): T[] {
	return [...nodes].sort(
		(a, b) =>
			Number(b.id === selectedId) - Number(a.id === selectedId) || NL.compare(a.label, b.label)
	);
}

/**
 * The bron the arrows point at on the canvas itself (R9, WCAG 3.2.1): ← and → step through
 * the bronnen in the list's reading order (`readingOrder`: the selected bron first, then by
 * name), Home and End jump, and the ends are felt as in the list. From no bron, → starts
 * at the first and ← at the last. Undefined for any other key. Pointing chooses nothing;
 * Enter does.
 */
export function stepPointer(key: string, at: string | null, ids: string[]): string | undefined {
	const i = at === null ? -1 : ids.indexOf(at);
	const vertaald =
		key === 'ArrowRight'
			? 'ArrowDown'
			: key === 'ArrowLeft'
				? 'ArrowUp'
				: key === 'Home' || key === 'End'
					? key
					: null;
	if (!vertaald || ids.length === 0) return undefined;
	if (i < 0 && vertaald === 'ArrowDown') return ids[0];
	if (i < 0 && vertaald === 'ArrowUp') return ids[ids.length - 1];
	const next = moveIndex(vertaald, Math.max(i, 0), ids.length);
	return next === null ? undefined : ids[next];
}
