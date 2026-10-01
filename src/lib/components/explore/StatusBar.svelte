<script lang="ts">
	// The bar above the panels: a back arrow, the breadcrumb of the selected bron, Deel,
	// and, for a bron with a text of its own, Volledig lezen or back to the network.
	// Bladeren is a place to go, not a view of the selected bron, so it lives in the top
	// nav only, not here.
	import type { GraphNode } from '$lib/graph/types';
	import { ensureInstrumentName, instrumentMetaStore } from '$lib/api/instrument-cache';
	import { bronLabel, type Mode } from '$lib/vocabulary';
	import { lawKind } from './law-head';
	import { formatDate, textProp } from './readers/_shared';
	import { bronHref, indexHref } from '$lib/bron/href';
	import { articleName } from '$lib/text/bw';
	import { categoryLabel, isIndexCategory } from './index/categories';
	import WeergaveSchakelaar from './WeergaveSchakelaar.svelte';
	import WeergaveKaarten from './WeergaveKaarten.svelte';

	let {
		node,
		focusError = null,
		mode = 'graph',
		tableMode = false,
		indexCategory = null,
		indexResultCount = null,
		shareLabel = 'Deel',
		shareAnnouncement = '',
		onGoBack,
		onShareView,
		readAction = null,
		onRead
	}: {
		node: GraphNode | null;
		focusError?: string | null;
		mode?: Mode;
		/** The verbindingen of the bron as a table. */
		tableMode?: boolean;
		indexCategory?: string | null;
		indexResultCount?: { filtered: number; total: number } | null;
		/** The share button's label: Deel, or what the last copy did. */
		shareLabel?: string;
		shareAnnouncement?: string;
		onGoBack?: () => void;
		onShareView?: () => void;
		/** `read` offers Volledig lezen, `network` the way back; null shows neither. */
		readAction?: 'read' | 'network' | null;
		onRead?: (on: boolean) => void;
	} = $props();

	const nodeProps = $derived(node?.raw?.props ?? {});

	// {Law} › Artikel N, {court} › date, or {kind} › name.
	// A segment that names a place (the law of an article, the kind of a bron) links there.
	type Segment = { text: string; href?: string };
	// A law outside the names primed at start is asked for by its own route.
	$effect(() => {
		if (node?.collection === 'articles') ensureInstrumentName(textProp(nodeProps.bwb_id));
	});

	const segments = $derived.by<Segment[]>(() => {
		if (!node) return [];
		const p = nodeProps;
		const segs: Segment[] = [];
		const add = (text: string | null | undefined, href?: string) => {
			if (text) segs.push({ text, href });
		};
		const kindHref = (collection: string) => indexHref(collection);
		if (node.collection === 'articles') {
			const meta = $instrumentMetaStore.get(String(p.bwb_id));
			const bwb = textProp(p.bwb_id);
			add(
				meta?.citationTitle ??
					meta?.title ??
					meta?.shortTitle ??
					textProp(p.instrument_citation_title),
				bwb ? bronHref({ collection: 'instruments', key: bwb.toLowerCase() }) : undefined
			);
			add(articleName(bwb, textProp(p.article_number), textProp(p.label)) ?? undefined);
		} else if (node.collection === 'judgments') {
			add(textProp(p.court) ?? textProp(p.court_code));
			add(formatDate(textProp(p.date)));
		} else if (node.collection === 'dossiers') {
			add(bronLabel('dossiers'), kindHref('dossiers'));
			add(textProp(p.label));
		} else if (node.collection === 'committees') {
			add(bronLabel('committees'), kindHref('committees'));
			add(textProp(p.name) ?? textProp(p.abbreviation) ?? node.label);
		} else if (node.collection === 'members') {
			add(bronLabel('members'), kindHref('members'));
			add(textProp(p.name) ?? node.label);
		} else if (node.collection === 'factions') {
			add(bronLabel('factions'), kindHref('factions'));
			add(textProp(p.abbreviation) ?? textProp(p.name) ?? node.label);
		} else if (node.collection === 'instruments') {
			// Its own kind, as the head of the law says it: Wet, Verordening, Richtlijn.
			add(lawKind(p as Parameters<typeof lawKind>[0]));
			add(node.label);
		} else {
			add(bronLabel(node.collection));
			add(node.label);
		}
		if (tableMode) segs.push({ text: 'Verbindingen' });
		return segs;
	});
</script>

<div class="status-bar">
	<button type="button" class="back" onclick={onGoBack} aria-label="Terug">←</button>

	{#if mode === 'index'}
		<div class="path">
			<span>Bladeren</span>
			{#if isIndexCategory(indexCategory)}
				<span class="sep" aria-hidden="true">›</span>
				<span>{categoryLabel(indexCategory)}</span>
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
				{#if seg.href && i < segments.length - 1}
					<a class="seg seg--link" href={seg.href} title={seg.text} data-sveltekit-noscroll
						>{seg.text}</a
					>
				{:else}
					<span class="seg" title={seg.text}>{seg.text}</span>
				{/if}
			{/each}
		</div>
	{:else if focusError}
		<div class="error">{focusError}</div>
	{/if}

	<span class="space"></span>

	{#if onShareView}
		<button type="button" class="btn is-text" onclick={onShareView}>{shareLabel}</button>
		<span class="sr-only" aria-live="polite">{shareAnnouncement}</span>
	{/if}

	{#if readAction}
		<span class="weergave">
			<WeergaveSchakelaar
				stand={readAction === 'read' ? 'netwerk' : 'tekst'}
				onKies={(k) => onRead?.(k === 'tekst')}
			/>
			<WeergaveKaarten
				stand={readAction === 'read' ? 'netwerk' : 'tekst'}
				onKies={(k) => onRead?.(k === 'tekst')}
			/>
		</span>
	{:else if node && mode !== 'index'}
		<WeergaveSchakelaar stand="netwerk" onKies={() => {}} tekstMogelijk={false} />
	{/if}
</div>

<style>
	.status-bar {
		height: 40px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: var(--s-3);
		padding: 0 20px;
		border-bottom: 1px solid var(--rule);
		background: var(--paper);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		position: relative;
		z-index: var(--z-topbar);
	}

	.back {
		padding: 2px var(--s-1);
		border: 0;
		background: none;
		font: inherit;
		font-size: var(--t-body-2);
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
		gap: var(--s-2);
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
	.seg--link {
		color: inherit;
		text-decoration: none;
	}
	.seg--link:hover {
		color: var(--ink);
		text-decoration: underline;
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
	.weergave {
		position: relative;
	}
</style>
