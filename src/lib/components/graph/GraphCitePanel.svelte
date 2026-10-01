<script lang="ts">
	// The hover panel of the canvas: what the bron is, a preview, and two actions: open
	// it, and add it to the netwerk or take it out.
	import type { GraphNode } from '$lib/graph/types';
	import { articleOf, lawIdOf } from '$lib/graph/types';
	import { getArticleDetail } from '$lib/api/articles';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { bronHref, refOf } from '$lib/bron/href';
	import { bronLabel } from '$lib/vocabulary';
	import Picto from '$lib/components/r5/Picto.svelte';
	import { bronNaam } from '$lib/bron/naam';
	import { instrumentMetaStore } from '$lib/api/instrument-cache';

	let {
		node,
		isChosen = false,
		onOpen,
		onToggleChosen,
		onOmgeving,
		onMouseEnter,
		onMouseLeave
	}: {
		node: GraphNode;
		isChosen?: boolean;
		/** Called as the link opens the bron: the panel closes. */
		onOpen: (node: GraphNode) => void;
		onToggleChosen?: (node: GraphNode) => void;
		/** Ronde 6: wat een dubbelklik doet, als knop: alleen de omgeving van deze bron. */
		onOmgeving?: (node: GraphNode) => void;
		onMouseEnter?: () => void;
		onMouseLeave?: () => void;
	} = $props();

	const W = 360;

	const nodeProps = $derived(node.raw?.props ?? undefined);
	const text = (value: unknown): string | null =>
		typeof value === 'string' && value ? value : null;

	// The line next to the kind: the context the source belongs to.
	const cite = $derived.by(() => {
		switch (node.kind) {
			// The title already names court and date (bron/naam.ts); the ECLI identifies it.
			case 'judgment':
				return text(nodeProps?.['ecli']);
			case 'article':
				return text(nodeProps?.['instrument_citation_title']) ?? lawIdOf(nodeProps);
			case 'member':
				return text(nodeProps?.['party']);
			case 'dossier':
				return text(nodeProps?.['number']) ?? node.key;
			case 'committee':
			case 'faction':
				return text(nodeProps?.['abbreviation']);
			default:
				return null;
		}
	});

	const preview = (value: string | null) =>
		value && value.length > 220 ? value.slice(0, 220) + '…' : value;

	// Text the node already carries, so hovering costs no request.
	const nodeText = $derived.by(() => {
		switch (node.kind) {
			case 'judgment':
				return text(nodeProps?.['summary']);
			case 'dossier':
			case 'document':
				return text(nodeProps?.['title']) ?? text(nodeProps?.['subject']);
			case 'committee':
			case 'faction':
				return text(nodeProps?.['name']);
			default:
				return null;
		}
	});

	// The text of an article is not on the node; it is fetched, and the request is
	// aborted when the pointer moves on.
	let articleText = $state<string | null>(null);
	let loading = $state(false);

	$effect(() => {
		articleText = null;
		loading = false;
		const identity = articleOf(nodeProps);
		if (node.stub || node.kind !== 'article' || !identity) return;
		let stale = false;
		loading = true;
		getArticleDetail(identity.lawId, identity.articleNumber)
			.then((res) => {
				if (!stale) articleText = preview(res.article.text);
			})
			.catch(() => {})
			.finally(() => {
				if (!stale) loading = false;
			});
		return () => {
			stale = true;
		};
	});

	const snippet = $derived(articleText ?? preview(nodeText));
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="citepanel" style="width:{W}px" onmouseenter={onMouseEnter} onmouseleave={onMouseLeave}>
	<div class="head">
		<KindGlyph collection={node.collection} />
		<span class="kind caps">{bronLabel(node.collection)}</span>
		{#if cite}<span class="cite">{cite}</span>{/if}
	</div>

	<h4 class="title {node.stub ? 'title--stub' : ''}">{bronNaam(node, $instrumentMetaStore)}</h4>

	{#if node.stub}
		<p class="snippet stub-note">Niet in de database.</p>
	{:else if loading}
		<span class="cite-loading">Laden…</span>
	{:else if snippet}
		<p class="snippet">{snippet}</p>
	{/if}

	<div class="foot">
		{#if !node.stub}
			<!-- A link, so a middle click or cmd-click opens the bron in a new tab. -->
			<a
				class="act act--primary"
				href={bronHref(refOf(node.collection, node.key, node.raw?.props))}
				data-sveltekit-noscroll
				onclick={() => onOpen(node)}><Picto naam="tekst" size={13} />Lezen</a
			>
		{/if}
		{#if onOmgeving && !node.stub}
			<button type="button" class="act" onclick={() => onOmgeving(node)}
				><Picto naam="verbindt" size={13} />Alleen de omgeving</button
			>
		{/if}
		{#if onToggleChosen && !node.stub}
			<button
				type="button"
				class="act act--netwerk"
				class:act--chosen={isChosen}
				aria-pressed={isChosen}
				onclick={() => onToggleChosen(node)}
				><Picto naam="plus" size={13} />{isChosen ? 'Uit netwerk' : 'In netwerk'}</button
			>
		{/if}
	</div>
</div>

<style>
	/* Ronde 6: rechtsonder naast de zoom; rechtsboven staat het netwerkpaneel. */
	.citepanel {
		position: absolute;
		bottom: var(--s-3);
		right: calc(var(--s-3) + 32px + var(--s-3));
		z-index: 80;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		box-shadow: var(--shadow-pop);
		padding: var(--s-4) var(--s-4) var(--s-3);
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		pointer-events: all;
	}

	.head {
		display: flex;
		align-items: center;
		gap: 7px;
	}

	.title--stub {
		color: var(--ink-3);
	}
	.stub-note {
		font-style: italic;
		color: var(--ink-3);
	}

	.kind {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
	}

	.cite {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: var(--t-meta);
		color: var(--ink-3);
		margin-left: auto;
	}

	.title {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		font-weight: 500;
		line-height: var(--lh-snug);
		color: var(--ink);
		margin: 0;
	}

	.snippet {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: var(--lh-body);
		color: var(--ink-2);
		margin: 0;
	}

	.cite-loading {
		font-size: var(--t-micro);
		color: var(--ink-3);
		font-family: var(--font-sans);
		padding: var(--s-2) var(--s-3);
		display: block;
	}

	.foot {
		display: flex;
		gap: var(--s-2);
		padding-top: var(--s-1);
		border-top: 1px solid var(--rule);
		margin-top: var(--s-1);
	}

	/* Text buttons: no border, the hover as a paper-2 field. */
	.act {
		display: inline-flex;
		align-items: center;
		gap: var(--s-1);
		background: none;
		border: none;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-2);
		cursor: pointer;
		padding: 3px var(--s-2);
		border-radius: var(--r-1);
		transition:
			color var(--dur-1) var(--ease),
			background var(--dur-1) var(--ease);
	}

	.act--primary {
		color: var(--ink);
		text-decoration: none;
	}

	.act:hover {
		background: var(--paper-2);
		color: var(--ink);
	}

	.act--netwerk {
		color: var(--ink-3);
		margin-left: auto;
	}
	.act--chosen {
		color: var(--ink);
	}
</style>
