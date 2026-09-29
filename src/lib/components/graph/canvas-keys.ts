// Moving through the bronnen on the canvas by keyboard: ↑ and ↓ step, Home and End jump,
// and the list wraps neither way, so the ends are felt.

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
			Number(b.id === selectedId) - Number(a.id === selectedId) ||
			a.label.localeCompare(b.label, 'nl', { numeric: true })
	);
}
