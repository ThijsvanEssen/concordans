// The name of a bron in the browser tab: short enough to tell tabs, bookmarks and history
// apart. The title the API gives the bron, as the server's page has it (#529), cut at a word;
// a Kamerstuk by its place as a citation writes it.
import { textOf, truncate } from '$lib/text/words';
import type { BaseNode, GraphNode } from '$lib/graph/types';
import { isRauw, menselijkeNaam } from './menselijk';
import { describeBron, UNNAMED } from './describe';
import { zonderKopInKapitalen } from './titels.svelte';
import { kamerstukLabel } from '$lib/components/parliamentary/kamerstuk';

const MAX = 80;

/** A name cut at a word within `MAX` characters. */
export const cut = (name: string): string => truncate(name, MAX, { atWord: true });

type TitledNode = Pick<GraphNode, 'collection' | 'label'> & {
	raw?: Pick<BaseNode, 'display_name' | 'props'> & Partial<Pick<BaseNode, 'title' | 'cite'>>;
};

/**
 * A Kamerstuk by its kind, title and place as a citation writes it: `Brief regering:
 * Werkprogramma AWTI 2025 (36600 VIII, nr. 5)`, not the data's `36600-VIII-5` (#84). Null for
 * a paper that is no Kamerstuk.
 */
export function documentTitle(node: TitledNode): string | null {
	if (node.collection !== 'documents') return null;
	const props = node.raw?.props ?? {};
	const place = kamerstukLabel({
		chamber: textOf(props.chamber),
		dossier_number: textOf(props.dossier_number),
		dossier_suffix: textOf(props.dossier_suffix),
		number: textOf(props.sequence != null ? String(props.sequence) : props.number)
	});
	if (!place) return null;
	const name = [textOf(props.kind), textOf(props.title)].filter(Boolean).join(': ');
	return cut(name ? `${name} (${place})` : place);
}

/**
 * The name of a bron in the tab: a Kamerstuk by its place as a citation writes it (`36600 VIII,
 * nr. 5`, not the API's `36600-VIII-5`, #84); anything else by the title the API gives it
 * (`apiTitle` as kept from its node, else the node's own), without a heading in capitals; before
 * that is in, the name its row in Verbonden has.
 */
export function pageName(node: TitledNode, apiTitle: string | null): string {
	const document = documentTitle(node);
	if (document) return document;
	const title = textOf(apiTitle) ?? textOf(node.raw?.title);
	if (title) return cut(zonderKopInKapitalen(title));
	const display = node.raw?.display_name ?? null;
	const named = describeBron(
		node.collection,
		'',
		display,
		node.raw?.props ?? {},
		node.raw?.cite
	).title;
	return cut(
		named && named !== UNNAMED && !isRauw(named)
			? named
			: menselijkeNaam({
					collection: node.collection,
					display_name: display,
					props: node.raw?.props
				})
	);
}
