<script lang="ts">
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { filterGroupOf, type FilterGroup } from '$lib/verbonden/filter';
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
	import { VORMEN, vormVanBron } from '$lib/bron/vormen';
	import type { SharedRow, VerbandModel } from './shared';

	let {
		ends,
		model,
		chosen = null,
		gap = null,
		scale = 1,
		hiddenKinds = new Set(),
		hiddenRelations = new Set(),
		failure = null,
		loading = false,
		onChoose
	}: {
		/** The chosen bronnen: their id and name, in the order Verband draws them. */
		ends: readonly { id: string; name: string; connections?: number | null }[];
		model: VerbandModel | null;
		chosen?: string | null;
		/** What the data lacks, as one label. */
		gap?: string | null;
		/** The zoom of the werkplek: the drawing larger or smaller, scrolled within. */
		scale?: number;
		/** The kinds and relations the filter of the strip switched off. */
		hiddenKinds?: ReadonlySet<FilterGroup>;
		hiddenRelations?: ReadonlySet<Relation>;
		/** What could not be loaded, said with Opnieuw (LoadState). */
		failure?: { what: string; error: unknown; retry: () => void; plural?: boolean } | null;
		loading?: boolean;
		onChoose: (r: SharedRow) => void;
	} = $props();

	/** One line of the column at the right: a verbinding, a shared bron, or a pair's judgments. */
	type Item =
		| { soort: 'direct'; id: string; text: string; at: readonly string[] }
		| { soort: 'row'; id: string; row: SharedRow; at: readonly string[] }
		| { soort: 'judgments'; id: string; total: number; at: readonly string[] };

	const nameOf = (id: string) => ends.find((e) => e.id === id)?.name ?? id;
	const items = $derived.by((): Item[] => {
		if (!model) return [];
		const rows = model.rows.filter((r) => {
			const k = filterGroupOf(r.collection, r.node.key, r.node.props);
			return (!k || !hiddenKinds.has(k)) && r.relations.some((rel) => !hiddenRelations.has(rel));
		});
		return [
			...model.direct
				.filter((d) => !hiddenRelations.has(d.relation))
				.map((d) => ({ soort: 'direct' as const, id: d.at.join('~'), text: d.text, at: d.at })),
			...rows.map((row) => ({ soort: 'row' as const, id: row.id, row, at: row.at })),
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
	const ROW = 44;
	const TOP = 56;
	const END_X = 232;
	const span = $derived(Math.max(items.length, ends.length * 1.6, 4));
	const height = $derived(TOP + span * ROW + 24);
	const rowX = $derived(Math.max(END_X + 160, Math.round(width * 0.48)));
	const rowY = (i: number) => TOP + i * ROW;
	/** The chosen bronnen spread over the height of the column at the right. */
	const endY = (i: number) =>
		ends.length < 2 ? TOP : TOP + (i * (span - 1) * ROW) / (ends.length - 1);
	const place = $derived(new Map(ends.map((e, i) => [e.id, { x: END_X, y: endY(i) }])));
	const alone = $derived(new Set(model?.alone ?? []));
	/** A name over one line as wide as its column allows; a longer one ends in "…". */
	const cut = (s: string, room: number) => {
		const max = Math.max(16, Math.floor(room / 7));
		return s.length > max ? `${s.slice(0, max - 1)}…` : s;
	};
	const vormOf = (r: SharedRow) => VORMEN[vormVanBron(r.collection, r.node.props, r.node.key)];
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
		<p class="empty stil">Voeg een tweede bron toe</p>
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
					{#if p}<line
							class="line"
							class:is-active={chosen === it.id}
							class:line--direct={it.soort === 'direct'}
							x1={p.x + 14}
							y1={p.y}
							x2={rowX - 12}
							y2={rowY(i)}
						/>{/if}
				{/each}
			{/each}
			{#each items as it, i (it.id)}
				{#if it.soort === 'row'}
					{@const v = vormOf(it.row)}
					<g
						class="node"
						class:is-active={chosen === it.id}
						role="button"
						tabindex="0"
						aria-label={it.row.name}
						aria-pressed={chosen === it.id}
						onclick={() => onChoose(it.row)}
						onkeydown={(e) => press(e, it.row)}
					>
						<title>{it.row.name}: {it.row.line}</title>
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
							fill={v.wijze === 'lijn' ? 'var(--paper)' : kindColour(it.row.collection)}
							fill-rule="evenodd"
							stroke={v.wijze === 'lijn' ? kindColour(it.row.collection) : 'none'}
							stroke-width="1.5"
						/>
						<text class="name" x={rowX + 18} y={rowY(i) + 4}
							>{cut(it.row.name, width - rowX - 40)}</text
						>
					</g>
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
							>{/if}
					</li>
				{/each}
			</ul>
			<ul class="ladder__items">
				{#each items as it (it.id)}
					<li>
						{#if it.soort === 'row'}
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
	{/if}
	{#if loading}<p class="sr-only" role="status">Laden…</p>{/if}
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
	.line {
		stroke: var(--rule-strong);
		stroke-width: 1.2;
		opacity: 0.7;
	}
	.line--direct,
	.direct-mark {
		stroke: var(--ink-2);
		stroke-width: 1.6;
		opacity: 1;
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
	.group {
		fill: var(--paper);
		stroke: var(--indigo);
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
		border: 2px dashed var(--indigo);
	}
	.ladder__how {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		line-height: 20px;
		color: var(--ink-3);
	}
</style>
