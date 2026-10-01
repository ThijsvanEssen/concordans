<script lang="ts">
	// The one glyph of a kind of bron, as on the canvas. Ronde 5: the shape says what a bron
	// is, in ink (vormen.ts); there is no colour to remember.
	import type { Collection } from '$lib/vocabulary';
	import { VORMEN, VORM_VAN } from './vormen';

	let { collection, size = 12 }: { collection: Collection; size?: number } = $props();
	const v = $derived(VORMEN[VORM_VAN[collection] ?? 'overig']);
</script>

<svg
	class="kind-glyph"
	width={size}
	height={size}
	viewBox="0 0 16 16"
	aria-hidden="true"
	fill={v.wijze === 'lijn' ? 'none' : 'currentColor'}
	stroke={v.wijze === 'lijn' ? 'currentColor' : 'none'}
	stroke-width={v.wijze === 'lijn' ? 2 : 0}
	fill-rule={v.wijze === 'gat' ? 'evenodd' : 'nonzero'}
>
	<path d={v.d} />
</svg>

<style>
	.kind-glyph {
		flex: none;
		vertical-align: -1px;
		color: var(--ink);
	}
</style>
