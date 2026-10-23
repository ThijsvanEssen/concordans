<script lang="ts">
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import type { FilterGroup } from '$lib/verbonden/filter';
	import type { Relation } from '$lib/vocabulary';
	// The weergave Keten (besluit 39, mockup A197-c): the law at the top, the articles it gives
	// powers in, the regulations under them per layer; a line from each to what it hangs under,
	// dashed where it only names it. On a wide screen a drawing in layers, on a phone a list per
	// layer (AMvB, Ministeriële regeling, Beleidsregel as headings). One click marks a bron: its
	// card stands in the strip at the right.
	import { formatCount } from '$lib/text/getal';
	import { plural } from '$lib/text/words';
	import { kindColour } from '$lib/bron/kleur';
	import type { ChainNode, ChainLayer, LayerId } from '$lib/network/chain';

	let {
		layers,
		rest = {},
		chosen = null,
		gap = null,
		scale = 1,
		hiddenKinds = new Set(),
		hiddenRelations = new Set(),
		amending = 0,
		failure = null,
		onChoose
	}: {
		layers: readonly ChainLayer[];
		/** Per layer, the regulations not drawn. */
		rest?: Partial<Record<LayerId, number>>;
		/** The node marked. */
		chosen?: string | null;
		/** What the data lacks, as one label over the drawing. */
		gap?: string | null;
		/** The zoom of the werkplek: the drawing larger or smaller, scrolled within. */
		scale?: number;
		/** The kinds and relations the filter of the strip switched off. */
		hiddenKinds?: ReadonlySet<FilterGroup>;
		hiddenRelations?: ReadonlySet<Relation>;
		/** The decrees that only change other regulations: left out of the layers, counted. */
		amending?: number;
		/** What could not be loaded, said with Opnieuw (LoadState). */
		failure?: { what: string; error: unknown; retry: () => void; plural?: boolean } | null;
		onChoose: (k: ChainNode) => void;
	} = $props();

	/** The layers the filter leaves: the articles with Artikelen, the regulations with Wetten. */
	const shown = $derived(
		layers.filter((l) =>
			l.id === 'article'
				? !hiddenKinds.has('artikelen')
				: l.id === 'law'
					? true
					: !hiddenKinds.has('wetten')
		)
	);
	/** A line given (delegates) is a grondslag, one named a mention: the filter Relatie. */
	const lineShown = (way: 'delegates' | 'mentioned') =>
		!hiddenRelations.has(way === 'delegates' ? 'BASED_ON' : 'REFERS_TO');

	let width = $state(760);
	const ROW = 120;
	const TOP = 48;
	const LEFT = 120;
	const height = $derived(TOP + shown.length * ROW);
	/** The room of a node in its layer, for the length of its name's lines. */
	const charsFor = (n: number) =>
		Math.max(12, Math.floor(Math.max(200, width - LEFT - 24) / Math.max(1, n) / 7));
	/** Where each node stands: its layer's row, spread over the width. */
	const place = $derived.by(() => {
		const m = new Map<string, { x: number; y: number }>();
		const room = Math.max(200, width - LEFT - 24);
		shown.forEach((layer, i) => {
			const n = layer.nodes.length;
			layer.nodes.forEach((k, j) =>
				m.set(k.id, { x: LEFT + ((j + 0.5) / n) * room, y: TOP + i * ROW + 30 })
			);
		});
		return m;
	});
	const lines = $derived(
		shown.flatMap((l) =>
			l.nodes.flatMap((k) =>
				k.parents.flatMap((o) => {
					if (!lineShown(o.way)) return [];
					const a = place.get(o.id);
					const b = place.get(k.id);
					return a && b
						? [
								{
									id: `${o.id}~${k.id}`,
									a,
									b,
									dashed: o.way === 'mentioned',
									lit: chosen === k.id || chosen === o.id
								}
							]
						: [];
				})
			)
		)
	);
	const colour = (k: ChainNode) =>
		k.collection === 'articles' ? 'var(--ink)' : kindColour('instruments');
	/** A name over at most three lines of `max` characters; a longer one ends in "…", its
	 *  title and the card name it whole. */
	const linesOf = (s: string, max = 24) => {
		const out: string[] = [];
		for (const w of s.split(/\s+/)) {
			const last = out[out.length - 1];
			if (last && (last + ' ' + w).length <= max) out[out.length - 1] = `${last} ${w}`;
			else out.push(w);
		}
		return out.length > 3 ? [...out.slice(0, 2), `${out[2]}…`] : out;
	};
	const press = (e: KeyboardEvent, k: ChainNode) => {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		onChoose(k);
	};
