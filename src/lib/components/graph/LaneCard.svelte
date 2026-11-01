<script lang="ts">
	// The Zijpaneel of what stands for several bronnen on the lanes: a group drawn as a disc, or a hull
	// whose wet or dossier is no bron on the canvas. It names them, per row where the hull has rows;
	// one click marks a bron, whose own card then takes its place.
	import { isEscape } from '$lib/actions/keys';
	import BronLink from '$lib/bron/BronLink.svelte';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { laneDossierNumber } from '$lib/graph/lane-changes';
	import type { SceneUnit } from '$lib/graph/scene';
	import type { GraphNode } from '$lib/graph/types';
	import CanvasKaart from './CanvasKaart.svelte';
	import LaneChanges from './LaneChanges.svelte';

	let {
		unit,
		nodeOf,
		onMark,
		onClose
	}: {
		unit: SceneUnit;
		nodeOf: (id: string) => GraphNode | undefined;
		onMark: (id: string) => void;
		onClose: () => void;
	} = $props();

	const dossier = $derived(unit.shape === 'hull' && unit.column === 'papers');
	const rows = $derived(
		unit.rows.length > 0 ? unit.rows : [{ id: 'all', label: '', members: unit.members }]
	);
	/** The newest first, then by name: the order of a list of bronnen. */
	const sorted = (ids: readonly string[]) =>
		ids
			.flatMap((id) => nodeOf(id) ?? [])
			.sort(
				(a, b) =>
					String(b.raw?.props?.date ?? '').localeCompare(String(a.raw?.props?.date ?? '')) ||
					a.label.localeCompare(b.label)
			);
</script>

<svelte:window onkeydown={(e) => isEscape(e) && onClose()} />

<aside class="lane-card" aria-label="Zijpaneel">
	<CanvasKaart title={unit.label}>
		{#snippet action()}
			<button type="button" class="btn is-text" aria-label="Zijpaneel sluiten" onclick={onClose}
				>×</button
			>
		{/snippet}
		{#if unit.breakdown}<p class="breakdown">{unit.breakdown}</p>{/if}
		{#if unit.shape === 'hull'}
			<p class="open"><BronLink ref={unit.id}>{dossier ? 'Dossier' : 'Wet'} openen</BronLink></p>
		{/if}
		{#if dossier}<LaneChanges number={laneDossierNumber(unit.id, unit.members, nodeOf)} />{/if}
		{#each rows as row (row.id)}
			{#if row.label}<h3 class="row">{row.label}</h3>{/if}
			<ul class="list">
				{#each sorted(row.members) as n (n.id)}
					<li>
						<button type="button" class="item" onclick={() => onMark(n.id)}>
							<KindGlyph collection={n.collection} size={14} />
							<span>{n.label}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/each}
	</CanvasKaart>
</aside>

<style>
	/* The card lies over the field, the field does not narrow (Thijs, 1 nov.): the strip of a bron's
	   card leaves the grid while the lanes stand, above its Tijdstrook. A phone keeps its sheet. */
	.lane-card {
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		z-index: calc(var(--z-float) + 1);
		box-sizing: border-box;
		width: var(--strook);
		padding: var(--s-4);
		overflow-y: auto;
		background: var(--paper);
		border-left: 1px solid var(--rule);
		box-shadow: var(--shadow-pop);
	}
	@media (min-width: 769px) {
		:global(.graph-view:has(.banen):has(.strook--kaart.is-open)) {
			--card-room: var(--strook);
			grid-template-columns: var(--strook) minmax(0, 1fr);
		}
		:global(.graph-view:has(.banen) .strook--kaart) {
			position: absolute;
			top: 0;
			right: 0;
			bottom: var(--strook-h, 0px);
			z-index: calc(var(--z-float) + 1);
			width: var(--strook);
			box-shadow: var(--shadow-pop);
		}
	}
	@media (max-width: 768px) {
		.lane-card {
			top: auto;
			left: 0;
			width: auto;
			max-height: 45%;
			border-left: 0;
			border-radius: var(--r-2) var(--r-2) 0 0;
			box-shadow: var(--shadow-modal);
		}
	}
	.open {
		margin: 0;
		font-size: var(--t-meta);
	}
	.breakdown,
	.row {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-note);
		font-weight: 400;
		color: var(--ink-2);
	}
	.list {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.item {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		width: 100%;
		min-height: var(--s-6);
		padding: var(--s-1) 0;
		border: 0;
		background: none;
		font: inherit;
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}
	.item:hover span {
		text-decoration: underline;
	}
</style>
