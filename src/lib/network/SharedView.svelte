<script lang="ts">
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import LinkChains from './LinkChains.svelte';
	import { useSearchOpener } from '$lib/stores/search-trigger';
	import { filterGroupOf, type FilterGroup } from '$lib/verbonden/filter';
	import { lineKindOf, type LineKind } from '$lib/graph/line-kind';
	import { drawClassOf } from '$lib/graph/types';
	import type { Relation } from '$lib/vocabulary';
	// The weergave Verband (besluit 39, mockup A197-b): the chosen bronnen in a column at the
	// left, their names beside them; at the right, in one column, what joins them: the
	// verbindingen between them, what pairs of them share (those that more share first) and the
	// judgments a pair cites, each with a line to every chosen bron it hangs at. Names stand in
	// their column, never across a line. A chosen bron without any verbinding says so under its
	// name. On a phone a list of the same, each row saying whom it joins. One click marks a
	// shared bron: its card stands in the strip at the right.
	import { formatCount } from '$lib/text/getal';
	import { joinAnd, plural } from '$lib/text/words';
	import { kindColour } from '$lib/bron/kleur';
	import { markOf } from '$lib/bron/vormen';
	import { groupHead, type SharedRow, type VerbandModel } from './shared';
	import { drawnLine } from '$lib/components/graph/drawn-line';
	import type { ChainBron, ChainsState } from './linkchains';

	let {
		ends,
		model,
		chosen = null,
		gap = null,
		scale = 1,
		hiddenKinds = new Set(),
		hiddenLines = new Set(),
		failure = null,
		loading = false,
		steps = 1,
		chains = null,
		onChoose,
		onChooseBron = () => {},
		onSteps = () => {}
	}: {
		/** The chosen bronnen: their id and name, in the order Verband draws them. */
		ends: readonly {
			id: string;
			name: string;
			connections?: number | null;
			note?: string | null;
		}[];
		model: VerbandModel | null;
		chosen?: string | null;
		/** What the data lacks, as one label. */
		gap?: string | null;
		/** The zoom of the werkplek: the drawing larger or smaller, scrolled within. */
		scale?: number;
		/** The kinds and relations the filter of the strip switched off. */
		hiddenKinds?: ReadonlySet<FilterGroup>;
		hiddenLines?: ReadonlySet<LineKind>;
		/** What could not be loaded, said with Opnieuw (LoadState). */
		failure?: { what: string; error: unknown; retry: () => void; plural?: boolean } | null;
		loading?: boolean;
		/** Aantal stappen: 1 is what the bronnen share, 2 and 3 add the ketens. */
		steps?: number;
		/** The ketens of the pair at 2 and 3 steps; null at 1. */
		chains?: ChainsState | null;
		onChoose: (r: SharedRow) => void;
		/** A tussenbron of a keten marked. */
		onChooseBron?: (b: ChainBron) => void;
		/** Geen keten: search with more steps. */
		onSteps?: (steps: number) => void;
	} = $props();

	/** One line of the column at the right: a verbinding, a shared bron, or a pair's judgments. */
	type Item =
		| { soort: 'head'; id: string; text: string; at: readonly string[] }
		| {
				soort: 'direct';
				id: string;
				text: string;
				at: readonly string[];
				relation: Relation;
		  }
		| { soort: 'row'; id: string; row: SharedRow; at: readonly string[] }
		| { soort: 'judgments'; id: string; total: number; at: readonly string[] };

	/** Nothing joins the chosen bronnen: no verbinding, no shared bron, no judgment they cite. */
	const empty = $derived(
		!!model &&
			model.direct.length === 0 &&
			model.rows.length === 0 &&
			model.judgments.length === 0 &&
			model.rest === 0
	);
	/** Nothing joins them within `steps`: what they share and, from 2 steps, the ketens. */
	const noChain = $derived(
		empty && (steps === 1 || (chains?.status === 'ready' && chains.model.none))
	);
	const incomplete = $derived(chains?.status === 'ready' && chains.model.incomplete);
	const nameOf = (id: string) => ends.find((e) => e.id === id)?.name ?? id;
	const items = $derived.by((): Item[] => {
		if (!model) return [];
		const rows = model.rows.filter((r) => {
			const k = filterGroupOf(r.collection, r.node.key, r.node.props);
			return (
				(!k || !hiddenKinds.has(k)) &&
				r.relations.some((rel) => !hiddenLines.has(lineKindOf(rel, drawClassOf(r.collection))))
			);
		});
		let sharing = 0;
		const body = rows.flatMap((row): Item[] => {
			const head = row.at.length !== sharing ? groupHead(row.at.length, ends.length) : null;
			sharing = row.at.length;
			return [
				...(head
					? [{ soort: 'head' as const, id: `kop~${row.at.length}`, text: head, at: [] }]
					: []),
				{ soort: 'row' as const, id: row.id, row, at: row.at }
			];
		});
		return [
			...model.direct
				.filter((d) => !hiddenLines.has(lineKindOf(d.relation)))
				.map((d) => ({
					soort: 'direct' as const,
					id: d.at.join('~'),
					text: d.text,
					at: d.at,
					relation: d.relation
				})),
			...body,
			...(hiddenKinds.has('uitspraken') ? [] : model.judgments).map((j) => ({
				soort: 'judgments' as const,
				id: `uitspraken~${j.at.join('~')}`,
				total: j.total,
				at: j.at
			}))
		];
	});
	const judgmentsText = (total: number, at: readonly string[]) =>
		`${formatCount(total)} ${plural(total, 'uitspraak', 'uitspraken')} die ${joinAnd(at.map(nameOf))} aanhalen`;

	let width = $state(760);
	const ROW = 48;
	const TOP = 56;
	const END_X = 264;
	const span = $derived(Math.max(items.length, ends.length * 1.6, 4));
	const height = $derived(TOP + span * ROW + 24);
	const rowX = $derived(Math.max(END_X + 160, Math.round(width * 0.48)));
	const rowY = (i: number) => TOP + i * ROW;
	/** The chosen bronnen spread over the height of the column at the right. */
	const endY = (i: number) =>
		ends.length < 2 ? TOP : TOP + (i * (span - 1) * ROW) / (ends.length - 1);
	const place = $derived(new Map(ends.map((e, i) => [e.id, { x: END_X, y: endY(i) }])));
	/** The line from the chosen bron `a` to what is drawn at row `i`, in the style of its kind. */
	function lineFor(it: Item, a: string, i: number) {
		const p = place.get(a)!;
		const from = { x: p.x + 9, y: p.y };
		const to = { x: rowX - 8, y: rowY(i) };
		if (it.soort === 'row') {
			const how = it.row.how.find((h) => h.bron === a);
			return drawnLine(from, to, {
				relation: how?.relation ?? null,
				from: how?.from ?? null,
				arrow: how ? (how.toward === 'row' ? 'b' : 'a') : null,
				ra: 0,
				rb: 3
			});
		}
		if (it.soort === 'judgments')
			return drawnLine(from, to, {
				relation: 'REFERS_TO',
				from: 'judgments',
				arrow: 'a',
				ra: 0,
				rb: 3
			});
		return drawnLine(from, to, {
			relation: it.soort === 'direct' ? it.relation : null,
			from: null,
			arrow: null,
			ra: 0,
			rb: 3
		});
	}
	const alone = $derived(new Set(model?.alone ?? []));
	/** A name over one line as wide as its column allows; a longer one ends in "…". */
	const cut = (s: string, room: number) => {
		const max = Math.max(16, Math.floor(room / 7));
		return s.length > max ? `${s.slice(0, max - 1)}…` : s;
	};
	const markFor = (r: SharedRow) =>
		markOf(r.collection, kindColour(r.collection), r.node.props, r.node.key);
	const openSearch = useSearchOpener();
	const press = (e: KeyboardEvent, r: SharedRow) => {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		onChoose(r);
	};
