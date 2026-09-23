<script lang="ts">
	// The table of contents of the law in Lezen: the name of the law, the title of the
	// current section under it, and the articles, the active one marked.
	import { api, unwrap } from '$lib/api/client';
	import type { Schema } from '$lib/api/types';
	import { instrumentMetaStore } from '$lib/api/instrument-cache';
	import type { GraphNode } from '$lib/graph/types';
	import { bronHref } from '$lib/bron/href';
	import { getLawIdFromProps } from '$lib/util/law-id';

	let {
		selection,
		onitems
	}: {
		selection: GraphNode | null;
		/** The articles of the law in order, each with the labels of its place (book, title). */
		onitems?: (items: { key: string; label: string; breadcrumb: string[] }[]) => void;
	} = $props();

	type Item = {
		articleNumber: string;
		key: string;
		breadcrumb: Schema<'InstrumentArticleBreadcrumbDTO'>[];
	};

	type Group = {
		label: string;
		title: string | null;
		type: string;
		items: Item[];
		children: Group[];
	};

	let items = $state<Item[]>([]);
	let groups = $state<Group[] | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);

	const currentBwb = $derived.by(() => {
		if (selection?.collection === 'articles')
			return getLawIdFromProps(selection.raw?.props ?? undefined, selection.key);
		if (selection?.collection === 'instruments')
			return getLawIdFromProps(selection.raw?.props ?? undefined) ?? selection.key.toUpperCase();
		return null;
	});

	// The name comes from the shared cache: citation title, else title, else the id.
	const lawName = $derived.by(() => {
		if (!currentBwb) return null;
		const meta = $instrumentMetaStore.get(currentBwb);
		return meta?.citationTitle ?? meta?.title ?? meta?.shortTitle ?? currentBwb;
	});

	// `label` is already the whole of what the law prints ("Eerste Boek", "Hoofdstuk 1"),
	// so it stands alone; `title` is the heading's own text and reads as a suffix.
	const crumbLabel = (seg: Schema<'InstrumentArticleBreadcrumbDTO'>) => {
		const label = seg.label?.trim() || (seg.type ? capitalise(seg.type) : '');
		return seg.title ? `${label} — ${seg.title}` : label;
	};
	const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
	const groupLabel = (g: Group) => {
		const label = g.label.trim() || (g.type && g.type !== 'sectie' ? capitalise(g.type) : '');
		return g.title ? `${label} — ${g.title}` : label;
	};

	// The Lezen table of contents is always the whole law, whatever the graph holds.
	$effect(() => {
		const bwb = currentBwb;
		if (!bwb) return;
		const ac = new AbortController();
		loading = true;
		error = null;
		unwrap(
			api.GET('/api/instruments/{bwb_id}/articles', {
				params: { path: { bwb_id: bwb }, query: { text_preview_chars: 0, limit: 2000 } },
				signal: ac.signal
			})
		)
			.then((resp) => {
				items = resp.items
					.filter((a) => !a.stub && a.article_number)
					.map((a) => ({
						articleNumber: a.article_number!,
						key: a.key,
						breadcrumb: a.breadcrumb ?? []
					}));
				groups = buildGroups(items);
				onitems?.(
					items.map((it) => ({
						key: it.key,
						label: `Artikel ${it.articleNumber}`,
						breadcrumb: it.breadcrumb.map(crumbLabel).filter(Boolean)
					}))
				);
			})
			.catch(() => {
				if (!ac.signal.aborted) error = 'Overzicht niet geladen.';
			})
			.finally(() => {
				if (!ac.signal.aborted) loading = false;
			});
		return () => ac.abort();
	});

	// A tree of groups from each article's breadcrumb; articles without one go into "Overig".
	function buildGroups(flat: Item[]): Group[] | null {
		const anyHasBc = flat.some((it) => it.breadcrumb.length > 0);
		if (!anyHasBc) return null;

		const root: Group = { label: '', title: null, type: 'root', items: [], children: [] };
		const findOrAdd = (parent: Group, type: string, label: string, title: string | null): Group => {
			let g = parent.children.find((c) => c.type === type && c.label === label);
			if (!g) {
				g = { label, title, type, items: [], children: [] };
				parent.children.push(g);
			}
			return g;
		};

		for (const it of flat) {
			const bc = it.breadcrumb;
			if (bc.length === 0) {
				findOrAdd(root, 'overig', 'Overig', null).items.push(it);
				continue;
			}
			let parent = root;
			for (const seg of bc) {
				parent = findOrAdd(parent, seg.type ?? 'sectie', seg.label ?? '', seg.title ?? null);
			}
			parent.items.push(it);
		}
		return root.children;
	}

	const selectedKey = $derived(selection?.key ?? null);
	const currentSection = $derived.by(() => {
		const it = items.find((i) => i.key === selectedKey);
		const last = it?.breadcrumb.at(-1);
		return last ? crumbLabel(last) : null;
	});

	let navEl = $state<HTMLElement | null>(null);

	$effect(() => {
		void selectedKey;
		if (!navEl) return;
		requestAnimationFrame(() => {
			const active = navEl?.querySelector('.row.is-active');
			active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		});
	});

	function containsSelected(g: Group): boolean {
		if (!selectedKey) return false;
		if (g.items.some((it) => it.key === selectedKey)) return true;
		return g.children.some(containsSelected);
	}
