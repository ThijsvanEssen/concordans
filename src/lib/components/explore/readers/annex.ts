import type { Schema } from '$lib/api/types';

// The entries of a bijlage (Awb bijlage 2: 190 of them), in its own order: each under the
// line it stands under (`heading`: a law, or a sentence that opens a part) and, when nested,
// under another entry (`parent_index`). A heading that returns later in the bijlage heads a
// new group there, so nothing is moved out of its place.

type Entry = Schema<'AnnexEntryDTO'>;

export type AnnexItem = { name: string; note: string | null; children: AnnexItem[] };
type AnnexGroup = { heading: string | null; items: AnnexItem[] };

export function annexGroups(entries: readonly Entry[]): AnnexGroup[] {
	const groups: AnnexGroup[] = [];
	const byIndex = new Map<number, AnnexItem>();
	for (const e of entries) {
		const item: AnnexItem = {
			name: e.name?.trim() ?? '',
			note: e.description?.trim() || null,
			children: []
		};
		if (e.index != null) byIndex.set(e.index, item);
		const parent = e.parent_index != null ? byIndex.get(e.parent_index) : undefined;
		if (parent) {
			parent.children.push(item);
			continue;
		}
		const heading = e.heading?.trim() || null;
		const last = groups.at(-1);
		if (last && last.heading === heading) last.items.push(item);
		else groups.push({ heading, items: [item] });
	}
	return groups;
}
