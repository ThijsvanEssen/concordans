<script lang="ts">
	// The sample of a line (Netwerkcanvas, Lijnen): its colour, stroke and arrowhead, as thick as
	// on the canvas at the default zoom. The legend's two keys, Relatie and Lijnen, draw it so.
	import type { DrawClass } from '$lib/graph/types';
	import { EDGE_WEIGHT } from '$lib/graph/types';
	import type { Relation } from '$lib/vocabulary';
	import {
		edgeColorFor,
		edgeDashFor,
		edgeStyleFor,
		lijnDikte,
		pijlLengte,
		PIJL_BREED
	} from './nodeSprites';

	let {
		relation,
		van = 'article',
		breedte = 28
	}: {
		relation: Relation;
		/** The kind the line comes from: a citation by an article is structural, otherwise not. */
		van?: DrawClass;
		breedte?: number;
	} = $props();

	const stijl = $derived(edgeStyleFor(relation, null, van));
	const kleur = $derived(edgeColorFor(relation, van));
	const dik = $derived(Math.max(lijnDikte(EDGE_WEIGHT[relation]), 1.4));
	const kop = $derived(stijl === 'lid' ? 0 : dik * pijlLengte());
	const eind = $derived(breedte - 1);
</script>

<svg width={breedte} height="12" viewBox="0 0 {breedte} 12" aria-hidden="true" class="lm"
	><line
		x1="1"
		y1="6"
		x2={eind - kop}
		y2="6"
		stroke={kleur}
		stroke-width={dik}
		stroke-dasharray={edgeDashFor(stijl)}
	/>{#if kop > 0}<polygon
			points="{eind - kop},{6 - (kop * PIJL_BREED) / 2} {eind},6 {eind - kop},{6 +
				(kop * PIJL_BREED) / 2}"
			fill={kleur}
		/>{/if}</svg
>

<style>
	.lm {
		flex: none;
		display: block;
	}
</style>
