<script lang="ts">
	// The weergave Verband (DS Verband): how the chosen bronnen are joined, in one form. Each row
	// is a chain from the one chosen bron to the other, also at one step, where what both name
	// (a stuk, an uitspraak) stands between them; blocks Eén stap, Twee stappen, Drie stappen.
	// With three to six bronnen a Keuze above holds Alle drie and each pair, and shows the rows
	// of that choice only. One click on a pill or a tussenbron marks its row: its card stands
	// in the strip at the right.
	import Keuze from '$lib/components/ui/Keuze.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import SlowLoad from '$lib/components/ui/SlowLoad.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import ChainRows from './ChainRows.svelte';
	import { useSearchOpener } from '$lib/stores/search-trigger';
	import { filterGroupOf, type FilterGroup } from '$lib/verbonden/filter';
	import { lineKindOf, type LineKind } from '$lib/graph/line-kind';
	import { drawClassOf } from '$lib/graph/types';
	import { formatCount } from '$lib/text/getal';
	import { plural } from '$lib/text/words';
	import type { ChainsState } from './linkchains';
	import type { SharedRow, SharedModel } from './shared';
	import { useWeergaveBlad } from './weergave-blad';
	import { drawing as drawingOf, isMenu, withDossierNumbers, options, type PairEnd } from './pairs';

	let {
		ends: given,
		model,
		choice,
		gap = null,
		scale = 1,
		chosen = null,
		hiddenKinds = new Set(),
		hiddenLines = new Set(),
		failure = null,
		loading = false,
		steps = 1,
		chains = null,
		onChoose,
		onChoice = () => {},
		onSteps = () => {}
	}: {
		/** The chosen bronnen in the order Verband draws them. */
		ends: readonly PairEnd[];
		model: SharedModel | null;
		/** What the Keuze shows: Alle, or a pair (`a,b`); see resolveChoice. */
		choice: string;
		/** What the data lacks, as one label. */
		gap?: string | null;
		/** The zoom of the werkplek: the drawing larger or smaller, scrolled within. */
		scale?: number;
		/** The kenmerk or tussenbron marked. */
		chosen?: string | null;
		/** The kinds and relations the filter of the strip switched off. */
		hiddenKinds?: ReadonlySet<FilterGroup>;
		hiddenLines?: ReadonlySet<LineKind>;
		/** What could not be loaded, said with Opnieuw (LoadState). */
		failure?: { what: string; error: unknown; retry: () => void; plural?: boolean } | null;
		loading?: boolean;
		/** Aantal stappen: 1 is what the bronnen share, 2 and 3 add the ketens of a pair. */
		steps?: number;
		/** The ketens of the pair at 2 and 3 steps; null at 1 and for Alle. */
		chains?: ChainsState | null;
		/** A kenmerk or tussenbron marked; null clears the mark. */
		onChoose: (id: string | null) => void;
		onChoice?: (choice: string) => void;
		/** Geen keten: search with more steps. */
		onSteps?: (steps: number) => void;
	} = $props();

	const ends = $derived(withDossierNumbers(given));
	const narrowed = $derived(hiddenKinds.size > 0 || hiddenLines.size > 0);
	const keep = (r: SharedRow) => {
		const k = filterGroupOf(r.collection, r.node.key, r.node.props);
		return (
			(!k || !hiddenKinds.has(k)) &&
			r.relations.some((rel) => !hiddenLines.has(lineKindOf(rel, drawClassOf(r.collection))))
		);
	};
	const shown = $derived(
		model
			? { ...model, direct: model.direct.filter((d) => !hiddenLines.has(lineKindOf(d.relation))) }
			: null
	);
	const drawn = $derived(
		shown && ends.length >= 2
			? drawingOf({ ends, model: shown, choice, steps, chains, keep, narrowed })
			: null
	);
	const choices = $derived(
		shown
			? options(ends, shown).map((o) => ({ ...o, label: `${o.label} (${formatCount(o.count)})` }))
			: []
	);
	const asOptions = $derived(choices.map((o) => ({ waarde: o.value, label: o.label })));
	const asMenu = $derived(isMenu(choices));

	const rowsDrawn = $derived(drawn?.blocks.some((b) => b.rows.length > 0) ?? false);
	const incomplete = $derived(chains?.status === 'ready' && chains.model.incomplete);
	const pending = $derived(drawn?.pending ?? []);
	/** Nothing joins them within `steps`: the ready blocks hold no row, none is on its way. */
	const noChain = $derived(
		!!drawn &&
			!rowsDrawn &&
			pending.length === 0 &&
			(steps === 1 || chains?.status === 'ready' || choice === 'alle')
	);
	const openBlad = useWeergaveBlad();
	const BLOCK = ['', 'Eén stap', 'Twee stappen', 'Drie stappen'];
	const openSearch = useSearchOpener();
	const keydown = (e: KeyboardEvent) => {
		if (e.key === 'Escape' && chosen) onChoose(null);
	};
