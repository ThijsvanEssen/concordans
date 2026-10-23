<script lang="ts">
	// The network of the bron in Verbonden, on request (Netwerk tonen, besluit 32): the bron in
	// the middle, each verbinding a line. A bron on its own opens in place under the drawing, its
	// row of Verbonden, the bron one step further (besluit 39); a group (a count in a circle)
	// opens its group in the panel below. The legend is one line that counts what is drawn
	// (besluit 29.3). The way to the werkplek is the link Open in netwerk under it.
	import { VORMEN } from '$lib/bron/vormen';
	import { formatCount } from '$lib/text/getal';
	import { plural } from '$lib/text/words';
	import type { Collection } from '$lib/vocabulary';
	import { LINE_H, WIDTH, clusterLine, type Sketch } from './sketch';

	let {
		sketch,
		name,
		open = null,
		onSingle,
		onGroup
	}: {
		sketch: Sketch;
		/** The bron in the middle, short (LABEL_MAX). */
		name: string;
		/** The bron on its own opened under the drawing, by its id. */
		open?: string | null;
		/** A bron on its own was clicked: its row opens under the drawing, or closes. */
		onSingle: (id: string) => void;
		/** A group was clicked: its group in Verbonden opens. */
		onGroup: (groupId: string) => void;
	} = $props();

	const press = (e: KeyboardEvent, act: () => void) => {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		act();
	};

	/** The colour of a kind, as the canvas draws its groups. */
	const colour = (c: Collection | null, hue: string | null = null): string => {
		if (hue === 'regelingen') return 'var(--groep-regeling)';
		switch (c) {
			case 'instruments':
			case 'articles':
			case 'annexes':
				return 'var(--groep-wet)';
			case 'documents':
			case 'dossiers':
			case 'activities':
				return 'var(--groep-dossier)';
			case 'judgments':
				return 'var(--indigo)';
			case 'members':
			case 'factions':
				return 'var(--groep-fractie)';
			case 'committees':
				return 'var(--groep-commissie)';
			default:
				return 'var(--ink-2)';
		}
	};
	/** A group of Kamerstukken is dashed, as a dossier on the canvas. */
	const dashed = (c: Collection | null) => c === 'documents' || c === 'dossiers';

	const m = $derived(sketch.center);
	const groups = $derived(sketch.clusters.length);
	const description = $derived(
		[
			sketch.singles.length ? `${formatCount(sketch.singles.length)} afzonderlijk` : null,
			groups
				? `${formatCount(groups)} ${plural(groups, 'groep', 'groepen')}, ${formatCount(sketch.inClusters)} in totaal`
				: null
		]
			.filter(Boolean)
			.join(', ')
	);
</script>

