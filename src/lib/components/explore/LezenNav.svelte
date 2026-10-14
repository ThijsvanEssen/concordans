<script lang="ts">
	import NavKolom from './NavKolom.svelte';
	// The table of contents of the law in Lezen: the name of the law, the title of the
	// current section under it, and the articles, the active one marked.
	import { lawArticles, type LawArticle } from '$lib/api/law-articles';
	import { parseAnchor } from '$lib/text/anchor';
	import { artikelAnker, deelIds, layersOf } from '$lib/text/division';
	import { scrollInReader } from '$lib/bron/anchor';
	import { page } from '$app/state';
	import { instrumentMetaStore, lawName } from '$lib/api/instrument-cache';
	import { lawIdOf, type GraphNode } from '$lib/graph/types';
	import { bronHref } from '$lib/bron/href';
	import Caret from '$lib/components/ui/Caret.svelte';

	let { selection }: { selection: GraphNode | null } = $props();

	/** An article with the anchor of each layer of its place in the whole law. */
	type Item = LawArticle & { ids: string[] };

	type Group = {
		/** Its anchor in the whole law: `deel-hoofdstuk-3`. */
		id: string;
		label: string;
		title: string | null;
		type: string;
		items: Item[];
		children: Group[];
	};

	let items = $state<LawArticle[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	const currentBwb = $derived.by(() => {
		if (selection?.collection === 'articles') return lawIdOf(selection.raw?.props);
		if (selection?.collection === 'instruments')
			return lawIdOf(selection.raw?.props) ?? selection.key.toUpperCase();
		return null;
	});

	const lawTitle = $derived.by(() => {
		if (!currentBwb) return null;
		return lawName($instrumentMetaStore.get(currentBwb), currentBwb);
	});

	const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
	const groupLabel = (g: Group) => {
		const label = g.label.trim() || (g.type && g.type !== 'sectie' ? capitalise(g.type) : '');
		return g.title ? `${label} ${g.title}` : label;
	};

	// The Lezen table of contents is always the whole law, whatever the graph holds; the
	// list is the one the place line above the article reads ($lib/api/law-articles).
	$effect(() => {
		const bwb = currentBwb;
		if (!bwb) return;
		let current = true;
		loading = true;
		error = null;
		lawArticles(bwb)
			.then((list) => {
				if (current) items = list;
			})
			.catch(() => {
				if (current) error = 'De inhoudsopgave kon niet worden geladen.';
			})
			.finally(() => {
				if (current) loading = false;
			});
		return () => {
			current = false;
		};
	});

	// A tree of groups from each article's breadcrumb; articles without one go into "Overig".
	function buildGroups(flat: Item[]): Group[] | null {
		const anyHasBc = flat.some((it) => it.breadcrumb.length > 0);
		if (!anyHasBc) return null;

		const root: Group = { id: '', label: '', title: null, type: 'root', items: [], children: [] };
		const findOrAdd = (
			parent: Group,
			type: string,
			label: string,
			title: string | null,
			id = ''
		): Group => {
			let g = parent.children.find((c) => c.type === type && c.label === label);
			if (!g) {
				g = { id, label, title, type, items: [], children: [] };
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
			bc.forEach((seg, i) => {
				parent = findOrAdd(
					parent,
					seg.type ?? 'sectie',
					seg.label ?? '',
					seg.title ?? null,
					it.ids[i]
				);
			});
			parent.items.push(it);
		}
		return root.children;
	}

	// A layer that is the law itself (Boek 6 of BW Boek 6) is no group and no place; the
	// name of the law may come after the articles, so this follows it.
	const shaped = $derived(
		items.map((it): Item => {
			const layers = layersOf(it.breadcrumb, lawTitle);
			const ids = deelIds(it.breadcrumb).slice(it.breadcrumb.length - layers.length);
			return { ...it, breadcrumb: layers, ids };
		})
	);
	const groups = $derived(shaped.length > 0 ? buildGroups(shaped) : null);

	const selectedKey = $derived(selection?.key ?? null);

	let navEl = $state<HTMLElement | null>(null);

	$effect(() => {
		void selectedKey;
		void anker;
		if (!navEl) return;
		requestAnimationFrame(() => {
			const active = navEl?.querySelector('.is-active, .is-hier');
			active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		});
	});

	// A division opens in the whole law at its heading: on the law itself only the anchor
	// changes (a peildatum stays); from an article the law opens there.
	const lawRef = $derived(
		currentBwb ? { collection: 'instruments' as const, key: currentBwb.toLowerCase() } : null
	);
	const onLaw = $derived(selection?.collection === 'instruments');
	const deelHref = (id: string) =>
		onLaw
			? `${page.url.pathname}${page.url.search}#${encodeURIComponent(id)}`
			: lawRef
				? bronHref(lawRef, { at: id })
				: null;
	// From an article the name of the law opens the whole law with that article in view.
	const selectedNumber = $derived(
		selection?.collection === 'articles'
			? (items.find((it) => it.key === selectedKey)?.articleNumber ?? null)
			: null
	);
	const lawHref = $derived(
		lawRef && selectedNumber ? bronHref(lawRef, { at: artikelAnker(selectedNumber) }) : null
	);

	/** The group opens with its link; the anchor already in the URL scrolls there again. */
	function openDeel(e: MouseEvent, id: string) {
		const link = e.currentTarget as HTMLElement;
		const group = link.closest('details');
		if (group) group.open = true;
		if (!onLaw || decodeURIComponent(page.url.hash.slice(1)) !== id) return;
		e.preventDefault();
		const heading = document.querySelector<HTMLElement>(`[data-deel="${CSS.escape(id)}"]`);
		if (heading) scrollInReader(heading);
	}

	// On the law itself, the place its anchor names (#deel-hoofdstuk-3, #artikel-658) is
	// marked and its groups open, as an article is from its own page.
	const anker = $derived(onLaw ? decodeURIComponent(page.url.hash.slice(1)) : '');
	const ankerArtikel = $derived.by(() => {
		const a = parseAnchor(anker);
		return a?.kind === 'article' ? a.number : null;
	});
	const isHier = (it: LawArticle) =>
		it.key === selectedKey || (ankerArtikel !== null && it.articleNumber === ankerArtikel);
	const inDeel = (g: Group) => !!g.id && (anker === g.id || anker.startsWith(`${g.id}-`));

	function containsSelected(g: Group): boolean {
		if (!selectedKey) return false;
		if (inDeel(g) || g.items.some(isHier)) return true;
		return g.children.some(containsSelected);
	}
</script>

{#snippet itemRow(item: LawArticle)}
	<li>
		<a
			class="nav-kolom__rij"
			class:is-active={isHier(item)}
			aria-current={item.key === selectedKey ? 'page' : isHier(item) ? 'location' : undefined}
			href={bronHref({ collection: 'articles', key: item.key })}
			data-sveltekit-noscroll>{item.label}</a
		>
	</li>
{/snippet}

{#snippet groupBlock(g: Group, depth: number)}
	{@const selected = containsSelected(g)}
	{@const shouldOpen = selectedKey ? selected : depth > 0}
	{@const level = Math.min(depth, 3)}
	{@const href = g.id ? deelHref(g.id) : null}
	<details class="group depth-{level}" open={shouldOpen}>
		<summary class="group__head">
			<Caret side />
			{#if href}
				<a
					class="group__label"
					class:is-hier={anker === g.id}
					aria-current={anker === g.id ? 'location' : undefined}
					{href}
					data-sveltekit-noscroll
					onclick={(e) => openDeel(e, g.id)}>{groupLabel(g)}</a
				>
			{:else}
				<span class="group__label">{groupLabel(g)}</span>
			{/if}
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

{#if currentBwb}
	<!-- Under the name the count for the law only: the place of an article is in the line
	     above its title. -->
	<NavKolom
		label="Overzicht"
		titel={lawTitle}
		titelHref={lawHref}
		onder={selection?.collection !== 'articles' && items.length > 0
			? `${items.length} artikelen`
			: null}
		bind:el={navEl}
	>
		{#if loading && items.length === 0}
			<p class="nav-kolom__note">Laden</p>
		{:else if error}
			<p class="nav-kolom__note">{error}</p>
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
	</NavKolom>
{/if}

<style>
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
		gap: var(--s-2);
		padding: var(--s-1) var(--s-4);
		color: var(--ink-3);
	}
	.group__head:hover {
		background: var(--paper);
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
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink);
	}
	.group.depth-1 > .group__head {
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink-2);
	}
	.group.depth-2 > .group__head {
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
	}
	.group.depth-3 > .group__head {
		font-size: var(--t-micro);
		font-weight: 400;
		color: var(--ink-3);
		font-style: italic;
	}

	/* The first line of the label is 1.3 high; the caret sits on its middle. */
	.group__head :global(.caret) {
		margin: calc((1.3em - 10px) / 2) 0 0;
	}
	/* A <details> keeps its own open state; the caret follows it. */
	details[open] > summary :global(.caret) {
		transform: rotate(0deg);
	}

	.group__label {
		line-height: 1.3;
		color: inherit;
		text-decoration: none;
	}
	/* The division the law is opened at (#deel-…), marked as the article chosen is. */
	.group__head:has(.is-hier) {
		background: var(--paper);
		color: var(--ink);
	}
	a.group__label:hover {
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}

	.children {
		padding-left: var(--s-3);
	}

	.is-active {
		background: var(--paper);
		color: var(--ink);
		font-weight: 600;
		border-left-color: var(--ink);
		padding-left: var(--s-4);
	}
</style>
