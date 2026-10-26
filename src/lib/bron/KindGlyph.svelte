<script lang="ts">
	// The one glyph of a kind of bron, as on the canvas. The shape says what a bron
	// is, in ink (vormen.ts); in the werkplek and its legend in the colour of its kind
	// (`colour`, kleur.ts), as the canvas draws it (A197).
	import type { Collection } from '$lib/vocabulary';
	import { VORMEN, VORM_VAN, type Vorm } from './vormen';

	let {
		collection,
		vorm,
		size = 12,
		colour,
		open = false
	}: {
		collection?: Collection;
		vorm?: Vorm;
		size?: number;
		colour?: string;
		/** As an outline, as the canvas draws a lid that is gone (N13). */
		open?: boolean;
	} = $props();
	const v = $derived(VORMEN[vorm ?? (collection ? VORM_VAN[collection] : undefined) ?? 'overig']);
	const lijn = $derived(open || v.wijze === 'lijn');
</script>

<svg
	class="kind-glyph"
	width={size}
	height={size}
	viewBox="0 0 16 16"
	aria-hidden="true"
	style:color={colour}
	fill={lijn ? 'none' : 'currentColor'}
	stroke={lijn ? 'currentColor' : 'none'}
	stroke-width={lijn ? (open ? 1.25 : 2) : 0}
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