</script>

<div class="shared" bind:clientWidth={width}>
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
	{#if ends.length < 2}
		<p class="empty stil">
			<TekstLink onclick={() => openSearch()}>Kies een tweede bron</TekstLink>
		</p>
	{:else if loading}
		<p class="empty stil" role="status">Verband zoeken</p>
	{:else if noChain && !failure && !gap}
		<p class="empty stil">
			{incomplete ? 'Geen keten gevonden' : 'Geen keten'} binnen {steps}
			{plural(steps, 'stap', 'stappen')}{incomplete ? ', het zoeken was niet volledig' : ''}
			{#if steps < 3}<TekstLink onclick={() => onSteps(steps + 1)}
					>Zoek tot {steps + 1} stappen</TekstLink
				>{/if}
		</p>
	{:else}
		{#if steps > 1}<h3 class="blok">Eén stap</h3>{/if}
		{#if empty && steps > 1}
			<p class="stil blok__leeg">Geen keten van één stap</p>
		{:else}
			<svg
				class="drawing"
				style:width="{scale * 100}%"
				viewBox="0 0 {width} {height}"
				role="group"
				aria-label="Verband"
			>
				{#each items as it, i (it.id)}
					{#each it.at as a (a)}
						{@const p = place.get(a)}
						{#if p}
							{@const l = lineFor(it, a, i)}
							<path
								class="line"
								class:is-active={chosen === it.id}
								d={l.d}
								fill="none"
								stroke={l.colour}
								stroke-width={l.width}
								stroke-dasharray={l.dash}
							/>
							{#if l.head}<polygon
									class="line"
									class:is-active={chosen === it.id}
									points={l.head}
									fill={l.colour}
									stroke="none"
								/>{/if}
						{/if}
					{/each}
				{/each}
				{#each items as it, i (it.id)}
					{#if it.soort === 'row'}
						{@const v = markFor(it.row)}
						<g
							class="node"
							class:is-active={chosen === it.id}
							role="button"
							tabindex="0"
							aria-label={it.row.detail ? `${it.row.name}, ${it.row.detail}` : it.row.name}
							aria-pressed={chosen === it.id}
							onclick={() => onChoose(it.row)}
							onkeydown={(e) => press(e, it.row)}
						>
							<title>{it.row.name}{it.row.detail ? `, ${it.row.detail}` : ''}: {it.row.line}</title>
							<rect
								class="hit"
								x={rowX - 16}
								y={rowY(i) - 20}
								width={Math.max(0, width - rowX)}
								height="40"
							/>
							{#if chosen === it.id}<rect
									class="sel"
									x={rowX - 12}
									y={rowY(i) - 12}
									width="24"
									height="24"
									rx="2"
								/>{/if}
							<path
								d={v.d}
								transform="translate({rowX - 8} {rowY(i) - 8})"
								fill={v.fill}
								fill-rule="evenodd"
								stroke={v.stroke}
								stroke-width="1.5"
							/>
							<text class="name" x={rowX + 18} y={rowY(i) - (it.row.detail ? 2 : -4)}
								>{cut(it.row.name, width - rowX - 40)}</text
							>
							{#if it.row.detail}<text class="name name--detail" x={rowX + 18} y={rowY(i) + 14}
									>{cut(it.row.detail, width - rowX - 40)}</text
								>{/if}
						</g>
					{:else if it.soort === 'head'}
						<text class="kop" x={rowX - 8} y={rowY(i) + 4}>{it.text}</text>
					{:else if it.soort === 'judgments'}
						<circle class="group" cx={rowX} cy={rowY(i)} r="8" />
						<text class="name" x={rowX + 18} y={rowY(i) + 4}
							>{cut(judgmentsText(it.total, it.at), width - rowX - 40)}</text
						>
					{:else}
						<line class="direct-mark" x1={rowX - 8} y1={rowY(i)} x2={rowX + 8} y2={rowY(i)} />
						<text class="name name--direct" x={rowX + 18} y={rowY(i) + 4}
							>{cut(it.text, width - rowX - 40)}</text
						>
					{/if}
				{/each}
				{#each ends as e (e.id)}
					{@const p = place.get(e.id)!}
					<g class="end">
						<rect x={p.x - 9} y={p.y - 9} width="18" height="18" fill="var(--ink)" />
						<text class="name name--end" x={p.x - 20} y={p.y + 4} text-anchor="end"
							>{cut(e.name, p.x - 40)}</text
						>
						{#if alone.has(e.id)}<text
								class="name name--alone"
								x={p.x - 20}
								y={p.y + 20}
								text-anchor="end">geen verbinding met de andere</text
							>{:else if e.note}<text
								class="name name--alone"
								x={p.x - 20}
								y={p.y + 20}
								text-anchor="end">{cut(e.note, p.x - 40)}</text
							>{/if}
					</g>
				{/each}
			</svg>

			<!-- On a phone: the same as a list, each row saying whom it joins. -->
			<div class="ladder">
				<ul class="ladder__ends">
					{#each ends as e (e.id)}
						<li>
							<span class="ladder__name"><i class="mark mark--end"></i>{e.name}</span>
							{#if alone.has(e.id)}<span class="ladder__how"
									>geen verbinding met de andere gekozen bronnen</span
								>{:else if e.note}<span class="ladder__how">{e.note}</span>{/if}
						</li>
					{/each}
				</ul>
				<ul class="ladder__items">
					{#each items as it (it.id)}
						<li class:ladder__kop={it.soort === 'head'}>
							{#if it.soort === 'head'}
								{it.text}
							{:else if it.soort === 'row'}
								<button
									type="button"
									class="ladder__row"
									class:is-active={chosen === it.id}
									aria-pressed={chosen === it.id}
									onclick={() => onChoose(it.row)}
								>
									<span class="ladder__name"
										><i class="mark" style:background={kindColour(it.row.collection)}></i>{it.row
											.name}</span
									>
									{#if it.row.detail}<span class="ladder__how">{it.row.detail}</span>{/if}
									{#if it.row.line}<span class="ladder__how">{it.row.line}</span>{/if}
								</button>
							{:else if it.soort === 'judgments'}
								<span class="ladder__row ladder__row--stil"
									><span class="ladder__name"
										><i class="mark mark--round"></i>{judgmentsText(it.total, it.at)}</span
									></span
								>
							{:else}
								<span class="ladder__row ladder__row--stil"
									><span class="ladder__name">{it.text}</span></span
								>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
			{#if model && model.rest > 0}
				<!-- What the drawing leaves out is counted (Principe 7). -->
				<p class="rest stil">
					{formatCount(model.rows.length)} van {formatCount(model.rows.length + model.rest)} gedeelde
					bronnen
				</p>
			{/if}
		{/if}
		{#if steps > 1 && chains}
			<LinkChains result={chains} {scale} {chosen} onChoose={onChooseBron} />
		{/if}
	{/if}
</div>

<style>
	.shared {
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
		font-size: var(--t-micro);
		line-height: 20px;
		color: var(--ink-3);
	}
	.empty {
		margin: var(--s-8) var(--s-5);
		font-size: var(--t-meta);
	}
	.blok {
		margin: var(--s-4) var(--s-4) 0;
		font-size: var(--t-label);
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-3);
	}
	.blok__leeg {
		margin: var(--s-2) var(--s-4);
		font-size: var(--t-meta);
	}
	.rest {
		margin: var(--s-2) var(--s-5) var(--s-4);
		font-size: var(--t-meta);
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
	.direct-mark {
		stroke: var(--ink-2);
		stroke-width: 1.6;
		opacity: 1;
	}
	.line.is-active {
		stroke: var(--ink);
		stroke-width: 2;
	}
	polygon.line.is-active {
		fill: var(--ink);
	}
	.kop {
		font-family: var(--font-serif);
		font-size: var(--t-label);
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		fill: var(--ink-3);
	}
	.name--detail {
		font-size: var(--t-label);
		fill: var(--ink-3);
	}
	.ladder__kop {
		padding: var(--s-3) 0 var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-label);
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-3);
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
	.group {
		fill: var(--paper);
		stroke: var(--rubriek-rechtspraak);
		stroke-width: 2;
		stroke-dasharray: 3 2;
	}
	.name {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		fill: var(--ink-2);
	}
	.name--end,
	.name--direct,
	.node.is-active .name {
		font-weight: 600;
		fill: var(--ink);
	}
	.name--alone {
		fill: var(--ink-3);
	}
	.node:hover .name {
		fill: var(--ink);
		text-decoration: underline;
	}
	.ladder {
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
		.ladder {
			display: block;
			padding: var(--s-4) var(--s-4) var(--s-8);
		}
	}
	.ladder ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.ladder__ends {
		display: grid;
		gap: var(--s-1);
		padding-bottom: var(--s-4);
	}
	.ladder__ends li {
		display: grid;
	}
	.ladder__items li {
		border-top: 1px solid var(--rule);
	}
	.ladder__row {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0;
		width: 100%;
		min-height: var(--veld-h-raak);
		padding: var(--s-2) 0;
		border: 0;
		background: none;
		text-align: left;
		cursor: pointer;
	}
	.ladder__row--stil {
		cursor: default;
	}
	.ladder__row.is-active {
		background: var(--paper-2);
	}
	.ladder__name {
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
	.mark--end {
		background: var(--ink);
	}
	.mark--round {
		border-radius: var(--r-rond);
		border: 2px dashed var(--rubriek-rechtspraak);
	}
	.ladder__how {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		line-height: 20px;
		color: var(--ink-3);
	}
</style>
