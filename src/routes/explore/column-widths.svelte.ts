// The columns of the Verkenner beside the text: Verbonden (panel) and the
// network (graph). A width the reader dragged is kept in this browser and wins; until then a
// column follows the screen (--panel-w-auto, --graph-w-auto in the page's style).
import { readStored, writeStored } from '$lib/util/storage';

export type Column = 'panel' | 'graph';

/**
 * How narrow and how wide a dragged column can be, and which way it grows: Verbonden stands
 * right of the text, so it grows as the handle moves left.
 */
export const COLUMN_BOUNDS: Record<Column, { min: number; max: number; grows: 1 | -1 }> = {
	panel: { min: 240, max: 560, grows: -1 },
	graph: { min: 200, max: 1400, grows: 1 }
};

/** The selector of each column, to measure the width it is shown at. */
const SELECTOR: Record<Column, string> = {
	panel: '.col--panel',
	graph: '.col--graph'
};

const KEY = 'concordans:panel-widths';
/** The names the widths are kept under. */
const SAVED: Record<Column, string> = { panel: 'panelW', graph: 'graphW' };

export function clampWidth(column: Column, width: number): number {
	const { min, max } = COLUMN_BOUNDS[column];
	return Math.max(min, Math.min(max, width));
}

/** The widths kept in this browser; an unreadable entry is no width. */
export function parseWidths(raw: string | null): Partial<Record<Column, number>> {
	if (!raw) return {};
	let saved: unknown;
	try {
		saved = JSON.parse(raw);
	} catch {
		return {};
	}
	const widths: Partial<Record<Column, number>> = {};
	for (const column of Object.keys(SAVED) as Column[]) {
		const w = (saved as Record<string, unknown> | null)?.[SAVED[column]];
		if (typeof w === 'number' && w > 0) widths[column] = w;
	}
	return widths;
}

export class ColumnWidths {
	/** The widths dragged; a column without one follows the screen. */
	dragged = $state<Partial<Record<Column, number>>>({});
	/** The drag under way, from the width the column was shown at. */
	drag = $state<{ column: Column; startX: number; startWidth: number } | null>(null);

	/** The widths kept from an earlier visit. */
	load() {
		this.dragged = parseWidths(readStored(KEY));
	}

	/** The width of `column` for its custom property; undefined where it follows the screen. */
	css(column: Column): string | undefined {
		const w = this.dragged[column];
		return w === undefined ? undefined : `${w}px`;
	}

	start = (e: PointerEvent, column: Column) => {
		e.preventDefault();
		const shown = (e.currentTarget as HTMLElement)
			.closest('.explore-graph, .explore-read')
			?.querySelector<HTMLElement>(SELECTOR[column])
			?.getBoundingClientRect().width;
		this.drag = {
			column,
			startX: e.clientX,
			startWidth: shown ?? this.dragged[column] ?? COLUMN_BOUNDS[column].min
		};
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	};

	move = (e: PointerEvent) => {
		const drag = this.drag;
		if (!drag) return;
		const delta = (e.clientX - drag.startX) * COLUMN_BOUNDS[drag.column].grows;
		this.dragged = {
			...this.dragged,
			[drag.column]: clampWidth(drag.column, drag.startWidth + delta)
		};
	};

	end = () => {
		if (!this.drag) return;
		this.drag = null;
		const saved = Object.fromEntries(
			(Object.keys(this.dragged) as Column[]).map((c) => [SAVED[c], this.dragged[c]])
		);
		writeStored(KEY, JSON.stringify(saved));
	};
}
