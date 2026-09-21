<script lang="ts">
	import { getInstrumentArticles } from '$lib/api/nodes';
	import { instrumentMetaStore } from '$lib/api/instrument-cache';
	import type { GraphNode } from '$lib/graph/types';
	import DossierNav from './readers/nav/DossierNav.svelte';
	import CommissieNav from './readers/nav/CommissieNav.svelte';
	import LidNav from './readers/nav/LidNav.svelte';
	import FractieNav from './readers/nav/FractieNav.svelte';

	let {
		selection,
		bwb: bwbProp = null,
		onNavigate,
		onitems
	}: {
		selection: GraphNode | null;
		/**
		 * Expliciete wet-id voor Lezen wanneer er geen artikel is geselecteerd
		 * (bijv. /explore?focus=instruments/BWBR…&mode=read). Overruled door
		 * de selection-afgeleide bwb zodra de gebruiker een artikel kiest.
		 */
		bwb?: string | null;
		onNavigate?: (collection: string, key: string) => void;
		onitems?: (items: { key: string; label: string }[]) => void;
	} = $props();

	type Item = {
		bwbId: string;
		articleNumber: string;
		label: string;
		key: string;
		// Mirror the openapi-generated breadcrumb shape: both fields optional
		// since the backend declares them `anyOf [string, null]` with no
		// "required". Avoids a Type-narrowing fight with the API response.
		breadcrumb?: { type?: string | null; label?: string | null }[] | null;
	};

	// Hierarchical group used for rendering when breadcrumbs are present.
	type Group = { label: string; type: string; items: Item[]; children: Group[] };

	let items = $state<Item[]>([]);
	let groups = $state<Group[] | null>(null);
	let loadedBwb = $state<string | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);

	const currentBwb = $derived.by(() => {
		if (selection) {
			const p = selection.raw?.props as Record<string, unknown> | undefined;
			if (selection.collection === 'instrument_articles') {
				const bwb = String(p?.['bwb_id'] ?? p?.['celex'] ?? '') || null;
				if (bwb) return bwb;
				const artNum = String(p?.['article_number'] ?? '') || null;
				if (artNum && selection.key.endsWith('_' + artNum)) {
					return selection.key.slice(0, -(artNum.length + 1)) || null;
				}
			}
			if (selection.collection === 'instruments') {
				const bwb = String(p?.['bwb_id'] ?? p?.['celex'] ?? '') || null;
				if (bwb) return bwb;
				if (selection.key.startsWith('bwb:')) return selection.key.slice(4) || null;
				if (selection.key.startsWith('celex:')) return selection.key.slice(6) || null;
				return selection.key || null;
			}
		}
		// Wet-focus zonder geselecteerd artikel: gebruik de fallback-prop.
		return bwbProp || null;
	});

	// Friendly name comes from the shared cache (filled by /api/instruments and
	// /api/articles bibtex sniffing). Strict precedence: full citation title >
	// title > short title > BWB id (last-ditch placeholder).
	const prettyLawName = $derived.by(() => {
		if (!currentBwb) return null;
		const meta = $instrumentMetaStore.get(currentBwb);
		return meta?.citationTitle ?? meta?.title ?? meta?.shortTitle ?? currentBwb;
	});

	// Instrument type label derived from the identifier pattern.
	const instrumentTypeLabel = $derived.by(() => {
		if (!currentBwb) return 'WETGEVING';
		if (currentBwb.toUpperCase().startsWith('BWBV')) return 'VERDRAG';
		if (/^[0-9]{5}[a-zA-Z]/.test(currentBwb) || (currentBwb.length === 9 && /^\d/.test(currentBwb)))
			return 'EU REGELGEVING';
		// CELEX numbers: 3 digits year + L/R/D indicator
		if (
			/^\d{4}[LRD]\d/.test(currentBwb) ||
			currentBwb.startsWith('32') ||
			currentBwb.startsWith('31')
		)
			return 'EU REGELGEVING';
		return 'WETGEVING';
	});

	// De Lezen-TOC is altijd de volledige wet, onafhankelijk van wat er
	// in de graph staat. De graph-store kan een subset aan articles bevatten
	// (Ontdekken/Verdiepen), maar in Lezen wil je *alle* artikelen kunnen
	// aanwijzen — anders blijft de TOC vermomd als grafiek-uitsnit. We
	// vertrouwen daarom de instrument-articles API als single source.
	$effect(() => {
		const bwb = currentBwb;
		if (!bwb || bwb === loadedBwb) return;
		loading = true;
		error = null;
		getInstrumentArticles(bwb, { textPreviewChars: 0, limit: 2000 })
			.then((resp) => {
				const flat: Item[] = resp.items
					.filter((a) => !a.stub && a.article_number)
					.map((a) => ({
						bwbId: a.bwb_id ?? bwb,
						articleNumber: a.article_number!,
						label: a.display_name ?? `Art. ${a.article_number}`,
						key: a.key,
						breadcrumb: a.breadcrumb ?? null
					}));
				items = flat;
				groups = buildGroups(flat);
				loadedBwb = bwb;
				onitems?.(flat);
			})
			.catch((err) => {
				console.warn('[lezen-nav] failed to load instrument', bwb, err);
				error = 'Kon overzicht niet laden';
			})
			.finally(() => {
				loading = false;
			});
	});

	// Build a tree of groups based on each article's breadcrumb. Articles that
	// have no breadcrumb at all collapse into a single trailing "Overig" group
	// so the nav still works during partial backend rollouts.
	function buildGroups(flat: Item[]): Group[] | null {
		const anyHasBc = flat.some((it) => (it.breadcrumb?.length ?? 0) > 0);
		if (!anyHasBc) return null;

		const root: Group = { label: '', type: 'root', items: [], children: [] };
		const findOrAdd = (parent: Group, type: string, label: string): Group => {
			let g = parent.children.find((c) => c.type === type && c.label === label);
			if (!g) {
				g = { label, type, items: [], children: [] };
				parent.children.push(g);
			}
			return g;
		};

		for (const it of flat) {
			const bc = it.breadcrumb ?? [];
			if (bc.length === 0) {
				findOrAdd(root, 'overig', 'Overig').items.push(it);
				continue;
			}
			let parent = root;
			for (const seg of bc) {
				parent = findOrAdd(parent, seg.type ?? 'sectie', seg.label ?? '');
			}
			parent.items.push(it);
		}
		return root.children;
	}

	const selectedKey = $derived(selection?.key ?? null);

	let navEl = $state<HTMLElement | null>(null);

	$effect(() => {
		void selectedKey;
		if (!navEl) return;
		// Defer one tick so the DOM has rendered the new active state.
		requestAnimationFrame(() => {
			const active = navEl?.querySelector('.nav-row.is-active');
			active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		});
	});

	// Recursive: does this group (or any descendant) contain the selected
	// article? Drives the default-open state of collapsed sections so the
	// user lands inside the right boek/titeldeel.
	function containsSelected(g: Group): boolean {
		if (!selectedKey) return false;
		if (g.items.some((it) => it.key === selectedKey)) return true;
		return g.children.some(containsSelected);
	}