</script>

<!-- Escape wipes the mark (DS Verband, Toegankelijkheid). -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="shared" onkeydown={keydown}>
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
	{:else if loading || !drawn}
		<p class="empty stil" role="status">Verband zoeken</p>
	{:else}
		{#if openBlad}
			<!-- A phone: the Netwerkkeuze as a Blad, from the top (DS Verband, Telefoon). -->
			<button type="button" class="blad-knop" aria-haspopup="dialog" onclick={openBlad}
				>Verband, {steps} {plural(steps, 'stap', 'stappen')}</button
			>
		{/if}
		{#if choices.length}
			<div class="keuze">
				{#if asMenu}
					<TekstMenu label="Bronnen" opties={asOptions} waarde={choice} onSelect={onChoice} breed />
				{:else}
					<Keuze label="Bronnen" opties={asOptions} waarde={choice} onSelect={onChoice} vol rijen />
				{/if}
			</div>
		{/if}
		{#if noChain && !failure && !gap}
			<svg class="geen" viewBox="0 0 240 24" aria-hidden="true">
				<rect x="2" y="5" width="14" height="14" fill="var(--ink)" />
				<line x1="26" y1="12" x2="214" y2="12" stroke="var(--rule-strong)" stroke-dasharray="3 4" />
				<rect x="224" y="5" width="14" height="14" fill="var(--ink)" />
			</svg>
			<p class="empty stil">
				{incomplete ? 'Geen keten gevonden' : 'Geen keten'} binnen {steps}
				{plural(steps, 'stap', 'stappen')}{incomplete ? ', het zoeken was niet volledig' : ''}
				{#if steps < 3 && choice !== 'alle'}<TekstLink onclick={() => onSteps(steps + 1)}
						>Zoek tot {steps + 1} stappen</TekstLink
					>{/if}
			</p>
		{:else}
			<ChainRows drawing={drawn} {scale} {chosen} onChoose={(id) => onChoose(id)} />
			{#if pending.length}
				{#if chains?.status === 'error'}
					<div class="failure">
						<LoadState
							state={{ status: 'error', error: chains.error }}
							what="De ketens"
							plural
							unbuilt
							retry={chains.retry}
							form="block"
						/>
					</div>
				{:else}
					<!-- Cold, the route takes 10 to 12 s: the line stands still, after 3 s it says so. -->
					{#each pending as n, i (n)}
						<h3 class="blok">{BLOCK[n]}</h3>
						{#if i === 0}<SlowLoad label="Ketens zoeken…" visible />{/if}
						<div class="leeg" aria-hidden="true"></div>
						<div class="leeg" aria-hidden="true"></div>
					{/each}
				{/if}
			{/if}
			{#if choice === 'alle' && steps > 1}
				<p class="stil nota">Twee en drie stappen gaan over een paar.</p>
			{/if}
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
	.blad-knop {
		display: none;
	}
	@media (max-width: 768px) {
		.blad-knop {
			display: flex;
			align-items: center;
			width: 100%;
			min-height: var(--veld-h-raak);
			padding: 0 var(--s-4);
			border: 0;
			border-bottom: 1px solid var(--rule);
			background: none;
			font-family: var(--font-serif);
			font-size: var(--t-ui-raak);
			font-weight: 600;
			color: var(--ink);
			text-align: left;
			cursor: pointer;
		}
	}
	.keuze {
		padding: var(--s-4) var(--s-4) 0;
	}
	/* Deel of the werkplek stands over the top right corner: the content starts below it. */
	@media (min-width: 769px) {
		.shared {
			padding-top: var(--s-7);
		}
	}
	.geen {
		display: block;
		width: 240px;
		max-width: calc(100% - var(--s-8));
		margin: var(--s-6) var(--s-5) 0;
	}
	.empty {
		margin: var(--s-3) var(--s-5) var(--s-8);
		font-size: var(--t-meta);
	}
	.blok {
		margin: var(--s-4) var(--s-4) var(--s-2);
		font-size: var(--t-label);
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-3);
	}
	.shared > :global(.stil[role='status']) {
		margin: 0 var(--s-4) var(--s-2);
		font-size: var(--t-meta);
	}
	.leeg {
		height: 56px;
		margin: 0 var(--s-4) var(--s-2);
		background: var(--paper-2);
	}
	.nota {
		margin: var(--s-4) var(--s-4) var(--s-8);
		font-size: var(--t-meta);
	}
	.failure {
		margin: var(--s-5);
	}
</style>
