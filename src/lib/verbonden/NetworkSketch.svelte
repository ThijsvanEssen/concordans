<script lang="ts">
	// The network of the bron in Verbonden, above its soorten (besluit 32): the bron in
	// the middle, each verbinding a line. A bron on its own opens in place under the drawing, its
	// row of Verbonden, the bron one step further (besluit 39); a group (a count in a circle)
	// opens its group in the panel below. The legend is one line that counts what is drawn
	// (besluit 29.3). The way to the werkplek is Open in netwerk in the head of Verbonden.
	import { VORMEN } from '$lib/bron/vormen';
	import { kindColour } from '$lib/bron/kleur';
	import { formatCount } from '$lib/text/getal';
	import { EDGE_WEIGHT } from '$lib/graph/types';
	import {
		edgeCapFor,
		edgeColorFor,
		edgeDashFor,
		edgeStyleFor,
		edgeToneFor,
		lineThickness,
		tokens,
		towardPaper,
		arrowLength,
		hullColorFor,
		hullDashFor,
		withAlpha
	} from '$lib/components/graph/nodeSprites';
	import { AIR, DOT_RADIUS, curvedLine } from '$lib/graph/line-shape';
	import { CLUSTER_FILL, FOCUS as FOCUS_SPEC, HULL, NODE as NODE_SPEC } from '$lib/graph/draw-spec';
	import { hasArrow } from '$lib/graph/line-kind';
	import { lineStrength } from '$lib/graph/line-strength';
	import { LINE_H, SKETCH_LINE, WIDTH, drawnCount, type Sketch, type SketchLine } from './sketch';

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

	const colour = kindColour;
	const m = $derived(sketch.center);
	const centre = $derived(VORMEN[sketch.shape]);
	/** The focus: 18 px of ink on a halo of paper (Netwerkcanvas, Maten). */
	const FOCUS = FOCUS_SPEC.size;
	const HALO = FOCUS_SPEC.halo;
	/** The radius of a bron the line stops at, and of the ring round the chosen one. */
	const NODE = NODE_SPEC.radius;
	const RING = NODE_SPEC.ring;
	/** The bron in the middle that is a hull itself (a wet, a fractie with members): its lines begin at the rim. */
	const centreHull = $derived(sketch.hulls.find((h) => h.centre) ?? null);

	// A line rests in the colour of its kind, mixed toward the paper as there are more of them
	// (within the window of its tone, line-strength); the chosen one in ink, 1.3 times as thick,
	// the rest at half.
	const total = $derived(sketch.singles.length + sketch.clusters.length);
	const chosen = $derived(open !== null);

	type StrokeLine = {
		d: string;
		head: string | null;
		dot: { x: number; y: number } | null;
		colour: string;
		width: number;
		dash: string | undefined;
		cap: 'round' | 'butt';
		open: boolean;
		dimmed: boolean;
	};
	/**
	 * A line from the bron in the middle to a neighbour at (x, y), of `radiusStop` radius: in the style
	 * of its kind (Netwerkcanvas, Lijnen), slightly curved, the arrowhead at the end it points to
	 * and, for Ingediend door, a dot at the one who submits.
	 */
	function lineTo(
		l: SketchLine,
		x: number,
		y: number,
		radiusStop: number,
		weight: number,
		pick: boolean
	): StrokeLine {
		const rel = l.relation;
		const style = rel ? edgeStyleFor(rel, null, l.source) : 'punten';
		const width = (rel ? lineThickness(EDGE_WEIGHT[rel]) : lineThickness(weight)) * SKETCH_LINE;
		const base = rel ? edgeColorFor(rel, l.source) : 'var(--rule-strong)';
		const strength = rel
			? lineStrength(base, tokens().paper, edgeToneFor(rel, null, l.source), total)
			: 1;
		const colour = pick ? 'var(--ink)' : rel ? towardPaper(base, strength) : base;
		const points = rel !== null && hasArrow(style) && l.direction !== null;
		// Drawn from the middle to the neighbour: the arrowhead at the end it points to.
		const toMiddle = l.direction === 'inbound';
		const shape = curvedLine(
			{ x: m.x, y: m.y },
			{ x, y },
			{
				ra: (centreHull ? centreHull.r : FOCUS / 2 + HALO) - AIR,
				rb: radiusStop - AIR,
				width,
				arrow: arrowLength(),
				head: points ? (toMiddle ? 'a' : 'b') : null,
				end: toMiddle ? 'a' : 'b',
				dot: style === 'puntenIndiener' && l.direction !== null ? (toMiddle ? 'b' : 'a') : null
			}
		);
		return {
			d: shape.d,
			head: shape.head,
			dot: shape.dot,
			colour,
			width: pick ? width * 1.3 : width,
			dash: edgeDashFor(style),
			cap: edgeCapFor(style),
			open: pick,
			dimmed: chosen && !pick
		};
	}
	const lines = $derived(
		sketch.singles
			.filter((l) => !l.joined)
			.map((l) => ({ id: l.id, ...lineTo(l, l.x, l.y, NODE, 0.7, open === l.id) }))
	);
	const groupLines = $derived(
		sketch.clusters
			.filter((b) => !b.joined)
			.map((b) => ({ id: b.id, ...lineTo(b, b.x, b.y, Math.max(b.r, 14), 1, false) }))
	);
	/** One line into a dossier's hull, whatever the number of stukken in it (the canvas draws it hull to hull). */
	const hullLines = $derived(
		sketch.hulls
			.filter((h) => h.line)
			.map((h) => ({ id: h.id, ...lineTo(h.line!, h.x, h.y, h.r, 1, false) }))
	);
	const caption = $derived(drawnCount(sketch));