</script>

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
	{:else if gap}<p class="gap">{gap}</p>{/if}
	<svg
		class="drawing"
		style:width="{scale * 100}%"
		viewBox="0 0 {width} {height}"
		role="group"
		aria-label="Keten"
	>
		{#each shown as layer, i (layer.id)}
			<text class="layer-label" x="24" y={TOP + i * ROW + 4}>{layer.label.toUpperCase()}</text>
			<line class="rail" x1="20" x2={width - 20} y1={TOP + i * ROW + 70} y2={TOP + i * ROW + 70} />
			{#if rest[layer.id]}
				<text class="others" x={width - 24} y={TOP + i * ROW + 4} text-anchor="end"
					>en {formatCount(rest[layer.id]!)} andere</text
				>
			{/if}
		{/each}
		{#each lines as l (l.id)}
			<line
				class="line"
				class:is-active={l.lit}
				x1={l.a.x}
				y1={l.a.y + 8}
				x2={l.b.x}
				y2={l.b.y - 8}
				stroke-dasharray={l.dashed ? '5 4' : undefined}
			/>
		{/each}
		{#each shown as layer (layer.id)}
			{#each layer.nodes as k (k.id)}
				{@const p = place.get(k.id)!}
				{@const isArticle = k.collection === 'articles'}
				<g
					class="node"
					class:is-active={chosen === k.id}
					role="button"
					tabindex="0"
					aria-label={k.name}
					aria-pressed={chosen === k.id}
					onclick={() => onChoose(k)}
					onkeydown={(e) => press(e, k)}
				>
					<title>{k.name}</title>
					<circle cx={p.x} cy={p.y} r="22" class="hit" />
					{#if chosen === k.id}<rect
							class="sel"
							x={p.x - 12}
							y={p.y - 12}
							width="24"
							height="24"
							rx="2"
						/>{/if}
					<rect
						x={p.x - 7}
						y={p.y - 7}
						width="14"
						height="14"
						fill={isArticle || (layer.id !== 'law' && layer.id !== 'basis' && layer.id !== 'amvb')
							? 'var(--paper)'
							: colour(k)}
						stroke={colour(k)}
						stroke-width={isArticle ? 1.5 : 2}
					/>
					<text
						class="name"
						class:name--law={layer.id === 'law'}
						x={isArticle ? p.x - 6 : p.x}
						y={p.y + 24}
						text-anchor={isArticle ? 'start' : 'middle'}
						>{#each linesOf(isArticle ? k.short : k.name, charsFor(layer.nodes.length)) as r, j (j)}<tspan
								x={isArticle ? p.x - 6 : p.x}
								dy={j ? 14 : 0}>{r}</tspan
							>{/each}</text
					>
				</g>
			{/each}
		{/each}
	</svg>
	{#if amending}<p class="amending">
			{formatCount(amending)}
			{plural(amending, 'wijzigingsbesluit', 'wijzigingsbesluiten')} buiten de keten
		</p>{/if}

	<!-- On a phone: the shown as a list, the regulations under their heading. -->
	<div class="list">
		{#each shown.filter((l) => l.id !== 'law' && l.id !== 'article') as layer (layer.id)}
			<section class="list__layer" aria-label={layer.label}>
				<h3 class="list__head">{layer.label}</h3>
				<ul>
					{#each layer.nodes as k (k.id)}
						<li>
							<button
								type="button"
								class="list__row"
								class:is-active={chosen === k.id}
								aria-pressed={chosen === k.id}
								onclick={() => onChoose(k)}
							>
								<span class="list__name"
									><i class="mark" style:background={colour(k)}></i>{k.name}</span
								>
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
					{/each}
				</ul>
				{#if rest[layer.id]}<p class="list__others">
						en {formatCount(rest[layer.id]!)} andere
					</p>{/if}
			</section>
		{/each}
	</div>
</div>

<style>
	.chain {
		position: relative;
		flex: 1;
		min-height: 0;
		overflow: auto;
		background: var(--paper);
	}
	/* The gap marker (besluit 23): one label, never a paragraph. */
	.gap {
		position: absolute;
		top: var(--s-3);
		left: var(--s-5);
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
	.layer-label {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		fill: var(--ink-3);
	}
	.others {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		fill: var(--ink-3);
	}
	.rail {
		stroke: var(--rule);
	}
	.line {
		stroke: var(--rule-strong);
		stroke-width: 1.2;
		opacity: 0.7;
	}
	.line.is-active {
		stroke: var(--ink);
		stroke-width: 2;
		opacity: 1;
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
		stroke-width: 4px;
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
	.node:focus-visible rect {
		outline: 2px solid var(--focus);
	}
	.list {
		display: none;
	}
	@media (max-width: 768px) {
		.drawing {
			display: none;
		}
		.gap {
			position: static;
			display: inline-block;
			margin: var(--s-3) var(--s-4) 0;
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
	.list__others {
		margin: var(--s-2) 0 0;
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
</style>
