<script lang="ts">
	// The hover panel of the canvas: what the bron is, a preview, and two actions: open
	// it, and add it to the netwerk or take it out.
	import type { GraphNode } from '$lib/graph/types';
	import { articleOf, lawIdOf } from '$lib/graph/types';
	import { getArticleDetail } from '$lib/api/articles';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { bronHref, refOf } from '$lib/bron/href';
	import { bronLabel } from '$lib/vocabulary';
	import Picto from '$lib/components/ui/Picto.svelte';
	import { bronNaam } from '$lib/bron/naam';
	import { instrumentMetaStore } from '$lib/api/instrument-cache';

	let {
		node,
		isChosen = false,
		onOpen,
		onLezen,
		onToggleChosen,
		onOmgeving,
		at = null,
		onMouseEnter,
		onMouseLeave
	}: {
		node: GraphNode;
		isChosen?: boolean;
		/** Called as the link opens the bron: the panel closes. */
		onOpen: (node: GraphNode) => void;
		/** A plain click on "Tekst lezen" opens the bron here; a new tab keeps the link. */
		onLezen?: (node: GraphNode) => void;
		onToggleChosen?: (node: GraphNode) => void;
		/** Alleen de omgeving van deze bron, in plaats van het netwerk (vroeger een dubbelklik). */
		onOmgeving?: (node: GraphNode) => void;
		/** Waar de kaart staat, naast de bron onder de muis; zonder: rechtsonder. */
		at?: { x: number; y: number } | null;
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
<div
	class="citepanel"
	class:bij-bron={!!at}
	style="width:min({W}px, calc(100% - var(--s-4)));{at ? `left:${at.x}px;top:${at.y}px;` : ''}"
	onmouseenter={onMouseEnter}
	onmouseleave={onMouseLeave}
>
	<div class="head">
		<KindGlyph collection={node.collection} />
		<span class="kind caps">{bronLabel(node.collection)}</span>
		{#if cite}<span class="cite">{cite}</span>{/if}
	</div>

	<h4 class="title {node.stub ? 'title--stub' : ''}">{bronNaam(node, $instrumentMetaStore)}</h4>

	{#if node.stub}
		<p class="snippet stub-note">Niet in de gegevens.</p>
	{:else if loading}
		<span class="cite-loading">Laden…</span>
	{:else if snippet}
		<p class="snippet">{snippet}</p>
	{/if}

	<div class="foot">
		{#if !node.stub}
			<!-- A link, so a middle click or cmd-click opens the bron in a new tab. -->
			<a
				class="btn is-text lezen"
				href={bronHref(refOf(node.collection, node.key, node.raw?.props))}
				data-sveltekit-noscroll
				onclick={(e) => {
					if (onLezen && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
						e.preventDefault();
						onLezen(node);
					} else onOpen(node);
				}}><Picto naam="tekst" size={13} />Tekst lezen</a
			>
		{/if}
		{#if onOmgeving && !node.stub}
			<button type="button" class="btn is-text" onclick={() => onOmgeving(node)}
				><Picto naam="omgeving" size={13} />Omgeving tonen</button
			>
		{/if}
		{#if onToggleChosen && !node.stub}
			<button
				type="button"
				class="btn is-text netwerk"
				class:gekozen={isChosen}
				aria-pressed={isChosen}
				onclick={() => onToggleChosen(node)}
				><Picto naam="plus" size={13} />{isChosen ? 'Uit netwerk' : 'In netwerk'}</button
			>
		{/if}
	</div>
</div>

<style>
	/* Rechtsonder naast de zoom; rechtsboven staat het netwerkpaneel. */
	.citepanel {
		position: absolute;
		bottom: var(--s-3);
		/* Beside the zoom; in a narrow network (beside the reader) never past its left edge. */
		right: min(
			calc(var(--s-3) + 32px + var(--s-3)),
			calc(100% - min(360px, 100% - var(--s-4)) - var(--s-2))
		);
		z-index: calc(var(--z-float) + 1);
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
		gap: var(--s-2);
	}

	.title--stub {
		color: var(--ink-3);
	}
	.stub-note {
		font-style: italic;
		color: var(--ink-3);
	}

	.kind {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
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
		font-weight: 600;
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
		font-family: var(--font-serif);
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

	/* The way to the text in ink, the others a step quieter (Knop, is-text). */
	.lezen {
		color: var(--ink);
	}

	.citepanel.bij-bron {
		right: auto;
		bottom: auto;
	}
	.netwerk {
		color: var(--ink-3);
		margin-left: auto;
	}
	.netwerk.gekozen {
		color: var(--ink);
	}
</style>
