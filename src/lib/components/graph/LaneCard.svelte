<script lang="ts">
	// The Zijpaneel of what stands for several bronnen on the lanes: a group drawn as a disc, or a hull
	// whose wet or dossier is no bron on the canvas. It names them, per row where the hull has rows;
	// one click marks a bron, whose own card then takes its place.
	import { isEscape } from '$lib/actions/keys';
	import BronLink from '$lib/bron/BronLink.svelte';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { getDossierTitles } from '$lib/api/dossiers';
	import { ignore } from '$lib/api/errors';
	import { laneDossierNumber } from '$lib/graph/lane-changes';
	import type { SceneUnit } from '$lib/graph/scene';
	import type { GraphNode } from '$lib/graph/types';
	import IconButton from '$lib/components/ui/IconButton.svelte';
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
	const number = $derived(laneDossierNumber(unit.id, unit.members, nodeOf));
	/** The dossier's own name: its hull knows only the number when it is no bron on the canvas. */
	let title = $state<string | null>(null);
	$effect(() => {
		title = null;
		if (!dossier) return;
		let current = true;
		getDossierTitles(unit.id, number)
			.then((d) => {
				if (current) title = d?.title?.trim() || null;
			})
			.catch(ignore('Banen dossiernaam'));
		return () => {
			current = false;
		};
	});
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
			<IconButton label="Sluiten" keys={['Esc', 'Escape']} onclick={onClose}>×</IconButton>
		{/snippet}
		{#if title && title !== unit.label}<p class="name">{title}</p>{/if}
		{#if unit.breakdown}<p class="breakdown">{unit.breakdown}</p>{/if}
		{#if unit.shape === 'hull'}
			<p class="open"><BronLink ref={unit.id}>{dossier ? 'Dossier' : 'Wet'} openen</BronLink></p>
		{/if}
		{#if dossier}<LaneChanges {number} />{/if}
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
	   card leaves the grid while the lanes stand, above its Tijdstrook. A phone keeps its sheet.
	   As wide as a Blad `rechts`, but on a narrow window it leaves the field some room. */
	:global(.graph-view:has(.banen)) {
		--lane-card-w: 400px;
	}
	/* Beside it the columns of Kamerstukken and Wetten still fit, shrunk (LanesView). */
	@media (max-width: 1280px) {
		:global(.graph-view:has(.banen)) {
			--lane-card-w: 340px;
		}
	}
	@media (max-width: 1100px) {
		:global(.graph-view:has(.banen)) {
			--lane-card-w: 280px;
		}
	}
	.lane-card {
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		z-index: calc(var(--z-float) + 1);
		box-sizing: border-box;
		width: min(var(--lane-card-w), 70%);
		padding: var(--s-4);
		overflow-y: auto;
		background: var(--paper);
		border-left: 1px solid var(--rule);
		box-shadow: var(--shadow-pop);
	}
	@media (min-width: 769px) {
		/* Deel stays in view, left of the card. */
		:global(.graph-view:has(.lane-card) .doek-balk) {
			right: calc(var(--lane-card-w) + var(--s-3));
		}
		:global(.graph-view:has(.banen):has(.strook--kaart.is-open)) {
			--card-room: var(--strook);
			grid-template-columns: var(--strook-links) minmax(0, 1fr);
		}
		:global(.graph-view:has(.banen) .strook--kaart) {
			position: absolute;
			top: 0;
			right: 0;
			bottom: var(--strook-h, 0px);
			z-index: calc(var(--z-float) + 1);
			width: min(var(--strook), var(--lane-card-w));
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
	.lane-card :global(.canvas-kaart__kop),
	.lane-card :global(.canvas-kaart__inhoud) {
		padding-left: 0;
		padding-right: 0;
	}
	.lane-card :global(.canvas-kaart__inhoud) {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.open :global(a) {
		text-decoration: underline;
	}
	.name {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink);
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