</script>

<figure class="sketch" data-testid="network-sketch">
	<svg
		viewBox="0 0 {WIDTH} {sketch.height}"
		role="group"
		aria-label="Netwerk rond {name}: {caption}"
	>
		{#each [...lines, ...groupLines, ...hullLines] as t (t.id)}
			<g class="line" class:is-dim={t.dimmed}>
				<path
					d={t.d}
					fill="none"
					stroke={t.colour}
					stroke-width={t.width}
					stroke-dasharray={t.dash}
					stroke-linecap={t.cap}
				/>
				{#if t.head}<polygon points={t.head} fill={t.colour} />{/if}
				{#if t.dot}<circle cx={t.dot.x} cy={t.dot.y} r={DOT_RADIUS} fill={t.colour} />{/if}
			</g>
		{/each}

		{#each sketch.hulls as h (h.id)}
			<g class="hull" aria-hidden="true">
				<circle
					cx={h.x}
					cy={h.y}
					r={h.r}
					fill={withAlpha(hullColorFor(h.kind), HULL.fill)}
					stroke={hullColorFor(h.kind)}
					stroke-width={HULL.line}
					stroke-dasharray={hullDashFor(h.kind)}
					stroke-linecap="round"
				/>
			</g>
		{/each}
		{#if !centreHull}
			<g class="focus">
				<title>{name}</title>
				<circle cx={m.x} cy={m.y} r={FOCUS / 2 + HALO} fill="var(--paper)" />
				<!-- The bron in its own vorm, in ink (an article as the open square), as the canvas's focus. -->
				<path
					d={centre.d}
					transform="translate({m.x - FOCUS / 2} {m.y - FOCUS / 2}) scale({FOCUS / 16})"
					fill={centre.wijze === 'lijn' ? 'var(--paper)' : 'var(--ink)'}
					stroke={centre.wijze === 'lijn' ? 'var(--ink)' : 'none'}
					stroke-width={centre.wijze === 'lijn' ? 2 : 0}
					fill-rule={centre.wijze === 'gat' ? 'evenodd' : 'nonzero'}
				/>
				<text x={m.x} y={m.y + 34} text-anchor="middle" class="name name--focus"
					>{#each sketch.centerLines as line, i (i)}<tspan x={m.x} dy={i ? LINE_H : 0}>{line}</tspan
						>{/each}</text
				>
			</g>
		{/if}

		{#each sketch.hulls as h (h.id)}
			<g class="pil" aria-hidden="true">
				<rect
					x={h.pill.x - h.pill.w / 2}
					y={h.pill.y - 20}
					width={h.pill.w}
					height="20"
					rx="3"
					stroke={hullColorFor(h.kind)}
				/>
				<text x={h.pill.x} y={h.pill.y - 5.5} text-anchor="middle">{h.label}</text>
			</g>
		{/each}

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
				<circle cx={l.x} cy={l.y} r={NODE + 3} fill="var(--paper)" />
				{#if open === l.id}<circle class="sel" cx={l.x} cy={l.y} r={RING} />{/if}
				<path
					d={v.d}
					transform="translate({l.x - 6.4} {l.y - 6.4}) scale(0.8)"
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
				<!-- The canvas's cluster: a disc in the colour of its kind on a rim of paper, its count in paper. -->
				<circle cx={b.x} cy={b.y} r={b.r} fill="var(--paper)" />
				<circle cx={b.x} cy={b.y} r={b.r * CLUSTER_FILL} fill={colour(b.collection, b.hue)} />
				<text x={b.x} y={b.y + 4.5} text-anchor="middle" class="count">{formatCount(b.count)}</text>
				<text x={b.lx} y={b.ly} text-anchor="middle" class="name"
					>{#each b.lines as line, i (i)}<tspan x={b.lx} dy={i ? LINE_H : 0}>{line}</tspan
						>{/each}</text
				>
			</g>
		{/each}
	</svg>
	<!-- One line that counts what is drawn (Netwerkschets, Tekst). -->
	<figcaption class="caption">{caption}</figcaption>
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
	/* A chosen neighbour: its line in ink, the rest at half. */
	.line.is-dim {
		opacity: 0.5;
	}
	.pil rect {
		fill: var(--paper);
		stroke-width: 1;
	}
	.pil text {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		fill: var(--ink);
	}
	.sel {
		fill: none;
		stroke: var(--ink);
		stroke-width: 2;
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
	/* In paper on the disc, as the canvas's cluster. */
	.count {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 600;
		fill: var(--paper);
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
	/* A click marks the bron with its frame (.sel); the keyboard keeps its ring below. */
	.single:focus:not(:focus-visible),
	.cluster:focus:not(:focus-visible) {
		outline: none;
	}
	.single:focus-visible path,
	.cluster:focus-visible circle:not(.hit) {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	/* One line that counts what is drawn. */
	.caption {
		margin: var(--s-2) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		line-height: 18px;
		text-align: center;
		color: var(--ink-3);
	}
</style>
