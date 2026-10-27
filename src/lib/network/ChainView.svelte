<script lang="ts">
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import type { FilterGroup } from '$lib/verbonden/filter';
	import type { LineKind } from '$lib/graph/line-kind';
	import type { Relation } from '$lib/vocabulary';
	// The weergave Keten (besluit 39, mockup A197-c): the law at the top, the articles it gives
	// powers in, the regulations under them per layer; a line from each to what it hangs under,
	// dashed where it only names it. On a wide screen a drawing in layers, on a phone a list per
	// layer (AMvB, Ministeriële regeling, Beleidsregel as headings). One click marks a bron: its
	// card stands in the strip at the right.
	import { formatCount } from '$lib/text/getal';
	import { plural } from '$lib/text/words';
	import { kindColour } from '$lib/bron/kleur';
	import { VORMEN, vormVanBron } from '$lib/bron/vormen';
	import {
		edgeColorFor,
		edgeDashFor,
		edgeStyleFor,
		lineThickness,
		arrowLength
	} from '$lib/components/graph/nodeSprites';
	import { curvedLine, AIR, DOT_RADIUS } from '$lib/graph/line-shape';
	import { korteDatum } from '$lib/text/datum';
	import { EDGE_WEIGHT } from '$lib/graph/types';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import type { ChainNode, ChainLayer } from '$lib/network/chain';
	type LayerId = ChainLayer['id'];

	let {
		layers,
		rest = {},
		chosen = null,
		gap = null,
		scale = 1,
		hiddenKinds = new Set(),
		hiddenLines = new Set(),
		more = {},
		amending = 0,
		failure = null,
		loading = false,
		expired = null,
		start = null,
		period = null,
		others = [],
		onChoose
	}: {
		/** The bron the keten starts from, which no filter hides. */
		start?: string | null;
		/** The period of the strip: a bron dated outside it is drawn faint, and counted. */
		period?: { van: string | null; tot: string | null } | null;
		/**
		 * The other chosen bronnen: marked where they stand in the keten, else named in a line
		 * of their own; one with a keten of its own opens it in one click.
		 */
		others?: readonly {
			id: string;
			name: string;
			collection: string;
			onOpen: (() => void) | null;
		}[];
		/** The regulations no longer in force: how many, whether they are drawn, and the switch. */
		expired?: { total: number; shown: boolean; onToggle: () => void } | null;
		layers: readonly ChainLayer[];
		/** Per layer, the regulations not drawn. */
		rest?: Partial<Record<LayerId, number>>;
		/** Per layer, those regulations themselves: "Alle 403" lists them (R3-K F4). */
		more?: Partial<Record<LayerId, readonly ChainNode[]>>;
		/** The keten is on its way: the drawing's place says so, nothing springs in (R3-K F6). */
		loading?: boolean;
		/** The node marked. */
		chosen?: string | null;
		/** What the data lacks, as one label over the drawing. */
		gap?: string | null;
		/** The zoom of the werkplek: the drawing larger or smaller, scrolled within. */
		scale?: number;
		/** The kinds and relations the filter of the strip switched off. */
		hiddenKinds?: ReadonlySet<FilterGroup>;
		hiddenLines?: ReadonlySet<LineKind>;
		/** The decrees that only change other regulations: left out of the layers, counted. */
		amending?: number;
		/** What could not be loaded, said with Opnieuw (LoadState). */
		failure?: { what: string; error: unknown; retry: () => void; plural?: boolean } | null;
		onChoose: (k: ChainNode) => void;
	} = $props();

	/** The layers the filter leaves: the articles with Artikelen, the regulations with Wetten. */
	const shown = $derived(
		layers.filter((l) => {
			// The start's own layer stays; another goes with the kind of what it holds.
			if (l.id === 'law' || l.nodes.some((n) => n.id === start)) return true;
			const c = l.nodes[0]?.collection;
			const kind =
				l.id === 'article'
					? 'artikelen'
					: c === 'judgments'
						? 'uitspraken'
						: c === 'members' || c === 'factions' || c === 'committees' || c === 'cabinets'
							? 'leden'
							: 'wetten';
			return !hiddenKinds.has(kind);
		})
	);
	/** A line given (delegates) is a grondslag, one named a mention: the filter Relatie. */
	const lineShown = (way: 'delegates' | 'mentioned') =>
		!hiddenLines.has(way === 'delegates' ? 'structural' : 'citation');

	let width = $state(760);
	/** A layer is 104 px high (Keten, Maten). */
	const ROW = 104;
	/** From a layer's label to its bronnen, and the line height of a name. */
	const DROP = 34;
	const LINE = 14;
	/** A sign of 14 px on a rim of paper of 2; the bron of the keten 18 px on a halo of 4,5 and an edge of 2. */
	const SIGN = 14;
	const RIM = 2;
	const FOCUS = 18;
	const HALO = 4.5;
	const INKTRAND = 2;
	const TOP = 48;
	const LEFT = 120;
	const height = $derived(TOP + shown.length * ROW);
	/** The room of a node in its layer, for the length of its name's lines. */
	const charsFor = (n: number) =>
		Math.max(12, Math.floor(Math.max(200, width - LEFT - 24) / Math.max(1, n) / 7));
	/**
	 * Where each node stands: its layer's row; across, under what it hangs from (the mean of its
	 * parents' places), kept apart by a node's room and within the width, so the lines run down
	 * rather than across each other (Thijs, Grondwet, 23 Oct). A layer without placed parents
	 * spreads evenly.
	 */
	const place = $derived.by(() => {
		const m = new Map<string, { x: number; y: number }>();
		const left = LEFT;
		const right = Math.max(LEFT + 200, width - 24);
		shown.forEach((layer, i) => {
			const n = layer.nodes.length;
			const gap = (right - left) / n;
			const wish = layer.nodes.map((k, j) => {
				const at = k.parents.map((p) => m.get(p.id)?.x).filter((x): x is number => x !== undefined);
				return {
					k,
					x: at.length ? at.reduce((a, b) => a + b, 0) / at.length : left + (j + 0.5) * gap
				};
			});
			// The articles of one wet stay together (their omhulling); within it, by place.
			const rank = (k: ChainNode) => layer.nodes.findIndex((q) => q.home === k.home);
			wish.sort((a, b) => rank(a.k) - rank(b.k) || a.x - b.x);
			// Apart by a gap from the left, then back within the right edge.
			const xs: number[] = [];
			wish.forEach((w, j) => xs.push(Math.max(w.x, j ? xs[j - 1] + gap : left + gap / 2)));
			for (let j = xs.length - 1; j >= 0; j--)
				xs[j] = Math.min(xs[j], j === xs.length - 1 ? right - gap / 2 : xs[j + 1] - gap);
			wish.forEach((w, j) => m.set(w.k.id, { x: xs[j], y: TOP + i * ROW + DROP }));
		});
		return m;
	});
	/** The articles of each wet in an omhulling, when the layer holds those of more than one. */
	const hulls = $derived.by(() => {
		const out: { id: string; label: string; x: number; y: number; w: number }[] = [];
		const row = shown.findIndex((l) => l.id === 'article');
		const nodes = row < 0 ? [] : shown[row].nodes;
		const homes = [...new Set(nodes.map((k) => k.home))];
		if (homes.length < 2) return out;
		for (const h of homes) {
			const xs = nodes.filter((k) => k.home === h).flatMap((k) => place.get(k.id)?.x ?? []);
			const wet = shown.flatMap((l) => l.nodes).find((k) => k.id === h);
			if (!xs.length || !wet) continue;
			const x = Math.min(...xs) - 30;
			out.push({
				id: h ?? '',
				label: wet.instrument?.abbreviation ?? wet.short,
				x,
				y: TOP + row * ROW + DROP - 26,
				w: Math.max(...xs) + 30 - x
			});
		}
		return out;
	});
	/** What a node says under its sign: its name over lines, and the date of a judgment. */
	const infoOf = $derived.by(() => {
		const m = new Map<string, { lines: string[]; date: string | null }>();
		for (const l of shown)
			for (const k of l.nodes) {
				const name = linesOf(
					k.collection === 'articles' ? k.short : k.name,
					charsFor(l.nodes.length)
				);
				const date = k.collection === 'judgments' && k.since ? korteDatum(k.since) : null;
				// One date once: a name that already carries it does not repeat it.
				const named = date && (k.name.includes(date) || k.name.includes(k.since!));
				m.set(k.id, { lines: name, date: date && !named ? date : null });
			}
		return m;
	});
	/** Where a line leaves a node below its name (and date), 7 px under the last line. */
	const under = (id: string) => {
		const i = infoOf.get(id);
		return 24 + LINE * ((i?.lines.length ?? 1) - 1) + (i?.date ? LINE : 0) + 7;
	};
	/** The words on a line of the keten: a judgment's appeal, its cassatie and its conclusie. */
	const wordOf = (relation: Relation, layer: string) =>
		relation === 'APPEAL_OF'
			? layer === 'Hoge Raad'
				? 'cassatie'
				: 'hoger beroep'
			: relation === 'ADVISES_ON'
				? 'conclusie'
				: relation === 'CONTINUES'
					? 'zet voort'
					: null;
	/**
	 * The lines (Netwerkcanvas, Lijnen): each from under the name of what it hangs under (the
	 * arrowhead there) to above the sign of the node, slightly curved, in the style of its kind.
	 */
	const lines = $derived(
		shown.flatMap((l) =>
			l.nodes.flatMap((k) =>
				k.parents.flatMap((o) => {
					if (!lineShown(o.way)) return [];
					const a = place.get(o.id);
					const b = place.get(k.id);
					if (!a || !b) return [];
					const relation = o.relation ?? relationOf(o.way);
					// A mention is an Aanhaling, the text of the law itself a grondslag.
					const from = relation === 'REFERS_TO' ? 'judgment' : 'article';
					const style = edgeStyleFor(relation, null, from);
					const lit = chosen === k.id || chosen === o.id;
					const width = lineThickness(EDGE_WEIGHT[relation]) * (lit ? 1.3 : 1);
					const shape = curvedLine(
						{ x: b.x, y: b.y - 12 },
						{ x: a.x, y: a.y + under(o.id) },
						{
							ra: -AIR,
							rb: -AIR,
							width,
							arrow: arrowLength(),
							head: style === 'lid' ? null : 'b',
							dot: style === 'submitter' ? 'a' : null
						}
					);
					const word = wordOf(relation, l.label);
					return [
						{
							id: `${o.id}~${k.id}`,
							shape,
							word,
							colour: edgeColorFor(relation, from),
							dash: edgeDashFor(style),
							width,
							lit
						}
					];
				})
			)
		)
	);
	// Each bron drawn as the canvas and the legend draw its kind: one shape and one colour per
	// kind (vormen.ts, kleur.ts), so Soort is the key to this drawing too.
	const colour = (k: ChainNode) => kindColour(k.collection);
	const vormOf = (k: ChainNode) =>
		VORMEN[vormVanBron(k.collection, { celex: k.instrument?.celex ?? null }, k.id.split('/')[1])];
	/** A line as the canvas draws its relation: a grondslag (BASED_ON), a mention (REFERS_TO). */
	function relationOf(way: 'delegates' | 'mentioned') {
		return way === 'delegates' ? ('BASED_ON' as const) : ('REFERS_TO' as const);
	}
	/** A name over at most two lines of `max` characters; a longer one ends in "…", its title
	 *  and the card name it whole. */
	const linesOf = (s: string, max = 24) => {
		const out: string[] = [];
		for (const w of s.split(/\s+/)) {
			const last = out[out.length - 1];
			if (last && (last + ' ' + w).length <= max) out[out.length - 1] = `${last} ${w}`;
			else out.push(w);
		}
		return out.length > 2 ? [out[0], `${out[1]}…`] : out;
	};
	const press = (e: KeyboardEvent, act: () => void) => {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		act();
	};

	/** The layers whose regulations not drawn are listed: "Alle 403" opens them, once more closes. */
	let open = $state<ReadonlySet<LayerId>>(new Set());
	const toggle = (id: LayerId) => {
		const next = new Set(open);
		if (!next.delete(id)) next.add(id);
		open = next;
	};
	/** How many a layer holds, drawn and listed: the number of its "Alle". */
	const allOf = (l: ChainLayer) => l.nodes.length + (rest[l.id] ?? 0);
	/** Dated outside the period of the strip: faint, not gone (Thijs, 23 Oct). */
	const outside = (k: ChainNode) =>
		!!period &&
		!!k.since &&
		((!!period.van && k.since < period.van) || (!!period.tot && k.since > period.tot));
	const outsideCount = $derived(shown.flatMap((l) => l.nodes).filter(outside).length);
	const otherIds = $derived(new Set(others.map((o) => o.id)));
	const notHere = $derived(
		others.filter((o) => !shown.some((l) => l.nodes.some((n) => n.id === o.id)))
	);
	/** The layers of the list (a phone): the start and what stands above it as the list's head (F12). */
	const head = $derived(shown.filter((l) => l.id === 'law' || l.id === 'basis' || l.id === 'eu'));
	const listed = $derived(
		shown.filter((l) => l.id !== 'law' && l.id !== 'basis' && l.id !== 'eu' && l.id !== 'article')
	);
