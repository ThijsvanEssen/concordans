/**
 * What the heading of a bron already names is no verbinding of it (T11): the bron itself, the
 * law an article is part of, the dossier a law was enacted in (it stands in the kruimelpad), its
 * own publication in the Staatsblad.
 */
import { isKernGroep } from '$lib/bron/behoort';
import type { Collection } from '$lib/vocabulary';
import { groupCount, type Group } from './groups';
import type { Row } from './rows';

type Bron = { collection: string; key: string; props: Record<string, unknown> };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Whether a row is a thing the heading of `bron` already names. */
export function namedByHeader(row: Row, bron: Bron): boolean {
	const { collection, key } = row.ref;
	if (collection === bron.collection && norm(key) === norm(bron.key)) return true;
	const p = bron.props;
	if (bron.collection === 'articles' && collection === 'instruments') {
		return norm(key).length > 3 && norm(bron.key).startsWith(norm(key));
	}
	if (collection === 'dossiers') {
		const numbers = Array.isArray(p.dossier_numbers) ? (p.dossier_numbers as unknown[]) : [];
		const number = 'number' in row.ref ? row.ref.number : key;
		return (
			bron.collection === 'instruments' && numbers.length === 1 && String(numbers[0]) === number
		);
	}
	const own = typeof p.enacted_publication === 'string' ? norm(p.enacted_publication) : '';
	return !!own && bron.collection === 'instruments' && norm(key) === own;
}

/** The groups without those rows; a group left empty goes, a counted total drops by what went. */
export function withoutHeaderDupes(groups: Group[], bron: Bron): Group[] {
	return groups.flatMap((g) => {
		// The kern is the heading's own line: it shows what the heading names.
		if (isKernGroep(bron.collection as Collection, g)) return [g];
		const rows = g.rows.filter((r) => !namedByHeader(r, bron));
		const gone = g.rows.length - rows.length;
		if (gone === 0) return [g];
		const total = g.total == null ? g.total : Math.max(0, g.total - gone);
		const next = { ...g, rows, total };
		return groupCount(next) === 0 && !g.laden && !g.load ? [] : [next];
	});
}
