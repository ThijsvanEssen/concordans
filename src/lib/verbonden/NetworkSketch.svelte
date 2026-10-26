<script lang="ts">
	// The network of the bron in Verbonden, on request (Netwerk tonen, besluit 32): the bron in
	// the middle, each verbinding a line. A bron on its own opens in place under the drawing, its
	// row of Verbonden, the bron one step further (besluit 39); a group (a count in a circle)
	// opens its group in the panel below. The legend is one line that counts what is drawn
	// (besluit 29.3). The way to the werkplek is the link Open in netwerk under it.
	import { VORMEN } from '$lib/bron/vormen';
	import { kindColour } from '$lib/bron/kleur';
	import { formatCount } from '$lib/text/getal';
	import type { Collection } from '$lib/vocabulary';
	import { EDGE_WEIGHT } from '$lib/graph/types';
	import {
		edgeColorFor,
		edgeDashFor,
		edgeStyleFor,
		lijnDikte,
		pijlLengte,
		PIJL_BREED,
		towardPaper
	} from '$lib/components/graph/nodeSprites';
	import {
		LINE_H,
		SKETCH_LINE,
		WIDTH,
		arrowhead,
		telregel,
		type Sketch,
		type SketchLine
	} from './sketch';

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
	/** A group of Kamerstukken is dashed, as a dossier on the canvas. */
	const dashed = (c: Collection | null) => c === 'documents' || c === 'dossiers';

	const m = $derived(sketch.center);
	/** The focus: 18 px of ink on a halo of paper (Netwerkcanvas, Maten). */
	const FOCUS = 18;
	const HALO = 4.5;
	/** The radius of a bron the line stops at, and of the ring round the chosen one. */
	const KNOOP = 6.5;
	const RING = 11;

	// A line rests in the colour of its kind, mixed toward the paper as there are more of them
	// (3/√n, from 0.35 to 1); the chosen one in ink, 1.3 times as thick, the rest at half.
	const aantal = $derived(sketch.singles.length + sketch.clusters.length);
	const sterkte = $derived(Math.min(1, Math.max(0.35, 3 / Math.sqrt(Math.max(aantal, 1)))));
	const gekozen = $derived(open !== null);

	type Lijn = {
		x1: number;
		y1: number;
		x2: number;
		y2: number;
		kleur: string;
		dik: number;
		streep: string | undefined;
		kop: string | null;
		open: boolean;
		gedimd: boolean;
	};
	/**
	 * A line from the bron in the middle to a neighbour at (x, y), of `stop` radius: in the style of
	 * its kind (Netwerkcanvas, Lijnen), the arrowhead at the end it points to.
	 */
	function lijn(
		l: SketchLine,
		x: number,
		y: number,
		stop: number,
		gewicht: number,
		kies: boolean
	): Lijn {
		const rel = l.relation;
		const stijl = rel ? edgeStyleFor(rel, null, l.van) : 'lid';
		const dik = (rel ? lijnDikte(EDGE_WEIGHT[rel]) : lijnDikte(gewicht)) * SKETCH_LINE;
		const basis = rel ? edgeColorFor(rel, l.van) : 'var(--rule-strong)';
		const kleur = kies ? 'var(--ink)' : rel ? towardPaper(basis, sterkte) : basis;
		const naar = l.direction === 'inbound' ? 'bron' : 'knoop';
		const wijst = rel !== null && stijl !== 'lid' && l.direction !== null;
		const lengte = Math.max(dik * pijlLengte(), 5.5);
		// Both ends stop at the edge of their bron.
		const dx = x - m.x;
		const dy = y - m.y;
		const d = Math.hypot(dx, dy) || 1;
		const ux = dx / d;
		const uy = dy / d;
		const van = FOCUS / 2 + HALO;
		const x1 = m.x + ux * van;
		const y1 = m.y + uy * van;
		const x2 = x - ux * stop;
		const y2 = y - uy * stop;
		const kop = !wijst
			? null
			: naar === 'knoop'
				? arrowhead(x1, y1, x2, y2, lengte, lengte * PIJL_BREED)
				: arrowhead(x2, y2, x1, y1, lengte, lengte * PIJL_BREED);
		const scherp = kies ? dik * 1.3 : dik;
		return {
			x1: wijst && naar === 'bron' ? x1 + ux * lengte : x1,
			y1: wijst && naar === 'bron' ? y1 + uy * lengte : y1,
			x2: wijst && naar === 'knoop' ? x2 - ux * lengte : x2,
			y2: wijst && naar === 'knoop' ? y2 - uy * lengte : y2,
			kleur,
			dik: scherp,
			streep: edgeDashFor(stijl),
			kop,
			open: kies,
			gedimd: gekozen && !kies
		};
	}
	const lijnen = $derived(
		sketch.singles.map((l) => ({ id: l.id, ...lijn(l, l.x, l.y, KNOOP, 0.7, open === l.id) }))
	);
	const groepLijnen = $derived(
		sketch.clusters.map((b) => ({ id: b.id, ...lijn(b, b.x, b.y, Math.max(b.r, 14), 1, false) }))
	);
	const regel = $derived(telregel(sketch));
</script>

<figure class="sketch" data-testid="network-sketch">
	<svg viewBox="0 0 {WIDTH} {sketch.height}" role="group" aria-label="Netwerk rond {name}: {regel}">
		{#each [...lijnen, ...groepLijnen] as t (t.id)}
			<g class="line" class:is-gedimd={t.gedimd}>
				<line
					x1={t.x1}
					y1={t.y1}
					x2={t.x2}
					y2={t.y2}
					stroke={t.kleur}
					stroke-width={t.dik}
					stroke-dasharray={t.streep}
				/>
				{#if t.kop}<polygon points={t.kop} fill={t.kleur} />{/if}
			</g>
		{/each}

		<g class="focus">
			<title>{name}</title>
			<rect
				x={m.x - FOCUS / 2 - HALO}
				y={m.y - FOCUS / 2 - HALO}
				width={FOCUS + 2 * HALO}
				height={FOCUS + 2 * HALO}
				fill="var(--paper)"
			/>
			<rect
				x={m.x - FOCUS / 2}
				y={m.y - FOCUS / 2}
				width={FOCUS}
				height={FOCUS}
				fill="var(--ink)"
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
				<circle cx={l.x} cy={l.y} r={KNOOP + 3} fill="var(--paper)" />
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
				<text x={b.lx} y={b.ly} text-anchor="middle" class="name"
					>{#each b.lines as line, i (i)}<tspan x={b.lx} dy={i ? LINE_H : 0}>{line}</tspan
						>{/each}</text
				>
			</g>
		{/each}
	</svg>
	<!-- One line that counts what is drawn (Netwerkschets, Tekst). -->
	<figcaption class="telregel">{regel}</figcaption>
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
	.line.is-gedimd {
		opacity: 0.5;
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
	.telregel {
		margin: var(--s-2) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		line-height: 18px;
		text-align: center;
		color: var(--ink-3);
	}
</style>