<figure class="sketch" data-testid="network-sketch">
	<svg
		viewBox="0 0 {WIDTH} {sketch.height}"
		role="group"
		aria-label="Netwerk rond {name}: {description}"
	>
		{#each sketch.singles as l (l.id)}
			<line x1={m.x} y1={m.y} x2={l.x} y2={l.y} class="line" stroke-width="1.5" />
		{/each}
		{#each sketch.clusters as b (b.id)}
			<line x1={m.x} y1={m.y} x2={b.x} y2={b.y} class="line" stroke-width={clusterLine(b.count)} />
		{/each}

		<g class="focus">
			<title>{name}</title>
			<rect x={m.x - 11} y={m.y - 11} width="22" height="22" fill="var(--ink)" />
			<rect
				x={m.x - 17}
				y={m.y - 17}
				width="34"
				height="34"
				fill="none"
				stroke="var(--ink)"
				stroke-width="1.5"
			/>
			<text x={m.x} y={m.y + 34} text-anchor="middle" class="name name--focus"
				>{#each sketch.centerLines as line, i (i)}<tspan x={m.x} dy={i ? LINE_H : 0}>{line}</tspan
					>{/each}</text
			>
		</g>

		{#each sketch.singles as l (l.id)}
			{@const v = VORMEN[l.shape]}
			<g
				class="single"
				class:is-open={open === l.id}
				role="button"
				tabindex="0"
				aria-label={l.title}
				aria-expanded={open === l.id}
				onclick={() => onSingle(l.id)}
				onkeydown={(e) => press(e, () => onSingle(l.id))}
			>
				<title>{l.title}</title>
				<circle cx={l.x} cy={l.y} r={l.hit} class="hit" />
				<path
					d={v.d}
					transform="translate({l.x - 7} {l.y - 7}) scale(0.875)"
					fill={v.wijze === 'lijn' ? 'var(--paper)' : colour(l.collection, l.hue)}
					stroke={v.wijze === 'lijn' ? colour(l.collection, l.hue) : 'none'}
					stroke-width={v.wijze === 'lijn' ? 2.4 : 0}
					fill-rule={v.wijze === 'gat' ? 'evenodd' : 'nonzero'}
				/>
				{#if l.lines}
					<text x={l.lx} y={l.ly} text-anchor="middle" class="name"
						>{#each l.lines as line, i (i)}<tspan x={l.lx} dy={i ? LINE_H : 0}>{line}</tspan
							>{/each}</text
					>
				{/if}
			</g>
		{/each}

		{#each sketch.clusters as b (b.id)}
			<g
				class="cluster"
				role="button"
				tabindex="0"
				aria-label="{formatCount(b.count)} {b.label}"
				onclick={() => onGroup(b.group)}
				onkeydown={(e) => press(e, () => onGroup(b.group))}
			>
				<circle cx={b.x} cy={b.y} r={Math.max(b.r, 22)} class="hit" />
				<circle
					cx={b.x}
					cy={b.y}
					r={b.r}
					fill="var(--paper)"
					stroke={colour(b.collection, b.hue)}
					stroke-width="2.5"
					stroke-dasharray={dashed(b.collection) ? '6 4' : undefined}
				/>
				<text x={b.x} y={b.y + 4.5} text-anchor="middle" class="count">{formatCount(b.count)}</text>
				<text x={b.lx} y={b.y + b.r + 16} text-anchor="middle" class="name"
					>{#each b.lines as line, i (i)}<tspan x={b.lx} dy={i ? LINE_H : 0}>{line}</tspan
						>{/each}</text
				>
			</g>
		{/each}
	</svg>
	<figcaption class="legend">
		{#if sketch.singles.length}
			<span class="legend__part"
				><svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"
					><rect width="10" height="10" fill="var(--ink-2)" /></svg
				>{formatCount(sketch.singles.length)} afzonderlijk</span
			>
		{/if}
		{#if groups}
			<span class="legend__part"
				><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"
					><circle
						cx="6"
						cy="6"
						r="4.8"
						fill="none"
						stroke="var(--ink-2)"
						stroke-width="1.6"
					/></svg
				>{formatCount(groups)}
				{plural(groups, 'groep', 'groepen')}, {formatCount(sketch.inClusters)} in totaal</span
			>
		{/if}
	</figcaption>
</figure>

<style>
	/* Under the count, above the first hue and its rule (mockup V1-b `.netwerk`). */
	.sketch {
		margin: var(--s-3) 0 var(--s-2);
		padding: 0;
	}
	.sketch svg {
		display: block;
		width: 100%;
		max-width: 400px;
		height: auto;
		margin: 0 auto;
		overflow: visible;
	}
	.line {
		stroke: var(--rule-strong);
		opacity: 0.55;
	}
	/* The room a finger may tap: unseen, at least 44 px where the neighbours leave it. */
	.hit {
		fill: transparent;
	}
	.name {
		font-family: var(--font-serif);
		font-size: var(--t-ui);
		fill: var(--ink-2);
		paint-order: stroke;
		stroke: var(--paper);
		stroke-width: 4px;
		stroke-linejoin: round;
	}
	.name--focus {
		font-size: var(--t-ui);
		font-weight: 600;
		fill: var(--ink);
	}
	.count {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 600;
		fill: var(--ink);
	}
	.single,
	.cluster {
		cursor: pointer;
	}
	.single:hover .name,
	.single.is-open .name,
	.cluster:hover .name {
		fill: var(--ink);
		text-decoration: underline;
	}
	.single:focus-visible path,
	.cluster:focus-visible circle:not(.hit) {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	/* One line that counts what is drawn (besluit 29.3). */
	.legend {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0 var(--s-4);
		margin: var(--s-2) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-ui);
		line-height: 20px;
		color: var(--ink-2);
	}
	.legend__part {
		display: inline-flex;
		align-items: center;
		gap: var(--s-1);
		white-space: nowrap;
	}
</style>
