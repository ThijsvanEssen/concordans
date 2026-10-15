// The name of a bron in each place that shows it, per collection, for real bronnen of the API
// (src/lib/fixtures/titles.json: light nodes of 0.79.60 with the `title` of their page): the
// tab with that title and before it is in, the card, the canvas and the netwerk panel, a row
// of Verbonden and the short label of the canvas. What a change to the names must leave as it
// is, or show here (code-eenvoud F109).
import { describe, expect, it } from 'vitest';
import type { Schema } from '$lib/api/types';
import { nodeToGraphNode } from '$lib/graph/types';
import nodes from '$lib/fixtures/titles.json';
import { describeBron } from './describe';
import { bronNaam } from './naam';
import { previewFromNode } from './preview';
import { pageName } from './tab-title';
import { onthoudTitel, titelVan } from './titels.svelte';

type Fixture = Omit<Schema<'BaseNodeDTO'>, 'type' | 'labels'> & { title: string | null };

describe('the names of a bron', () => {
	it.each(nodes as Fixture[])('$id', (n) => {
		const graphNode = nodeToGraphNode({ ...n, type: '', labels: [] })!;
		onthoudTitel({ node: { id: n.id }, title: n.title });
		const props = n.props ?? {};
		expect({
			tab: pageName(graphNode, titelVan(n.id)),
			'tab before its title': pageName(graphNode, null),
			card: previewFromNode(n.collection, n.display_name, props).title,
			canvas: bronNaam(graphNode, new Map()),
			row: describeBron(n.collection, n.key, n.display_name, props).title,
			label: graphNode.label
		}).toMatchSnapshot();
	});
});
