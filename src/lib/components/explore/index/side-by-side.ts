import type { Schema } from '$lib/api/types';
import type { Ministry } from './government';

// The rows of the ministers side by side: a row per post of a minister, a column per
// cabinet. The ministries and their order come from the API (`getMinistries`): a renamed
// ministry follows its successors to the one of today and keeps one row, the rows stand in
// protocol order, the minister-president first.

type Detail = Schema<'CabinetDetailDTO'>;
export type CabinetMinistry = NonNullable<Detail['ministries']>[number];
export type CabinetSeat = CabinetMinistry['seats'][number];

export type SideBySideRow<Cell> = {
	/** The ministry of today and the post: `jenv/minister`. */
	key: string;
	/** The ministry's name in the newest cabinet that has the post. */
	title: string;
	primeMinister: boolean;
	/** One per column; null where the cabinet has no one on the post. */
	cells: (Cell | null)[];
};

const MINISTER_POSTS = new Set(['minister', 'minister-president']);

/** The ministry of today a ministry became, and its place in protocol order. */
export function ministryOrder(ministries: readonly Ministry[]) {
	const byKey = new Map<string, Ministry>(ministries.map((m) => [m.key, m]));
	const current = (key: string): string => {
		const seen = new Set<string>();
		let k = key;
		while (!seen.has(k) && byKey.get(k)?.successor) {
			seen.add(k);
			k = byKey.get(k)!.successor!;
		}
		return k;
	};
	const rank = (key: string): number => {
		const i = ministries.findIndex((m) => m.key === current(key));
		return i < 0 ? ministries.length : i;
	};
	const name = (key: string): string | undefined => byKey.get(current(key))?.name;
	return { current, rank, name };
}

/**
 * The rows over the columns' cabinets (null while one loads). `cellOf` makes the cell of a
 * seat in a column, or null when nothing of it is shown (a search that finds no one).
 */
export function sideBySideRows<Cell>(
	columns: readonly (Detail | null)[],
	ministries: readonly Ministry[],
	cellOf: (seat: CabinetSeat, detail: Detail, column: number) => Cell | null
): SideBySideRow<Cell>[] {
	const { current, rank, name } = ministryOrder(ministries);
	const rows = new Map<string, SideBySideRow<Cell>>();
	const titles = new Map<string, string>();
	columns.forEach((detail, column) => {
		for (const ministry of detail?.ministries ?? [])
			for (const seat of ministry.seats) {
				if (!ministry.ministry || !seat.post || !MINISTER_POSTS.has(seat.post)) continue;
				if (seat.portfolio) continue;
				const key = `${current(ministry.ministry)}/${seat.post}`;
				const title = ministry.name ?? name(ministry.ministry) ?? key;
				titles.set(key, title);
				const cell = cellOf(seat, detail!, column);
				if (!cell) continue;
				const row = rows.get(key) ?? {
					key,
					title,
					primeMinister: seat.post === 'minister-president',
					cells: columns.map(() => null)
				};
				row.cells[column] = cell;
				rows.set(key, row);
			}
	});
	const rankOf = (key: string) => rank(key.split('/')[0]);
	return [...rows.values()]
		.map((row) => ({ ...row, title: titles.get(row.key)! }))
		.sort((a, b) => rankOf(a.key) - rankOf(b.key));
}