</script>

{#snippet itemRow(item: Item)}
	{@const hasTitle = item.label && item.label !== `Art. ${item.articleNumber}`}
	<li>
		<button
			type="button"
			class="nav-row"
			class:is-active={item.key === selectedKey}
			onclick={() => onNavigate?.('instrument_articles', item.key)}
			title={item.label}
		>
			<span class="nav-num">Art. {item.articleNumber}</span>
			{#if hasTitle}
				<span class="nav-label">{item.label.replace(/^Art\.\s*\S+\s*/, '')}</span>
			{/if}
		</button>
	</li>
{/snippet}

{#snippet groupBlock(g: Group, depth: number)}
	{@const selected = containsSelected(g)}
	{@const shouldOpen = selectedKey ? selected : depth > 0}
	<details class="nav-group nav-group--depth-{Math.min(depth, 3)}" open={shouldOpen}>
		<summary class="nav-group-h">
			<span class="nav-chev" aria-hidden="true">▸</span>
			<span class="nav-group-h-text">
				<span class="nav-group-kind">{g.type}</span>
				<span class="nav-group-label">{g.label}</span>
			</span>
		</summary>
		{#if g.items.length > 0}
			<ol class="nav-list">
				{#each g.items as item, i (i)}
					{@render itemRow(item)}
				{/each}
			</ol>
		{/if}
		{#if g.children.length > 0}
			<div class="nav-children">
				{#each g.children as child, i (i)}
					{@render groupBlock(child, depth + 1)}
				{/each}
			</div>
		{/if}
	</details>
{/snippet}

<aside class="lezen-nav" aria-label="Overzicht" bind:this={navEl}>
	{#if selection?.kind === 'dossier'}
		<DossierNav node={selection} {onNavigate} />
	{:else if selection?.kind === 'commissie'}
		<CommissieNav node={selection} {onNavigate} />
	{:else if selection?.kind === 'lid'}
		<LidNav node={selection} {onNavigate} />
	{:else if selection?.kind === 'fractie'}
		<FractieNav node={selection} {onNavigate} />
	{:else if !currentBwb}
		<p class="nav-empty">Selecteer een artikel om het overzicht te zien.</p>
	{:else}
		<header class="nav-head">
			<span class="nav-kind">{instrumentTypeLabel}</span>
			<h3 class="nav-title">{prettyLawName}</h3>
			{#if items.length > 0}
				<span class="nav-count">{items.length} artikelen</span>
			{/if}
		</header>

		{#if loading && items.length === 0}
			<p class="nav-empty">Laden…</p>
		{:else if error}
			<p class="nav-error">{error}</p>
		{:else if groups}
			<div class="nav-tree">
				{#each groups as g, i (i)}
					{@render groupBlock(g, 0)}
				{/each}
			</div>
		{:else}
			<ol class="nav-list">
				{#each items as item, i (i)}
					{@render itemRow(item)}
				{/each}
			</ol>
		{/if}
	{/if}
</aside>

<style>
	.lezen-nav {
		height: 100%;
		overflow-y: auto;
		background: var(--paper-2);
		border-right: 1px solid var(--rule);
		display: flex;
		flex-direction: column;
	}

	.nav-empty,
	.nav-error {
		padding: var(--s-5);
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 13px;
		color: var(--fg-3);
		margin: 0;
	}

	.nav-error {
		color: var(--accent);
		font-style: normal;
	}

	.nav-head {
		padding: var(--s-5) var(--s-4) var(--s-3);
		border-bottom: 1px solid var(--rule);
	}

	.nav-kind {
		display: block;
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--fg-3);
		margin-bottom: 4px;
	}

	.nav-title {
		font-family: var(--font-serif);
		font-size: 17px;
		line-height: 1.25;
		font-weight: 500;
		color: var(--ink);
		margin: 0;
	}

	.nav-count {
		display: block;
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--fg-3);
		margin-top: 6px;
	}

	.nav-list {
		list-style: none;
		margin: 0;
		padding: var(--s-2) 0 var(--s-3);
	}

	.nav-tree {
		padding: var(--s-3) 0 var(--s-5);
	}

	.nav-group {
		padding-left: var(--s-3);
	}

	.nav-group--depth-0 {
		padding-left: 0;
		margin-top: var(--s-4);
	}

	.nav-group--depth-0:first-child {
		margin-top: var(--s-2);
	}

	/* Each section is a <details>; the <summary> is the clickable header. */
	.nav-group {
		list-style: none;
	}
	.nav-group > summary {
		list-style: none;
		cursor: pointer;
	}
	.nav-group > summary::-webkit-details-marker {
		display: none;
	}

	.nav-group-h {
		margin: 0;
		padding: 4px var(--s-4);
		display: flex;
		align-items: flex-start;
		gap: 6px;
		border-radius: var(--r-1);
	}
	.nav-group-h:hover {
		background: var(--paper-3);
	}

	.nav-chev {
		flex: 0 0 10px;
		color: var(--ink-4);
		font-size: 10px;
		line-height: 1.3;
		transition: transform 120ms ease;
		user-select: none;
		margin-top: 3px;
	}
	details[open] > summary .nav-chev {
		transform: rotate(90deg);
	}

	.nav-group-h-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.nav-group-kind {
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--fg-3);
	}

	.nav-group-label {
		font-family: var(--font-serif);
		font-size: 13px;
		font-weight: 500;
		color: var(--ink-2);
		line-height: 1.25;
	}

	.nav-group--depth-0 > .nav-group-h .nav-group-label {
		font-size: 14px;
		color: var(--ink);
	}

	.nav-children {
		border-left: 1px solid var(--rule);
		margin-left: var(--s-4);
	}

	.nav-row {
		width: 100%;
		text-align: left;
		background: none;
		border: 0;
		padding: 6px var(--s-4);
		cursor: pointer;
		display: flex;
		flex-direction: column;
		gap: 2px;
		border-left: 2px solid transparent;
		transition:
			background var(--dur-1) var(--ease),
			border-color var(--dur-1) var(--ease);
	}

	.nav-row:hover {
		background: var(--paper-3);
	}

	.nav-row.is-active {
		background: var(--paper-3);
		border-left-color: var(--accent);
	}

	.nav-num {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-2);
	}

	.nav-row.is-active .nav-num {
		color: var(--accent);
		font-weight: 500;
	}

	.nav-label {
		font-family: var(--font-serif);
		font-size: 11px;
		color: var(--ink-3);
		line-height: 1.3;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}
</style>
