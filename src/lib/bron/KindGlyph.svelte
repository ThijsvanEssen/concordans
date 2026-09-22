<script lang="ts">
	// The one glyph of a kind of bron: the shape and colour it has on the canvas.
	import { kindOfCollection } from '$lib/graph/types';
	import { fillFor, shapeFor, strokeFor } from '$lib/components/graph/nodeSprites';
	import type { Collection } from '$lib/vocabulary';

	let { collection, size = 12 }: { collection: Collection; size?: number } = $props();

	const kind = $derived(kindOfCollection(collection));
	const shape = $derived(shapeFor(kind));
	const R = 4.5;
	const HEXAGON = `${6 + R},6 ${6 + R / 2},${6 - R * 0.866} ${6 - R / 2},${6 - R * 0.866} ${6 - R},6 ${6 - R / 2},${6 + R * 0.866} ${6 + R / 2},${6 + R * 0.866}`;
	const DIAMOND = `6,${6 - R} ${6 + R},6 6,${6 + R} ${6 - R},6`;
	const SQUARE = `${6 - R},${6 - R} ${6 + R},${6 - R} ${6 + R},${6 + R} ${6 - R},${6 + R}`;
</script>

<svg
	class="kind-glyph"
	width={size}
	height={size}
	viewBox="0 0 12 12"
	aria-hidden="true"
	fill={fillFor(kind)}
	stroke={strokeFor(kind)}
	stroke-width="1.5"
>
	{#if shape === 'circle'}
		<circle cx="6" cy="6" r={R - 0.5} />
	{:else}
		<polygon points={shape === 'diamond' ? DIAMOND : shape === 'hexagon' ? HEXAGON : SQUARE} />
	{/if}
</svg>

<style>
	.kind-glyph {
		flex: none;
		vertical-align: -1px;
	}
</style>
