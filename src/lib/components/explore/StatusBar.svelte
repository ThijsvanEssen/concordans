<script lang="ts">
	import type { GraphNode } from '$lib/graph/types';
	import { instrumentMetaStore } from '$lib/api/instrument-cache';
	import { bronLabel, bronPlural, isCollection, MODES, type Mode } from '$lib/vocabulary';
	import { formatDate, textProp } from './readers/_shared';

	let {
		node,
		focusError = null,
		mode = 'graph',
		indexCategory = null,
		indexResultCount = null,
		shareCopied = false,
		onGoBack,
		onGoForward,
		onModeChange,
		onShareView
	}: {
		node: GraphNode | null;
		focusError?: string | null;
		mode?: Mode;
		/** When mode === 'index', the active category (instruments, dossiers, ...). */
		indexCategory?: string | null;
		/** When mode === 'index', the filtered count / total, e.g. "100 van 448". */
		indexResultCount?: { filtered: number; total: number } | null;
		shareCopied?: boolean;
		onGoBack?: () => void;
		onGoForward?: () => void;
		onModeChange?: (mode: Mode) => void;
		onShareView?: () => void;
	} = $props();

	let overflowOpen = $state(false);
	function handleWindowClick(e: MouseEvent) {
		if (!overflowOpen) return;
		const target = e.target as Node | null;
		const root = (document.querySelector('.status-overflow') as HTMLElement | null) ?? null;
		if (root && target && !root.contains(target)) overflowOpen = false;
	}
	function handleWindowKey(e: KeyboardEvent) {
		if (overflowOpen && e.key === 'Escape') overflowOpen = false;
	}

	const nodeProps = $derived(node?.raw?.props ?? {});

	// {Law} > Art. N, {court} > date, or {kind} > name.
	const breadcrumbSegs = $derived.by<{ kind: 'meta' | 'art'; text: string }[]>(() => {
		if (!node) return [];
		const p = nodeProps;
		const segs: { kind: 'meta' | 'art'; text: string }[] = [];
		const add = (kind: 'meta' | 'art', text: string | null) => text && segs.push({ kind, text });

		if (node.collection === 'articles') {
			const meta = $instrumentMetaStore.get(String(p.bwb_id));
			add(
				'meta',
				meta?.citationTitle ??
					meta?.title ??
					meta?.shortTitle ??
					textProp(p.instrument_citation_title)
			);
			add('art', textProp(p.article_number) && `Art. ${p.article_number}`);
		} else if (node.collection === 'judgments') {
			add('meta', textProp(p.court) ?? textProp(p.court_code));
			add('art', formatDate(textProp(p.date)));
		} else if (node.collection === 'dossiers') {
			add('meta', bronLabel('dossiers'));
			add('art', String(p.number ?? node.key));
		} else if (node.collection === 'committees') {
			add('meta', bronLabel('committees'));
			add('art', textProp(p.name) ?? textProp(p.abbreviation) ?? node.label);
		} else if (node.collection === 'members') {
			const party = textProp(p.party);
			add('meta', party ? `${bronLabel('members')} · ${party}` : bronLabel('members'));
			add('art', textProp(p.name) ?? node.label);
		} else if (node.collection === 'factions') {
			add('meta', bronLabel('factions'));
			add('art', textProp(p.abbreviation) ?? textProp(p.name) ?? node.label);
		}
		return segs;
	});

	// Title only when it adds something the breadcrumb path doesn't already say.
	const title = $derived.by(() => {
		const t = node?.label ?? null;
		if (!t) return null;
		const lastSeg = breadcrumbSegs.at(-1)?.text ?? '';
		if (lastSeg === t || lastSeg.endsWith(t)) return null;
		return t;
	});

	const validFrom = $derived(formatDate(textProp(nodeProps.valid_from)));

	let citeCopied = $state(false);
	async function copyCitation() {
		const segs = breadcrumbSegs.map((s) => s.text);
		let text = segs.join(' › ');
		if (node?.collection === 'judgments') {
			text = `${segs.join(', ')} (${textProp(nodeProps.ecli) ?? node.key})`;
		} else if (node?.collection === 'articles' && segs.length === 2) {
			text = `${segs[1]} ${segs[0]}`;
		}
		try {
			await navigator.clipboard.writeText(text);
			citeCopied = true;
			setTimeout(() => {
				citeCopied = false;
			}, 1600);
		} catch {
			// The clipboard is unavailable in some contexts.
		}
	}
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKey} />

