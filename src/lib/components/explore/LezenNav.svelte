<script lang="ts">
	import { capitalize } from '$lib/text/words';
	import NavKolom from './NavKolom.svelte';
	// The table of contents of the law in Lezen: the name of the law, the title of the
	// current section under it, and the articles, the active one marked; after them its
	// bijlagen with a text of their own; on a bijlage the same, the bijlage marked.
	import { lawAnnexes, lawArticles, type LawAnnex, type LawArticle } from '$lib/bron/law-articles';
	import { parseAnchor } from '$lib/text/anchor';
	import { artikelAnker, layersOf } from '$lib/text/division';
	import { scrollInReader } from '$lib/bron/landing';
	import { page } from '$app/state';
	import { getInstrumentDetail, instrumentMetaStore, lawName } from '$lib/api/instrument-cache';
	import { lawCitationRecord } from './law-head';
	import { instrumentLawId, lawIdOf, type GraphNode } from '$lib/graph/types';
	import { bronHref } from '$lib/bron/href';
	import Caret from '$lib/components/ui/Caret.svelte';
	import { lawPosition } from './law-position.svelte';
	import { lawNodeKey } from '$lib/text/enacted-law';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { load } from '$lib/util/load.svelte';
	import { reportContents } from './contents-state.svelte';

	let { selection }: { selection: GraphNode | null } = $props();

	/** A law of the BWB (a wet, a verdrag): its names come with its articles. */
	const BWB_ID = /^BWB[RV]\d+$/;

	/** An article with the anchor of each layer of its place in the whole law. */
	type Item = LawArticle;

	type Group = {
		/** Its anchor in the whole law: `deel-hoofdstuk-3`. */
		id: string;
		label: string;
		title: string | null;
		type: string;
		items: Item[];
		children: Group[];
	};

	const currentBwb = $derived.by(() => {
		if (selection?.collection === 'articles' || selection?.collection === 'annexes')
			return lawIdOf(selection.raw?.props);
		if (selection?.collection === 'instruments')
			return instrumentLawId(selection.raw?.props, selection.key);
		return null;
	});

	const lawTitle = $derived.by(() => {
		if (!currentBwb) return null;
		return lawName($instrumentMetaStore.get(currentBwb), currentBwb);
	});

	// The name over the contents is the heading of the law's own page (the citation record, E6),
	// never its id. A law of the BWB has its name from the answers that came before; an act of the
	// EU or a publication is asked (once, as its head asks it), and the column waits without a name.
	const asked = $derived(currentBwb && !BWB_ID.test(currentBwb) ? currentBwb : null);
	const lawDetail = load(
		() => asked,
		(id) => (id ? getInstrumentDetail(id) : Promise.resolve(null)),
		'Wet, gegevens'
	);
	const navTitle = $derived.by(() => {
		if (!currentBwb) return null;
		// An act of the EU or a publication is kept under its node key, lower case.
		const meta =
			$instrumentMetaStore.get(currentBwb) ?? $instrumentMetaStore.get(currentBwb.toLowerCase());
		if (!asked) return lawName(meta, null);
		return lawDetail.state.status === 'ready'
			? lawCitationRecord(currentBwb, lawDetail.state.data, meta).heading
			: null;
	});

	const groupLabel = (g: Group) => {
		const label = g.label.trim() || (g.type && g.type !== 'sectie' ? capitalize(g.type) : '');
		return g.title ? `${label} ${g.title}` : label;
	};

	// The Lezen table of contents is always the whole law, whatever the graph holds; the
	// list is the one the place line above the article reads ($lib/api/law-articles).
	const articleList = load(
		() => currentBwb,
		async (bwb): Promise<{ articles: LawArticle[]; annexes: LawAnnex[] }> =>
			bwb
				? { articles: await lawArticles(bwb), annexes: await lawAnnexes(bwb) }
				: { articles: [], annexes: [] },
		'Inhoudsopgave'
	);
	const ready = $derived(articleList.state.status === 'ready' ? articleList.state.data : null);
	const items = $derived(ready?.articles ?? []);
	const annexes = $derived(ready?.annexes ?? []);
	$effect(() => {
		if (selection && currentBwb && ready)
			reportContents(selection.id, items.length + annexes.length);
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
			bc.forEach((seg) => {
				parent = findOrAdd(
					parent,
					seg.type ?? 'sectie',
					seg.label ?? '',
					seg.title ?? null,
					seg.anchor
				);
			});
			parent.items.push(it);
		}
		return root.children;
	}

	// A layer that is the law itself (Boek 6 of BW Boek 6) is no group and no place; the
	// name of the law may come after the articles, so this follows it.
	const shaped = $derived(
		items.map((it): Item => ({ ...it, breadcrumb: layersOf(it.breadcrumb, lawTitle) }))
	);
	const groups = $derived(shaped.length > 0 ? buildGroups(shaped) : null);

	const selectedKey = $derived(selection?.key ?? null);

	let navEl = $state<HTMLElement | null>(null);

	// The place marked stays in view in the column: scrolled within it, not the page.
	$effect(() => {
		void selectedKey;
		void ready;
		void anker;
		void hereNumber;
		if (!navEl) return;
		requestAnimationFrame(() => {
			const nav = navEl;
			const active = nav?.querySelector<HTMLElement>('.is-active, .is-hier');
			if (!nav || !active) return;
			const box = nav.getBoundingClientRect();
			const at = active.getBoundingClientRect();
			if (at.top < box.top + box.height / 4 || at.bottom > box.bottom - box.height / 4)
				nav.scrollTop += at.top - box.top - box.height / 3;
		});
	});

	// A division opens in the whole law at its heading: on the law itself only the anchor
	// changes (a peildatum stays); from an article the law opens there.
	const lawRef = $derived(
		currentBwb ? { collection: 'instruments' as const, key: lawNodeKey(currentBwb) } : null
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
	// From a bijlage it opens the whole law.
	const lawHref = $derived(
		lawRef && selectedNumber
			? bronHref(lawRef, { at: artikelAnker(selectedNumber) })
			: lawRef && selection?.collection === 'annexes'
				? bronHref(lawRef)
				: null
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
	// On the law the article at the top of the text (K3), else the one its anchor names.
	const hereNumber = $derived(onLaw ? (lawPosition.of(currentBwb) ?? ankerArtikel) : null);
	const isHier = (it: LawArticle) =>
		it.key === selectedKey || (hereNumber !== null && it.articleNumber === hereNumber);

	// On the law an article opens in place, in the whole law (K3); from an article, its own.
	const articleHref = (it: LawArticle) =>
		onLaw
			? `${page.url.pathname}${page.url.search}#${encodeURIComponent(artikelAnker(it.articleNumber))}`
			: bronHref({ collection: 'articles', key: it.key });
	/** The anchor already in the URL: the article is scrolled to again. */
	function openArticle(e: MouseEvent, it: LawArticle) {
		const id = artikelAnker(it.articleNumber);
		if (!onLaw || decodeURIComponent(page.url.hash.slice(1)) !== id) return;
		e.preventDefault();
		const el = document.querySelector<HTMLElement>(
			`[data-artikel="${CSS.escape(it.articleNumber)}"]`
		);
		if (el) scrollInReader(el);
	}
	const inDeel = (g: Group) => !!g.id && (anker === g.id || anker.startsWith(`${g.id}-`));

	function containsSelected(g: Group): boolean {
		if (!selectedKey) return false;
		if (inDeel(g) || g.items.some(isHier)) return true;
		return g.children.some(containsSelected);
	}

	/** Space and the arrows on a division's link open and close it; Enter goes to it, and opens it. */
	function groupKey(e: KeyboardEvent) {
		const d = (e.currentTarget as HTMLElement).closest('details');
		if (!d || e.altKey || e.ctrlKey || e.metaKey) return;
		if (e.key === 'Enter') d.open = true;
		if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
			e.preventDefault();
			d.open = e.key === ' ' ? !d.open : e.key === 'ArrowRight';
		}
	}
</script>

{#snippet itemRow(item: LawArticle)}
	<li>
		<a
			class="nav-kolom__rij"
			class:is-active={isHier(item)}
			aria-current={item.key === selectedKey ? 'page' : isHier(item) ? 'location' : undefined}
			href={articleHref(item)}
			data-sveltekit-noscroll
			onclick={(e) => openArticle(e, item)}>{item.label}</a
		>
	</li>
{/snippet}

{#snippet groupBlock(g: Group, depth: number)}
	{@const selected = containsSelected(g)}
	{@const shouldOpen = selectedKey ? selected : depth > 0}
	{@const level = Math.min(depth, 3)}
	{@const href = g.id ? deelHref(g.id) : null}
	<details
		class="group depth-{level}"
		open={shouldOpen}
		ontoggle={(e) =>
			e.currentTarget
				.querySelector(':scope > summary > a.group__label')
				?.setAttribute('aria-expanded', String(e.currentTarget.open))}
	>
		<!-- The division's link is the one tab stop, and it says whether the division is open: Enter
		     goes to the division, Space and the arrows (right opens, left closes) open and close it;
		     the summary only answers a click on the caret. -->
		<summary class="group__head nav-kolom__n{level + 1}" tabindex={href ? -1 : undefined}>
			<Caret side />
			{#if href}
				<a
					class="group__label"
					class:is-hier={anker === g.id}
					aria-current={anker === g.id ? 'location' : undefined}
					aria-expanded={shouldOpen}
					{href}
					data-sveltekit-noscroll
					onkeydown={groupKey}
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
	<!-- The name of the law only where it leads to the whole law (from an article or a
	     bijlage): the place of an article is in the line above its title. -->
	<NavKolom title={navTitle} titleHref={lawHref} bind:el={navEl}>
		{#if articleList.state.status !== 'ready'}
			<LoadState state={articleList.state} what="De inhoudsopgave" retry={articleList.retry} />
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
		{#if articleList.state.status === 'ready' && annexes.length > 0}
			<ol class="list annexes" aria-label="Bijlagen">
				{#each annexes as annex (annex.key)}
					<li>
						<a
							class="nav-kolom__rij"
							class:is-active={annex.key === selectedKey}
							aria-current={annex.key === selectedKey ? 'page' : undefined}
							href={bronHref({ collection: 'annexes', key: annex.key })}
							>{annex.title ? `${annex.name} ${annex.title}` : annex.name}</a
						>
					</li>
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
	/* The bijlagen after the articles, set off as one part is from the next. */
	.annexes {
		margin-top: var(--s-3);
		border-top: 1px solid var(--rule);
		padding-top: var(--s-2);
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
	}
	.group__head:hover {
		background: var(--paper-2);
	}
	/* A finger's target: a heading at least 32 px high, as the rows are (NavKolom). */
	@media (pointer: coarse), (max-width: 768px) {
		.group__head {
			align-items: center;
			min-height: var(--veld-h-raak);
			padding-block: 0;
		}
		.group__head > a.group__label {
			align-self: stretch;
			display: flex;
			align-items: center;
		}
	}

	/* Depth carries the hierarchy in the type of each level (NavKolom: nav-kolom__n1 to 4). */
	.group.depth-0 + .group.depth-0 {
		margin-top: var(--s-3);
		border-top: 1px solid var(--rule);
		padding-top: var(--s-2);
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
		background: var(--paper-2);
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
		background: var(--paper-2);
		color: var(--ink);
		font-weight: 600;
		border-left-color: var(--ink);
		padding-left: var(--s-4);
	}
</style>