</script>

{#snippet itemRow(item: Item)}
	<li>
		<a
			class="row"
			class:is-active={item.key === selectedKey}
			href={bronHref({ collection: 'articles', key: item.key })}
			data-sveltekit-noscroll>Artikel {item.articleNumber}</a
		>
	</li>
{/snippet}

{#snippet groupBlock(g: Group, depth: number)}
	{@const selected = containsSelected(g)}
	{@const shouldOpen = selectedKey ? selected : depth > 0}
	{@const level = Math.min(depth, 3)}
	<details class="group depth-{level}" open={shouldOpen}>
		<summary class="group__head">
			<span class="chev" aria-hidden="true">▸</span>
			<span class="group__label">{groupLabel(g)}</span>
		</summary>
		{#if g.items.length > 0}
			<ol class="list">
				{#each g.items as item, i (i)}
					{@render itemRow(item)}
				{/each}
			</ol>
		{/if}
		{#if g.children.length > 0}
			<div class="children">
				{#each g.children as child, i (i)}
					{@render groupBlock(child, depth + 1)}
				{/each}
			</div>
		{/if}
	</details>
{/snippet}

<aside class="lezen-nav" aria-label="Overzicht" bind:this={navEl}>
	{#if currentBwb}
		<header class="head">
			<h3 class="head__title">{lawName}</h3>
			{#if currentSection}
				<div class="head__section">{currentSection}</div>
			{:else if items.length > 0}
				<div class="head__section">{items.length} artikelen</div>
			{/if}
		</header>

		{#if loading && items.length === 0}
			<p class="note">Laden</p>
		{:else if error}
			<p class="note">{error}</p>
		{:else if groups}
			<div class="tree">
				{#each groups as g, i (i)}
					{@render groupBlock(g, 0)}
				{/each}
			</div>
		{:else}
			<ol class="list">
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
		padding-top: 22px;
		border-right: 1px solid var(--rule);
		background: var(--paper);
		font-family: var(--font-sans);
		font-size: 12.5px;
	}

	.note {
		margin: 0;
		padding: var(--s-4) 18px;
		color: var(--ink-3);
	}

	.head {
		padding: 0 18px 12px;
	}

	.head__title {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 500;
		line-height: 1.2;
		color: var(--ink);
	}

	.head__section {
		margin-top: 3px;
		font-size: var(--t-micro);
		color: var(--ink-3);
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0 0 var(--s-3);
	}

	.tree {
		padding-bottom: var(--s-5);
	}

	.group {
		list-style: none;
	}
	.group > summary {
		list-style: none;
		cursor: pointer;
	}
	.group > summary::-webkit-details-marker {
		display: none;
	}

	.group__head {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		padding: 5px 18px;
		color: var(--ink-3);
	}
	.group__head:hover {
		background: var(--paper-2);
	}

	/* Depth carries the hierarchy: a boek reads as a heading, a paragraaf as a
	   quiet sub-label — indentation alone (10px/level) is too faint a signal
	   in a column this narrow. */
	.group.depth-0 + .group.depth-0 {
		margin-top: var(--s-3);
		border-top: 1px solid var(--rule);
		padding-top: var(--s-2);
	}
	.group.depth-0 > .group__head {
		font-family: var(--font-serif);
		font-size: 13.5px;
		font-weight: 600;
		color: var(--ink);
	}
	.group.depth-1 > .group__head {
		font-size: 13px;
		font-weight: 600;
		color: var(--ink-2);
	}
	.group.depth-2 > .group__head {
		font-size: 12px;
		font-weight: 500;
		color: var(--ink-3);
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}
	.group.depth-3 > .group__head {
		font-size: 12px;
		font-weight: 400;
		color: var(--ink-3);
		font-style: italic;
	}

	.chev {
		flex: 0 0 10px;
		font-size: 10px;
		line-height: 1.5;
		transition: transform 120ms ease;
		user-select: none;
	}
	details[open] > summary .chev {
		transform: rotate(90deg);
	}

	.group__label {
		line-height: 1.3;
	}

	.children {
		padding-left: 10px;
	}

	.row {
		display: block;
		padding: 4px 18px;
		color: var(--ink-2);
		line-height: 1.3;
		border-left: 2px solid transparent;
	}

	.row:hover {
		background: var(--paper-2);
		color: var(--ink);
	}

	.row.is-active {
		color: var(--ink);
		font-weight: 600;
		border-left-color: var(--ink);
		padding-left: 16px;
	}
</style>
