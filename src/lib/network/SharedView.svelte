<script lang="ts">
	import LoadState from '$lib/components/ui/LoadState.svelte';
	// The weergave Verband (besluit 39, mockup A197-b): the chosen bronnen at the sides, what
	// they share in a column between them, a line from each shared bron to each chosen one it
	// hangs at; the judgments they share as one circle with their count. On a phone a ladder:
	// the two bronnen at the top, what joins them as rows between two rails. One click marks a
	// shared bron: its card stands in the strip at the right.
	import { formatCount } from '$lib/text/getal';
	import { plural } from '$lib/text/words';
	import { kindColour } from '$lib/bron/kleur';
	import type { SharedModel, SharedRow } from './shared';

	let {
		ends,
		model,
		chosen = null,
		gap = null,
		failure = null,
		loading = false,
		onChoose
	}: {
		/** The chosen bronnen, in the order of the netwerk: their id and name. */
		ends: readonly { id: string; name: string; connections?: number | null }[];
		model: SharedModel | null;
		chosen?: string | null;
		/** What the data lacks, as one label. */
		gap?: string | null;
		/** What could not be loaded, said with Opnieuw (LoadState). */
		failure?: { what: string; error: unknown; retry: () => void; plural?: boolean } | null;
		loading?: boolean;
		onChoose: (r: SharedRow) => void;
	} = $props();

	let width = $state(760);
	const ROW = 62;
	const TOP = 70;
	const rows = $derived(model?.rows ?? []);
	const bottom = $derived(TOP + rows.length * ROW);
	/** The shared judgments drawn as one circle: their count, or "?" where it is not known. */
	const withJudgments = $derived(!!model && model.judgments !== 0);
	const height = $derived(Math.max(420, bottom + (withJudgments ? 160 : 40)));
	const middle = $derived(width / 2);
	/** The chosen bronnen: the first left, the second right, more under them by turns. */
	const place = $derived(
		new Map(
			ends.map((e, i) => [
				e.id,
				{
					x: i % 2 === 0 ? 120 : width - 120,
					y: (TOP + Math.max(bottom - ROW, TOP + 3 * ROW)) / 2 + Math.floor(i / 2) * 90
				}
			])
		)
	);
	const rowY = (i: number) => TOP + i * ROW;
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
	{:else if gap && model?.judgments !== null}<p class="gap">{gap}</p>{/if}
	{#if ends.length < 2}
		<p class="empty stil">Voeg een tweede bron toe</p>
	{:else}
		<svg class="drawing" viewBox="0 0 {width} {height}" role="group" aria-label="Verband">
			{#each rows as r, i (r.id)}
				{#each r.at as a (a)}
					{@const p = place.get(a)}
					{#if p}<line
							class="line"
							class:is-active={chosen === r.id}
							x1={p.x}
							y1={p.y}
							x2={middle}
							y2={rowY(i)}
						/>{/if}
				{/each}
			{/each}
			{#if model && withJudgments}
				{#each ends as e (e.id)}
					{@const p = place.get(e.id)!}
					<line
						class="line"
						x1={p.x}
						y1={p.y}
						x2={middle}
						y2={bottom + 50}
						stroke-dasharray="5 4"
					/>
				{/each}
				<circle class="group" cx={middle} cy={bottom + 50} r="26" />
				<text class="count" x={middle} y={bottom + 55} text-anchor="middle"
					>{model.judgments === null ? '?' : formatCount(model.judgments)}</text
				>
				<text class="name" x={middle} y={bottom + 96} text-anchor="middle"
					>{plural(model.judgments ?? 2, 'Uitspraak', 'Uitspraken')} die beide aanhalen</text
				>
				{#if gap && model.judgments === null}
					<foreignObject x={middle - 160} y={bottom + 108} width="320" height="28"
						><p class="gap gap--onder">{gap}</p></foreignObject
					>
				{/if}
			{/if}
			{#each rows as r, i (r.id)}
				<g
					class="node"
					class:is-active={chosen === r.id}
					role="button"
					tabindex="0"
					aria-label={r.name}
					aria-pressed={chosen === r.id}
					onclick={() => onChoose(r)}
					onkeydown={(e) => press(e, r)}
				>
					<title>{r.name}</title>
					<rect class="hit" x={middle - 150} y={rowY(i) - 26} width="300" height="40" />
					{#if chosen === r.id}<rect
							class="sel"
							x={middle - 12}
							y={rowY(i) - 12}
							width="24"
							height="24"
							rx="2"
						/>{/if}
					<rect
						x={middle - 7}
						y={rowY(i) - 7}
						width="14"
						height="14"
						fill={kindColour(r.collection)}
					/>
					<text class="name" x={middle} y={rowY(i) - 14} text-anchor="middle">{r.name}</text>
				</g>
			{/each}
			{#each ends as e (e.id)}
				{@const p = place.get(e.id)!}
				<g class="end">
					<rect x={p.x - 11} y={p.y - 11} width="22" height="22" fill="var(--ink)" />
					<rect
						x={p.x - 17}
						y={p.y - 17}
						width="34"
						height="34"
						fill="none"
						stroke="var(--ink)"
						stroke-width="1.5"
					/>
					<text class="name name--end" x={p.x} y={p.y + 34} text-anchor="middle">{e.name}</text>
					{#if e.connections}<text class="name" x={p.x} y={p.y + 56} text-anchor="middle"
							>{formatCount(e.connections)}
							{plural(e.connections, 'verbinding', 'verbindingen')}</text
						>{/if}
				</g>
			{/each}
		</svg>

		<!-- On a phone: a ladder, the two bronnen at the top, what joins them as rows. -->
		<div class="ladder">
			<p class="ladder__head"><span>{ends[0].name}</span><span>{ends[1].name}</span></p>
			<ul>
				{#each rows as r (r.id)}
					<li>
						<button
							type="button"
							class="ladder__row"
							class:is-active={chosen === r.id}
							aria-pressed={chosen === r.id}
							onclick={() => onChoose(r)}
						>
							<span class="ladder__name"
								><i class="mark" style:background={kindColour(r.collection)}></i>{r.name}</span
							>
							{#if r.line}<span class="ladder__how">{r.line}</span>{/if}
						</button>
					</li>
				{/each}
				{#if model && withJudgments}
					<li class="ladder__group">
						<span class="ladder__name"
							><i class="mark mark--round"></i>{model.judgments === null
								? 'Uitspraken'
								: `${formatCount(model.judgments)} ${plural(model.judgments, 'uitspraak', 'uitspraken')}`}
							die beide aanhalen</span
						>
						{#if gap}<span class="gap gap--ladder">{gap}</span>{/if}
					</li>
				{/if}
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
		overflow-y: auto;
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
	.gap--onder {
		position: static;
		display: table;
		margin: 0 auto;
		white-space: nowrap;
	}
	.gap--ladder {
		position: static;
		display: inline-block;
		margin: 0 var(--s-3) var(--s-2);
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
		stroke-width: 1.4;
		opacity: 0.6;
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
		stroke-width: 2.5;
		stroke-dasharray: 5 4;
	}
	.count {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 600;
		fill: var(--ink);
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
	.name--end,
	.node.is-active .name {
		font-weight: 600;
		fill: var(--ink);
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
	.ladder__head {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--s-3);
		margin: 0 0 var(--s-2);
		font-size: var(--t-meta);
		font-weight: 600;
	}
	.ladder__head span:last-child {
		text-align: right;
	}
	/* Two rails, a rung from each to every row (mockup A197-b, 390). */
	.ladder ul {
		position: relative;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.ladder ul::before,
	.ladder ul::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		background: var(--rule-strong);
	}
	.ladder ul::before {
		left: var(--s-1);
	}
	.ladder ul::after {
		right: var(--s-1);
	}
	.ladder li {
		position: relative;
		margin: 0 var(--s-5);
		border-top: 1px solid var(--rule);
	}
	.ladder li::before,
	.ladder li::after {
		content: '';
		position: absolute;
		top: calc(var(--s-4) + var(--s-1));
		width: var(--s-5);
		border-top: 1.5px solid var(--rule-strong);
	}
	.ladder li::before {
		left: calc(-1 * var(--s-5));
	}
	.ladder li::after {
		right: calc(-1 * var(--s-5));
	}
	.ladder__row {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0;
		width: 100%;
		min-height: var(--veld-h-raak);
		padding: var(--s-2) var(--s-3);
		border: 0;
		background: none;
		text-align: left;
		cursor: pointer;
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
	.ladder__group .ladder__name {
		padding: var(--s-2) var(--s-3);
		color: var(--ink-3);
	}
	.mark {
		flex: none;
		width: 10px;
		height: 10px;
	}
	.mark--round {
		border-radius: var(--r-rond);
		background: var(--indigo);
	}
	.ladder__how {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		line-height: 20px;
		color: var(--ink-3);
	}
</style>