</script>

{#snippet row(k: ChainNode)}
	<li>
		<button
			type="button"
			class="list__row"
			class:is-active={chosen === k.id}
			aria-pressed={chosen === k.id}
			onclick={() => onChoose(k)}
		>
			<span class="list__name"><i class="mark" style:background={colour(k)}></i>{k.name}</span>
			{#if k.grondslag || k.mentions}<span class="list__how"
					>{[
						k.grondslag ? `grondslag ${k.grondslag}` : null,
						k.mentions ? `noemt ${k.mentions}` : null
					]
						.filter(Boolean)
						.join(', ')}</span
				>{/if}
		</button>
	</li>
{/snippet}

{#snippet allButton(layer: ChainLayer)}
	<button
		type="button"
		class="btn is-text alle raakvlak-knop"
		aria-expanded={open.has(layer.id)}
		onclick={() => toggle(layer.id)}
		>{open.has(layer.id) ? 'Minder' : `Alle ${formatCount(allOf(layer))}`}</button
	>
{/snippet}

<div class="chain" bind:clientWidth={width}>
	{#if failure}
		<div class="failure">
			<LoadState
				state={{ status: 'error', error: failure.error }}
				what={failure.what}
				plural={failure.plural}
				retry={failure.retry}
				form="block"
			/>
		</div>
	{:else if loading}
		<p class="laden" role="status">Keten laden…</p>
	{:else if gap || expired?.total || outsideCount || notHere.length}
		<div class="kop">
			{#if outsideCount}<span class="stil">{formatCount(outsideCount)} buiten de periode</span>{/if}
			{#if notHere.length}<span class="ook"
					>Ook gekozen, niet in deze keten: {#each notHere as o, i (o.id)}{#if i},
						{/if}{#if o.onOpen}<TekstLink onclick={o.onOpen} title="De keten van {o.name}"
								>{o.name}</TekstLink
							>{:else}{o.name}{/if}{/each}</span
				>{/if}
			{#if gap}<p class="gap">{gap}</p>{/if}
			{#if expired?.total}<TekstLink onclick={expired.onToggle} aria-pressed={expired.shown}
					>{expired.shown
						? 'Zonder vervallen regelingen'
						: `Ook ${formatCount(expired.total)} vervallen ${plural(expired.total, 'regeling', 'regelingen')}`}</TekstLink
				>{/if}
		</div>
	{/if}
	<svg
		class="drawing"
		style:width="{scale * 100}%"
		viewBox="0 0 {width} {height}"
		role="group"
		aria-label="Keten"
	>
		{#each shown as layer, i (layer.id)}
			<text class="layer-label" x="24" y={TOP + i * ROW + 4}>{layer.label.toUpperCase()}</text>
			<line
				class="rail"
				x1="20"
				x2={width - 20}
				y1={TOP + i * ROW + 89.5}
				y2={TOP + i * ROW + 89.5}
			/>
			{#if rest[layer.id]}
				<g
					class="others"
					role="button"
					tabindex="0"
					aria-expanded={open.has(layer.id)}
					onclick={() => toggle(layer.id)}
					onkeydown={(e) => press(e, () => toggle(layer.id))}
				>
					<rect class="hit" x={width - 124} y={TOP + i * ROW - 18} width="104" height="32" />
					<text x={width - 24} y={TOP + i * ROW + 4} text-anchor="end"
						>{open.has(layer.id) ? 'Minder' : `Alle ${formatCount(allOf(layer))}`}</text
					>
				</g>
			{/if}
		{/each}
		{#each hulls as h (h.id)}
			<rect class="hull" x={h.x} y={h.y} width={h.w} height="72" rx="22" />
		{/each}
		{#each lines as l (l.id)}
			<g class="line" class:is-active={l.lit}>
				<path
					d={l.shape.d}
					fill="none"
					stroke={l.colour}
					stroke-width={l.width}
					stroke-dasharray={l.dash}
					stroke-linecap="round"
				/>
				{#if l.shape.head}<polygon points={l.shape.head} fill={l.colour} />{/if}
				{#if l.shape.dot}<circle
						cx={l.shape.dot.x}
						cy={l.shape.dot.y}
						r={DOT_RADIUS}
						fill={l.colour}
					/>{/if}
				{#if l.word}<text class="line-word" x={l.shape.middle.x + 8} y={l.shape.middle.y + 4}
						>{l.word}</text
					>{/if}
			</g>
		{/each}
		<!-- The names of the omhullingen over the lines, as the canvas puts them: paper, an edge of 1 px
		     in the colour of the kind, on the edge of the omhulling at its top left. -->
		{#each hulls as h (h.id)}
			{@const w = Math.round(h.label.length * 7.6 + 18)}
			<g class="pil">
				<rect x={h.x + 14} y={h.y - 10} width={w} height="20" rx="3" />
				<text x={h.x + 14 + w / 2} y={h.y + 4} text-anchor="middle">{h.label}</text>
			</g>
		{/each}
		{#each shown as layer (layer.id)}
			{#each layer.nodes as k (k.id)}
				{@const p = place.get(k.id)!}
				{@const isArticle = k.collection === 'articles'}
				{@const v = vormOf(k)}
				{@const info = infoOf.get(k.id)}
				<g
					class="node"
					class:is-active={chosen === k.id}
					class:is-dim={outside(k)}
					role="button"
					tabindex="0"
					aria-label={k.name}
					aria-pressed={chosen === k.id}
					onclick={() => onChoose(k)}
					onkeydown={(e) => press(e, () => onChoose(k))}
				>
					<title>{k.expired ? `${k.name}, vervallen sinds ${k.expired}` : k.name}</title>
					<circle cx={p.x} cy={p.y} r="22" class="hit" />
					{#if otherIds.has(k.id) && chosen !== k.id && k.id !== start}<rect
							class="sel sel--ander"
							x={p.x - 12}
							y={p.y - 12}
							width="24"
							height="24"
							rx="2"
						/>{/if}
					{#if chosen === k.id && k.id !== start}<rect
							class="sel"
							x={p.x - 12}
							y={p.y - 12}
							width="24"
							height="24"
							rx="2"
						/>{/if}
					{#if k.id === start}
						<!-- The bron of the keten: its sign in ink, with an edge of ink on a halo of paper
						     (Netwerkcanvas, Focus). -->
						{@const sc = FOCUS / 16}
						{@const at = `translate(${p.x - FOCUS / 2} ${p.y - FOCUS / 2}) scale(${sc})`}
						<path
							d={v.d}
							transform={at}
							fill="none"
							stroke="var(--paper)"
							stroke-width={(2 * HALO) / sc}
							stroke-linejoin="round"
						/>
						<path
							d={v.d}
							transform={at}
							fill={v.wijze === 'lijn' ? 'var(--paper)' : 'none'}
							stroke="var(--ink)"
							stroke-width={(2 * INKTRAND) / sc}
							stroke-linejoin="round"
						/>
						{#if v.wijze !== 'lijn'}<path
								d={v.d}
								transform={at}
								fill="var(--ink)"
								fill-rule={v.wijze === 'gat' ? 'evenodd' : 'nonzero'}
							/>{/if}
					{:else}
						{@const sc = SIGN / 16}
						{@const at = `translate(${p.x - SIGN / 2} ${p.y - SIGN / 2}) scale(${sc})`}
						<g class:vervallen={!!k.expired}>
							<path
								d={v.d}
								transform={at}
								fill="var(--paper)"
								stroke="var(--paper)"
								stroke-width={(2 * RIM) / sc}
								stroke-linejoin="round"
							/>
							<path
								d={v.d}
								transform={at}
								fill={v.wijze === 'lijn' ? 'var(--paper)' : colour(k)}
								fill-rule={v.wijze === 'gat' ? 'evenodd' : 'nonzero'}
								stroke={v.wijze === 'lijn' ? colour(k) : 'none'}
								stroke-width={1.7 / sc}
							/>
						</g>
					{/if}
					<text
						class="name {otherIds.has(k.id) ? 'name--ander' : ''}"
						class:name--law={layer.id === 'law' || k.id === start}
						x={isArticle ? p.x - 6 : p.x}
						y={p.y + 24}
						text-anchor={isArticle ? 'start' : 'middle'}
						>{#each info?.lines ?? [] as r, j (j)}<tspan
								x={isArticle ? p.x - 6 : p.x}
								dy={j ? LINE : 0}>{r}</tspan
							>{/each}</text
					>
					{#if info?.date}<text
							class="date"
							x={isArticle ? p.x - 6 : p.x}
							y={p.y + 24 + LINE * (info.lines.length - 1) + LINE}
							text-anchor={isArticle ? 'start' : 'middle'}>{info.date}</text
						>{/if}
				</g>
			{/each}
		{/each}
	</svg>
	<!-- On a wide screen the regulations a layer does not draw, listed under the drawing once
	     its Alle is pressed. -->
	{#each shown.filter((l) => open.has(l.id) && more[l.id]?.length) as layer (layer.id)}
		<section class="rest" aria-label="{layer.label}, alle">
			<h3 class="list__head">{layer.label}</h3>
			<ul>
				{#each more[layer.id] ?? [] as k (k.id)}{@render row(k)}{/each}
			</ul>
		</section>
	{/each}
	{#if amending}<p class="amending">
			{formatCount(amending)}
			{plural(amending, 'wijzigingsbesluit', 'wijzigingsbesluiten')} buiten de keten
		</p>{/if}

	<!-- On a phone: a list, the law (and what it rests on) at its head, the regulations under
	     their heading (R3-K F12). -->
	<div class="list">
		{#each head as layer (layer.id)}
			<section class="list__layer" aria-label={layer.label}>
				<h3 class="list__head">{layer.label}</h3>
				<ul>
					{#each layer.nodes as k (k.id)}{@render row(k)}{/each}
				</ul>
			</section>
		{/each}
		{#each listed as layer (layer.id)}
			<section class="list__layer" aria-label={layer.label}>
				<h3 class="list__head">{layer.label}</h3>
				<ul>
					{#each layer.nodes as k (k.id)}{@render row(k)}{/each}
					{#if open.has(layer.id)}{#each more[layer.id] ?? [] as k (k.id)}{@render row(
								k
							)}{/each}{/if}
				</ul>
				{#if rest[layer.id]}{@render allButton(layer)}{/if}
			</section>
		{/each}
	</div>
</div>

<style>
	/* An omhulling as the canvas draws it: a stadion in the colour of its kind (the articles of a
	   wet: soort-wet, solid), 5 % of it as ground, an edge of 1,6 px. */
	.hull {
		fill: color-mix(in srgb, var(--soort-wet) 5%, transparent);
		stroke: var(--soort-wet);
		stroke-width: 1.6;
	}
	.pil rect {
		fill: var(--paper);
		stroke: var(--soort-wet);
		stroke-width: 1;
	}
	.pil text {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		fill: var(--ink);
	}
	.chain {
		position: relative;
		flex: 1;
		min-height: 0;
		overflow: auto;
		background: var(--paper);
	}
	/* The gap marker (besluit 23): one label, never a paragraph. */
	.gap {
		margin: 0;
		padding: 0 var(--s-2);
		border: 1px dashed var(--rule-strong);
		border-radius: var(--r-1);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		line-height: 20px;
		color: var(--ink-3);
	}
	.amending {
		margin: 0 var(--s-5) var(--s-4);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.failure {
		margin: var(--s-5);
	}
	/* A click marks the bron with its frame (.sel); the keyboard keeps its ring. */
	.node:focus:not(:focus-visible) {
		outline: none;
	}
	.drawing {
		display: block;
		width: 100%;
		height: auto;
	}
	/* A label of a layer is a control label (sans 11 px 600, spaced), not a name. */
	.layer-label {
		font-family: var(--font-ui);
		font-size: var(--t-label);
		font-weight: 600;
		letter-spacing: 0.06em;
		fill: var(--ink-3);
	}
	.others {
		cursor: pointer;
	}
	.others text {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		fill: var(--ink-2);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
	}
	.others:hover text {
		fill: var(--ink);
	}
	.laden {
		margin: var(--s-5);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.rest {
		margin: 0 var(--s-5) var(--s-4);
	}
	.rest ul {
		margin: 0;
		padding: 0 0 0 var(--s-3);
		list-style: none;
		border-left: 2px solid var(--rule);
	}
	.alle {
		margin-top: var(--s-1);
	}
	.rail {
		stroke: var(--rule);
	}
	.line {
		opacity: 0.7;
	}
	.line.is-active {
		opacity: 1;
	}
	/* The words on a line, italic, on an edge of paper like a name. */
	.line-word {
		font-family: var(--font-serif);
		font-size: var(--t-note);
		font-style: italic;
		fill: var(--ink-3);
		paint-order: stroke;
		stroke: var(--paper);
		stroke-width: 4px;
		stroke-linejoin: round;
	}
	.date {
		font-family: var(--font-serif);
		font-size: var(--t-note);
		fill: var(--ink-3);
		paint-order: stroke;
		stroke: var(--paper);
		stroke-width: 4px;
		stroke-linejoin: round;
	}
	/* Outside the period of the strip: faint, not gone. */
	.node.is-dim {
		opacity: 0.35;
	}
	/* Another chosen bron in this keten: its frame, dashed (the marked one's is whole). */
	.sel--ander {
		stroke-dasharray: 3 2;
	}
	.name--ander {
		font-weight: 600;
		fill: var(--ink);
	}
	/* No longer in force: drawn faint, its title says since when. */
	.vervallen {
		opacity: 0.4;
	}
	.kop {
		position: absolute;
		top: var(--s-3);
		left: var(--s-5);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-2) var(--s-4);
		font-size: var(--t-micro);
	}
	.hit {
		fill: transparent;
	}
	.node {
		cursor: pointer;
	}
	.sel {
		fill: none;
		stroke: var(--ink);
		stroke-width: 2;
	}
	.name {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		fill: var(--ink-2);
		paint-order: stroke;
		stroke: var(--paper);
		stroke-width: 6px;
		stroke-linejoin: round;
	}
	.name--law,
	.node.is-active .name {
		font-weight: 600;
		fill: var(--ink);
	}
	.node:hover .name {
		fill: var(--ink);
		text-decoration: underline;
	}
	.node:focus-visible .sel,
	.node:focus-visible path {
		outline: 2px solid var(--focus);
	}
	.list {
		display: none;
	}
	@media (max-width: 768px) {
		.drawing {
			display: none;
		}
		.kop {
			position: static;
			margin: var(--s-3) var(--s-4) 0;
		}
		.rest {
			display: none;
		}
		.list {
			display: block;
			padding: var(--s-2) var(--s-4) var(--s-8);
		}
	}
	.list__layer {
		margin-top: var(--s-4);
	}
	.list__head {
		margin: 0 0 var(--s-2);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
	}
	.list ul {
		margin: 0;
		padding: 0 0 0 var(--s-3);
		list-style: none;
		border-left: 2px solid var(--rule);
	}
	.list__row {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0;
		width: 100%;
		min-height: var(--veld-h-raak);
		padding: var(--s-2) var(--s-3);
		border: 0;
		border-top: 1px solid var(--rule);
		background: none;
		text-align: left;
		cursor: pointer;
	}
	li:first-child .list__row {
		border-top: 0;
	}
	.list__row.is-active {
		background: var(--paper-2);
	}
	.list__name {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: 24px;
		color: var(--ink);
	}
	.mark {
		flex: none;
		width: 10px;
		height: 10px;
	}
	.list__how {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		line-height: 20px;
		color: var(--ink-3);
	}
</style>
