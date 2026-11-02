<svelte:options namespace="svg" />

<script lang="ts">
	// Tiles on the lanes (scene-tiles.ts): many dossiers around one target, a line each under the
	// head of their period, the number on a tile and the dossier's name beside it, cut where the
	// room ends; the full name in the tooltip and for a screen reader. A click or Enter opens the
	// Zijpaneel. The names come after the drawing: until then a tile stands by its number.
	import { getDossierTitles } from '$lib/api/dossiers';
	import { ignore } from '$lib/api/errors';
	import { dossierNumberLabel, dossierOwnName, officialNumber } from '$lib/bron/dossier-naam';
	import { sortColour } from '$lib/bron/rubrieken';
	import { capitalize } from '$lib/text/words';
	import { laneDossierNumber } from '$lib/graph/lane-changes';
	import { nextIndex } from '$lib/actions/menu';
	import { oneLine, type UnitBox } from '$lib/graph/lane-layout';
	import type { SceneUnit } from '$lib/graph/scene';
	import type { GraphNode } from '$lib/graph/types';

	let {
		unit,
		box,
		open,
		nodeOf,
		onOpen
	}: {
		unit: SceneUnit;
		box: UnitBox;
		/** The dossier whose Zijpaneel is open. */
		open: string | null;
		nodeOf: (id: string) => GraphNode | undefined;
		onOpen: (dossier: SceneUnit) => void;
	} = $props();

	const TILE = { width: 68, height: 19 };
	const PAD = 12;
	const FONT = 12;

	const colour = $derived(sortColour(unit.sort));
	const numberOf = (u: SceneUnit) => laneDossierNumber(u.id, u.members, nodeOf);
	const yOf = (id: string) => box.rows.find((r) => r.id === id)?.y ?? 0;

	type Names = { short: string; full: string };
	let names = $state.raw<ReadonlyMap<string, Names>>(new Map());
	$effect(() => {
		let current = true;
		for (const { units } of unit.periods)
			for (const u of units) {
				const number = numberOf(u);
				getDossierTitles(u.id, number)
					.then((d) => {
						const short = d && dossierOwnName({ ...d, number });
						if (current && d && short)
							names = new Map(names).set(u.id, {
								short: capitalize(short),
								full: d.title?.trim() || short
							});
					})
					.catch(ignore('Banen dossiernaam'));
			}
		return () => {
			current = false;
		};
	});

	const fullName = (u: SceneUnit) => {
		const label = dossierNumberLabel(numberOf(u));
		const name = names.get(u.id)?.full;
		return name ? `${label}, ${name}` : label;
	};
	const nameRoom = $derived(box.mark.width - 2 * PAD - TILE.width - 8);

	/** The tiles are one stop of the Tab key, ↑ and ↓ go through them; the one last on keeps the stop. */
	const tiles = $derived(unit.periods.flatMap((p) => p.units));
	let rover = $state<string | null>(null);
	const stop = $derived(tiles.some((u) => u.id === rover) ? rover : (tiles[0]?.id ?? null));
	let drawn = $state<SVGGElement | null>(null);

	function onkeydown(e: KeyboardEvent, u: SceneUnit) {
		const at = nextIndex(
			e.key,
			tiles.findIndex((t) => t.id === u.id),
			tiles.length
		);
		if (at !== null) {
			e.preventDefault();
			e.stopPropagation();
			const next = tiles[at];
			rover = next.id;
			drawn
				?.querySelector<SVGGElement>(`[data-tile="${CSS.escape(next.id)}"]`)
				?.focus({ preventScroll: false });
			return;
		}
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		onOpen(u);
	}
</script>

<rect
	class="hull"
	x={box.mark.x}
	y={box.mark.y}
	width={box.mark.width}
	height={box.mark.height}
	rx="9"
	stroke={colour}
	stroke-dasharray="6 4"
	style:--tint={colour}
/>
<rect
	class="pill"
	x={box.label.x}
	y={box.label.y}
	width={box.label.width}
	height={box.label.height}
	rx={box.label.height / 2}
	stroke={colour}
/>
<text class="pill-name" x={box.label.x + 10} y={box.label.y + box.label.height / 2 + 4.5}
	>{box.text.name[0]}</text
>
<g bind:this={drawn}>
	{#each unit.periods as period (period.label)}
		<text class="period" x={box.mark.x + PAD} y={yOf(period.label) + 4}>{period.label}</text>
		{#each period.units as u (u.id)}
			{@const y = yOf(u.id)}
			<g
				class="tile"
				class:is-open={open === u.id}
				role="button"
				tabindex={u.id === stop ? 0 : -1}
				aria-label={fullName(u)}
				aria-pressed={open === u.id}
				data-tile={u.id}
				onclick={() => {
					rover = u.id;
					onOpen(u);
				}}
				onkeydown={(e) => onkeydown(e, u)}
			>
				<title>{fullName(u)}</title>
				<rect
					class="hit"
					x={box.mark.x + 4}
					y={y - 12}
					width={box.mark.width - 8}
					height="24"
					rx="4"
				/>
				<rect
					class="plate"
					x={box.mark.x + PAD}
					y={y - TILE.height / 2}
					width={TILE.width}
					height={TILE.height}
					rx="3"
					stroke={colour}
				/>
				<text class="number" x={box.mark.x + PAD + TILE.width / 2} y={y + 4}
					>{oneLine(officialNumber(numberOf(u)), TILE.width - 8, FONT)}</text
				>
				{#if names.get(u.id)}
					<text class="name" x={box.mark.x + PAD + TILE.width + 8} y={y + 4}
						>{oneLine(names.get(u.id)!.short, nameRoom, FONT)}</text
					>
				{/if}
			</g>
		{/each}
	{/each}
</g>

<style>
	.hull {
		fill: color-mix(in srgb, var(--tint) 7%, transparent);
		stroke-width: 1.6px;
	}
	.pill {
		fill: var(--paper);
		stroke-width: 1.4px;
	}
	.pill-name {
		font-family: var(--font-serif);
		font-size: var(--t-note);
		font-weight: 600;
		fill: var(--ink);
	}
	.period {
		font-size: var(--t-note);
		fill: var(--ink-2);
	}
	.tile {
		cursor: pointer;
	}
	.hit {
		fill: transparent;
	}
	.tile:hover .hit {
		fill: color-mix(in srgb, var(--ink) 6%, transparent);
	}
	.plate {
		fill: var(--paper);
		stroke-width: 1px;
	}
	.tile.is-open .plate {
		stroke-width: 2px;
	}
	.number {
		font-size: var(--t-label);
		fill: var(--ink);
		text-anchor: middle;
	}
	.name {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		fill: var(--ink-2);
	}
	.tile:hover .name,
	.tile.is-open .name {
		fill: var(--ink);
	}
</style>