<div class="status-bar" class:has-node={!!node}>
	<div class="status-history">
		<button type="button" class="status-hist-btn" onclick={onGoBack} aria-label="Vorige bron">
			<svg
				width="12"
				height="12"
				viewBox="0 0 12 12"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M7.5 2L3.5 6l4 4" />
			</svg>
		</button>
		<button type="button" class="status-hist-btn" onclick={onGoForward} aria-label="Volgende bron">
			<svg
				width="12"
				height="12"
				viewBox="0 0 12 12"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M4.5 2l4 4-4 4" />
			</svg>
		</button>
	</div>

	{#if mode === 'index'}
		<div class="status-path">
			<span class="status-meta">Bladeren</span>
			{#if isCollection(indexCategory)}
				<span class="status-sep" aria-hidden="true">›</span>
				<span class="status-art">{bronPlural(indexCategory)}</span>
			{/if}
		</div>
		{#if indexResultCount}
			<div class="status-right">
				<span class="status-count">
					{indexResultCount.filtered.toLocaleString('nl-NL')}
					<span class="status-count-of">van {indexResultCount.total.toLocaleString('nl-NL')}</span>
				</span>
			</div>
		{/if}
	{:else if node}
		<div class="status-path">
			{#each breadcrumbSegs as seg, i (i)}
				{#if i > 0}
					<span class="status-sep" aria-hidden="true">›</span>
				{/if}
				<span class="status-{seg.kind}" title={seg.text}>{seg.text}</span>
			{/each}
			{#if title}
				<span class="status-sep" aria-hidden="true">·</span>
				<span class="status-title" {title}>{title}</span>
			{/if}
		</div>

		<div class="status-right">
			{#if validFrom}
				<span class="status-valid">
					<span class="status-valid-bar" aria-hidden="true"></span>
					Geldig {validFrom}
				</span>
			{:else}
				<span class="status-kind">{bronLabel(node.collection)}</span>
			{/if}
		</div>
	{:else if focusError}
		<div class="status-error">
			<span class="status-error-icon" aria-hidden="true">⚠</span>
			{focusError}
		</div>
	{/if}

	<!-- Share is always visible; the citation is in the overflow menu. -->
	{#if onShareView}
		<button type="button" class="status-share-btn" onclick={onShareView}
			>{shareCopied ? '✓ Link gekopieerd' : '↗ Deel'}</button
		>
	{/if}
	{#if node}
		<div class="status-overflow" class:is-open={overflowOpen}>
			<button
				type="button"
				class="status-overflow-btn"
				aria-haspopup="menu"
				aria-expanded={overflowOpen}
				aria-label="Meer acties"
				onclick={() => (overflowOpen = !overflowOpen)}>⋯</button
			>
			{#if overflowOpen}
				<div class="status-overflow-menu" role="menu">
					<button
						type="button"
						role="menuitem"
						class="status-overflow-item"
						onclick={() => {
							copyCitation();
							overflowOpen = false;
						}}>{citeCopied ? '✓ Gekopieerd' : 'Kopieer citatie'}</button
					>
				</div>
			{/if}
		</div>
	{/if}

	<div class="mode-toggle" role="tablist" aria-label="Weergave">
		{#each MODES as m, i (m.id)}
			<button
				role="tab"
				aria-selected={mode === m.id}
				class="mode-btn"
				class:active={mode === m.id}
				onclick={() => onModeChange?.(m.id)}>{m.label}<kbd class="mode-kbd">{i + 1}</kbd></button
			>
		{/each}
	</div>
</div>

<style>
	.status-bar {
		height: 36px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 var(--s-4) 0 var(--s-3);
		background: var(--paper-2);
		border-bottom: 1px solid var(--rule);
		/* No overflow:hidden — that would clip the … overflow menu behind
       the canvas. Inner spans handle their own ellipsis. */
		gap: var(--s-2);
		position: relative;
		z-index: var(--z-topbar, 100);
	}

	.status-history {
		display: flex;
		gap: 0;
		flex-shrink: 0;
	}

	.status-hist-btn {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		color: var(--ink-3);
		cursor: pointer;
		padding: 0;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease),
			border-color var(--dur-1) var(--ease);
	}

	.status-hist-btn:hover {
		background: var(--paper-3);
		color: var(--ink);
		border-color: var(--ink-3);
	}

	.status-share-btn {
		flex-shrink: 0;
		font-family: var(--font-sans);
		font-size: 11px;
		padding: 3px 9px;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		color: var(--ink-2);
		cursor: pointer;
		white-space: nowrap;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
	}
	.status-share-btn:hover {
		background: var(--ink);
		color: var(--paper);
		border-color: var(--ink);
	}

	.status-path {
		display: flex;
		align-items: baseline;
		gap: 8px;
		overflow: hidden;
		min-width: 0;
		flex: 1;
	}

	.status-meta {
		font-family: var(--font-serif);
		font-size: 13px;
		color: var(--ink-3);
		white-space: nowrap;
		flex-shrink: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 40px;
	}

	.status-art {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink);
		font-weight: 500;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.status-sep {
		color: var(--ink-4);
		font-size: 12px;
		flex-shrink: 0;
	}

	.status-title {
		font-family: var(--font-serif);
		font-size: 14px;
		color: var(--ink-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 48px;
	}

	.status-right {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: var(--s-3);
	}

	/* Index-modus: gefilterde/totaal in de subbar. */
	.status-count {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-2);
	}
	.status-count-of {
		color: var(--fg-4);
	}

	.status-valid {
		display: flex;
		align-items: center;
		gap: 5px;
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--positive);
		white-space: nowrap;
	}

	.status-valid-bar {
		width: 3px;
		height: 12px;
		border-radius: 2px;
		background: var(--positive);
		flex-shrink: 0;
	}

	.status-kind {
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--ink-4);
		white-space: nowrap;
	}

	.status-overflow {
		position: relative;
		margin-left: auto;
		flex-shrink: 0;
	}
	.status-overflow-btn {
		width: 24px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		color: var(--ink-3);
		font-size: 14px;
		line-height: 1;
		cursor: pointer;
		padding: 0;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
	}
	.status-overflow.is-open .status-overflow-btn,
	.status-overflow-btn:hover {
		background: var(--ink);
		color: var(--paper);
		border-color: var(--ink);
	}

	.status-overflow-menu {
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		z-index: 1000;
		min-width: 140px;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		box-shadow: 0 4px 16px rgba(20, 18, 14, 0.08);
		display: flex;
		flex-direction: column;
		padding: 4px;
		gap: 2px;
	}
	.status-overflow-item {
		text-align: left;
		padding: 5px 10px;
		background: none;
		border: none;
		border-radius: var(--r-1);
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--ink-2);
		cursor: pointer;
		white-space: nowrap;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
	}
	.status-overflow-item:hover {
		background: var(--ink);
		color: var(--paper);
	}

	.status-empty-hint {
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--ink-4);
		font-style: italic;
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.mode-toggle {
		display: flex;
		gap: 0;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		overflow: hidden;
		flex-shrink: 0;
		margin-left: var(--s-3);
		border-left-width: 1px;
	}

	.mode-btn {
		font-family: var(--font-sans);
		font-size: 11px;
		padding: 3px 8px;
		background: var(--paper);
		color: var(--ink-3);
		border: none;
		border-right: 1px solid var(--rule-strong);
		cursor: pointer;
		line-height: 1.4;
	}

	.mode-btn:last-child {
		border-right: none;
	}

	.mode-btn.active {
		background: var(--ink);
		color: var(--paper);
		font-weight: 500;
	}

	.mode-btn:hover:not(.active):not(:disabled) {
		background: var(--paper-2);
		color: var(--ink);
	}
	.mode-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.mode-kbd {
		font-family: var(--font-mono);
		font-size: 9px;
		margin-left: 6px;
		padding: 1px 4px;
		border-radius: 2px;
		background: color-mix(in srgb, currentColor 12%, transparent);
		color: inherit;
		opacity: 0.7;
	}
	.mode-btn.active .mode-kbd {
		opacity: 0.85;
	}

	.status-error {
		display: flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--accent);
	}

	.status-error-icon {
		font-size: 13px;
		flex-shrink: 0;
	}
</style>
