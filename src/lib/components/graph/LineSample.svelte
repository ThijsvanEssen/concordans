<script lang="ts">
	// The sample of a line (Netwerkcanvas, Lijnen): its colour, stroke and arrowhead, as thick as
	// on the canvas at the default zoom. The rows of Relatie draw it so.
	import type { DrawClass } from '$lib/graph/types';
	import { EDGE_WEIGHT } from '$lib/graph/types';
	import type { Relation } from '$lib/vocabulary';
	import {
		edgeColorFor,
		edgeDashFor,
		edgeStyleFor,
		lineThickness,
		arrowLength,
		ARROW_WIDTH
	} from './nodeSprites';

	const WIDTH = 28;
	let {
		relation,
		from = 'article'
	}: {
		relation: Relation;
		/** The kind the line comes from: a citation by an article is structural, otherwise not. */
		from?: DrawClass;
	} = $props();

	const style = $derived(edgeStyleFor(relation, null, from));
	const colour = $derived(edgeColorFor(relation, from));
	const thick = $derived(Math.max(lineThickness(EDGE_WEIGHT[relation]), 1.4));
	const head = $derived(style === 'lid' ? 0 : thick * arrowLength());
	const end = $derived(WIDTH - 1);
</script>

<svg width={WIDTH} height="12" viewBox="0 0 {WIDTH} 12" aria-hidden="true" class="lm"
	><line
		x1="1"
		y1="6"
		x2={end - head}
		y2="6"
		stroke={colour}
		stroke-width={thick}
		stroke-dasharray={edgeDashFor(style)}
	/>{#if head > 0}<polygon
			points="{end - head},{6 - (head * ARROW_WIDTH) / 2} {end},6 {end - head},{6 +
				(head * ARROW_WIDTH) / 2}"
			fill={colour}
		/>{/if}</svg
>

<style>
	.lm {
		flex: none;
		display: block;
	}
</style>
