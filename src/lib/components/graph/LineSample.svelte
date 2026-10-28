<script lang="ts">
	// The sample of a line (Netwerkcanvas, Lijnen): its colour in its tone, stroke and arrowhead, as
	// thick as on the canvas at the default zoom. The rows of Relatie draw it so. It runs from
	// right to left, so its pattern begins at the arrowhead as on the canvas.
	import type { DrawClass } from '$lib/graph/types';
	import { EDGE_WEIGHT } from '$lib/graph/types';
	import { hasArrow } from '$lib/graph/line-kind';
	import type { Relation } from '$lib/vocabulary';
	import {
		edgeCapFor,
		edgeColorFor,
		edgeDashFor,
		edgeStyleFor,
		edgeToneFor,
		toneColour,
		lineThickness,
		arrowLength
	} from './nodeSprites';
	import { ARROW_WIDTH, DOT_RADIUS } from '$lib/graph/line-shape';

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
	const colour = $derived(
		toneColour(edgeColorFor(relation, from), edgeToneFor(relation, null, from))
	);
	const thick = $derived(Math.max(lineThickness(EDGE_WEIGHT[relation]), 1.4));
	const head = $derived(hasArrow(style) ? thick * arrowLength() : 0);
	const dot = $derived(style === 'puntenIndiener');
	const end = $derived(WIDTH - 1);
	/** The dot of Ingediend door stands clear of the line's other end. */
	const start = $derived(dot ? DOT_RADIUS + 1 : 1);
</script>

<svg width={WIDTH} height="12" viewBox="0 0 {WIDTH} 12" aria-hidden="true" class="lm"
	><line
		x1={end - head}
		y1="6"
		x2={start}
		y2="6"
		stroke={colour}
		stroke-width={thick}
		stroke-dasharray={edgeDashFor(style)}
		stroke-linecap={edgeCapFor(style)}
	/>{#if head > 0}<polygon
			points="{end - head},{6 - (head * ARROW_WIDTH) / 2} {end},6 {end - head},{6 +
				(head * ARROW_WIDTH) / 2}"
			fill={colour}
		/>{/if}{#if dot}<circle cx={start} cy="6" r={DOT_RADIUS} fill={colour} />{/if}</svg
>

<style>
	.lm {
		flex: none;
		display: block;
	}
</style>
