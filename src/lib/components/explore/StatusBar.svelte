<script lang="ts">
	// The bar above the panels: a back arrow, the breadcrumb of the selected bron, Deel,
	// and Lezen/Netwerk as one segmented control. Bladeren is a place to go, not a view
	// of the selected bron, so it lives in the top nav only, not here.
	import type { GraphNode } from '$lib/graph/types';
	import { instrumentMetaStore } from '$lib/api/instrument-cache';
	import { bronLabel, bronPlural, isCollection, MODES, type Mode } from '$lib/vocabulary';
	import { formatDate, textProp } from './readers/_shared';

	const VIEW_MODES = MODES.filter((m) => m.id !== 'index');

	let {
		node,
		focusError = null,
		mode = 'graph',
		tableMode = false,
		indexCategory = null,
		indexResultCount = null,
		shareCopied = false,
		onGoBack,
		onModeChange,
		onShareView
	}: {
		node: GraphNode | null;
		focusError?: string | null;
		mode?: Mode;
		/** The verbindingen of the bron as a table. */
		tableMode?: boolean;
		indexCategory?: string | null;
		indexResultCount?: { filtered: number; total: number } | null;
		shareCopied?: boolean;
		onGoBack?: () => void;
		onModeChange?: (mode: Mode) => void;
		onShareView?: () => void;
	} = $props();

	const nodeProps = $derived(node?.raw?.props ?? {});

	// {Law} › Artikel N, {court} › date, or {kind} › name.
	const segments = $derived.by<string[]>(() => {
		if (!node) return [];
		const p = nodeProps;
		const segs: string[] = [];
		const add = (text: string | null | undefined) => text && segs.push(text);
		if (node.collection === 'articles') {
			const meta = $instrumentMetaStore.get(String(p.bwb_id));
			add(
				meta?.citationTitle ??
					meta?.title ??
					meta?.shortTitle ??
					textProp(p.instrument_citation_title)
			);
			add(textProp(p.article_number) && `Artikel ${p.article_number}`);
		} else if (node.collection === 'judgments') {
			add(textProp(p.court) ?? textProp(p.court_code));
			add(formatDate(textProp(p.date)));
		} else if (node.collection === 'dossiers') {
			add(bronLabel('dossiers'));
			add(textProp(p.label));
		} else if (node.collection === 'committees') {
			add(bronLabel('committees'));
			add(textProp(p.name) ?? textProp(p.abbreviation) ?? node.label);
		} else if (node.collection === 'members') {
			add(bronLabel('members'));
			add(textProp(p.name) ?? node.label);
		} else if (node.collection === 'factions') {
			add(bronLabel('factions'));
			add(textProp(p.abbreviation) ?? textProp(p.name) ?? node.label);
		} else {
			add(bronLabel(node.collection));
			add(node.label);
		}
		if (tableMode) segs.push('Verbindingen');
		return segs;
	});
</script>

<div class="status-bar">
	<button type="button" class="back" onclick={onGoBack} aria-label="Terug">←</button>

	{#if mode === 'index'}
		<div class="path">
			<span>Bladeren</span>
			{#if isCollection(indexCategory)}
				<span class="sep" aria-hidden="true">›</span>
				<span>{bronPlural(indexCategory)}</span>
			{/if}
		</div>
		{#if indexResultCount}
			<span class="count">
				{indexResultCount.filtered.toLocaleString('nl-NL')} van {indexResultCount.total.toLocaleString(
					'nl-NL'
				)}
			</span>
		{/if}
	{:else if node}
		<div class="path">
			{#each segments as seg, i (i)}
				{#if i > 0}<span class="sep" aria-hidden="true">›</span>{/if}
				<span class="seg" title={seg}>{seg}</span>
			{/each}
		</div>
	{:else if focusError}
		<div class="error">{focusError}</div>
	{/if}

	<span class="space"></span>

	{#if onShareView}
		<button type="button" class="btn is-text" onclick={onShareView}
			>{shareCopied ? 'Gekopieerd' : 'Deel'}</button
		>
	{/if}

	<div class="modes" role="tablist" aria-label="Weergave">
		{#each VIEW_MODES as m (m.id)}
			<button
				type="button"
				role="tab"
				aria-selected={mode === m.id}
				class="btn is-text mode"
				class:is-primary={mode === m.id}
				onclick={() => onModeChange?.(m.id)}>{m.label}</button
			>
		{/each}
	</div>
</div>

<style>
	.status-bar {
		height: 40px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 0 20px;
		border-bottom: 1px solid var(--rule);
		background: var(--paper);
		font-family: var(--font-sans);
		font-size: 12.5px;
		position: relative;
		z-index: var(--z-topbar);
	}

	.back {
		padding: 2px 4px;
		border: 0;
		background: none;
		font: inherit;
		font-size: 15px;
		line-height: 1;
		color: var(--ink-2);
		cursor: pointer;
	}
	.back:hover {
		color: var(--accent);
	}

	.path {
		display: flex;
		align-items: baseline;
		gap: 8px;
		min-width: 0;
		overflow: hidden;
		color: var(--ink-3);
	}
	.seg {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 40px;
	}
	.sep {
		flex-shrink: 0;
	}
	.count,
	.error {
		color: var(--ink-3);
		white-space: nowrap;
	}
	.space {
		flex: 1;
	}

	.modes {
		display: flex;
		gap: 2px;
		margin-left: 8px;
		padding: 2px;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
	}
	.mode {
		padding: 3px 10px;
	}
	.mode.is-primary {
		border-color: var(--ink);
	}
	.mode:not(.is-primary):hover {
		color: var(--ink);
		background: var(--paper-2);
	}
</style>
