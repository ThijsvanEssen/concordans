// The head of Verbonden as a table: the bron by the name it has elsewhere.
import { describeBron } from '$lib/bron/describe';
import type { GraphNode } from '$lib/graph/types';

/**
 * "Verbindingen van HR 20 december 2019 (Urgenda)": a judgment as it is cited (describeBron),
 * not by its display name; an article by its own name in lower case.
 */
export function tableTitle(node: GraphNode): string {
	const raw = node.raw;
	if (node.collection === 'articles')
		return `Verbindingen van ${raw?.display_name?.replace(/^Artikel/, 'artikel') ?? node.label}`;
	if (node.collection === 'judgments' && raw)
		return `Verbindingen van ${describeBron('judgments', node.key, raw.display_name, raw.props ?? {}, raw.cite).title}`;
	return `Verbindingen van ${raw?.display_name ?? node.label}`;
}
