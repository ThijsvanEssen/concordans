<script lang="ts" module>
	// Persistent across all panel instances — once we've fetched a node's
	// snippet, we never fetch it again for the lifetime of the page.
	const snippetCache = new Map<string, string>();
</script>

<script lang="ts">
	import type { GraphNode } from '$lib/graph/types';
	import { getArticleDetail } from '$lib/api/articles';
	import { getJudgmentDetail } from '$lib/api/judgments';
	import { instrumentMetaStore } from '$lib/api/instrument-cache';
	import { getLawIdFromProps } from '$lib/util/law-id';

	let {
		node,
		isPinned = false,
		onOpen,
		onFocus,
		onTogglePin,
		onMouseEnter,
		onMouseLeave
	}: {
		node: GraphNode;
		isPinned?: boolean;
		onOpen: (node: GraphNode) => void;
		onFocus: (node: GraphNode) => void;
		onTogglePin?: (node: GraphNode) => void;
		onMouseEnter?: () => void;
		onMouseLeave?: () => void;
	} = $props();

	const W = 360;

	const kindLabel = $derived(
		node.kind === 'judgment'
			? 'Arrest'
			: node.kind === 'article'
				? 'Artikel'
				: node.kind === 'dossier'
					? 'Dossier'
					: node.kind === 'commissie'
						? 'Commissie'
						: node.kind === 'lid'
							? 'Kamerlid'
							: node.kind === 'fractie'
								? 'Fractie'
								: 'Overig'
	);
	const kindClass = $derived(
		node.kind === 'judgment'
			? 'dot--judgment'
			: node.kind === 'dossier'
				? 'dot--dossier'
				: node.kind === 'commissie'
					? 'dot--commissie'
					: node.kind === 'fractie'
						? 'dot--fractie'
						: node.kind === 'lid'
							? 'dot--lid'
							: node.kind === 'tkstuk'
								? 'dot--tkstuk'
								: node.kind === 'activity'
									? 'dot--activity'
									: 'dot--article'
	);

	// Show the full law name (from the cache) for articles, ECLI for judgments,
	// partij for leden. The line under the title tells the reader *which*
	// institutional context the node belongs to.
	const cite = $derived.by(() => {
		const p = node.raw?.props as Record<string, unknown> | undefined;
		if (node.collection === 'judgments') {
			const ecli = String(p?.['ecli'] ?? node.key);
			const m = ecli.match(/(?:ECLI:)?(?:NL:)?([^:]+):(\d{4}):(\d+)/);
			return m ? `${m[1]} ${m[2]}/${m[3]}` : ecli.replace(/^ECLI:/, '');
		}
		if (node.collection === 'instrument_articles') {
			const bwb = getLawIdFromProps(p, node.key) ?? '';
			const meta = bwb ? $instrumentMetaStore.get(bwb) : null;
			return meta?.citationTitle ?? meta?.title ?? meta?.shortTitle ?? bwb;
		}
		if (node.kind === 'lid') {
			const partij = p?.['partij'];
			return typeof partij === 'string' && partij.length > 0 ? partij : node.key;
		}
		return node.key;
	});

	// Module-level snippet cache — avoids re-fetching when the user re-hovers
	// a node they've already previewed. Without this every wave of the mouse
	// across a dense graph fires fresh /api/articles requests.
	let snippet = $state<string | null>(null);
	let loading = $state(false);

	$effect(() => {
		const n = node;

		// Stub nodes have no content to fetch.
		if (n.stub) {
			snippet = null;
			loading = false;
			return;
		}

		const cached = snippetCache.get(n.id);
		if (cached !== undefined) {
			snippet = cached;
			loading = false;
			return;
		}
		snippet = null;
		loading = true;
		const p = n.raw?.props as Record<string, unknown> | undefined;

		if (n.collection === 'instrument_articles') {
			const bwb = getLawIdFromProps(p, n.key) ?? '';
			const art = String(p?.['article_number'] ?? '');
			if (bwb && art) {
				getArticleDetail(bwb, art)
					.then((res) => {
						const txt = res.article.text ?? '';
						const trimmed = txt.length > 220 ? txt.slice(0, 220) + '…' : txt;
						snippetCache.set(n.id, trimmed);
						if (node.id === n.id) {
							snippet = trimmed;
							loading = false;
						}
					})
					.catch(() => {
						snippetCache.set(n.id, '');
						if (node.id === n.id) loading = false;
					});
			} else {
				loading = false;
			}
		} else if (n.kind === 'lid') {
			// Lid hover: no remote fetch — partij + actief is already in props.
			const partij = (p?.['partij'] as string | null) ?? null;
			const actief = (p?.['actief'] as boolean | null) ?? null;
			const summary = [partij, actief === false ? 'inactief' : null].filter(Boolean).join(' · ');
			snippetCache.set(n.id, summary);
			snippet = summary;
			loading = false;
		} else if (n.kind === 'fractie') {
			const naam = (p?.['naam'] as string | null) ?? null;
			snippetCache.set(n.id, naam ?? '');
			snippet = naam;
			loading = false;
		} else if (n.collection === 'judgments') {
			const ecli = String(p?.['ecli'] ?? n.key);
			const full = ecli.startsWith('ECLI:') ? ecli : `ECLI:${ecli}`;
			getJudgmentDetail(full)
				.then((res) => {
					const txt = res.judgment.summary ?? '';
					const trimmed = txt.length > 220 ? txt.slice(0, 220) + '…' : txt;
					snippetCache.set(n.id, trimmed);
					if (node.id === n.id) {
						snippet = trimmed;
						loading = false;
					}
				})
				.catch(() => {
					snippetCache.set(n.id, '');
					if (node.id === n.id) loading = false;
				});
		} else {
			loading = false;
		}
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="citepanel" style="width:{W}px" onmouseenter={onMouseEnter} onmouseleave={onMouseLeave}>
	<div class="head">
		<span class="dot {kindClass}" aria-hidden="true"></span>
		<span class="kind caps">{kindLabel}</span>
		<span class="cite mono">{cite}</span>
	</div>

	<h4 class="title {node.stub ? 'title--stub' : ''}">{node.label}</h4>

	{#if node.stub}
		<p class="snippet stub-note">Nog niet geladen in de database.</p>
	{:else if loading}
		<span class="cite-loading">Laden…</span>
	{:else if snippet}
		<p class="snippet">{snippet}</p>
	{/if}

	<div class="foot">
		{#if !node.stub}
			<button
				class="act act--primary"
				onclick={() => onOpen(node)}
				title="Toont de volledige tekst van deze bron in het leesvenster."
			>
				{node.collection === 'judgments' ? '↪ Arrest openen' : '↪ Openen'}
			</button>
		{/if}
		<button
			class="act"
			onclick={() => onFocus(node)}
			title="Centreert dit knooppunt in het netwerk en laadt de aangrenzende bronnen."
			>→ Selecteren</button
		>
		{#if onTogglePin && !node.stub}
			<button
				class="act act--pin"
				class:act--pinned={isPinned}
				onclick={() => onTogglePin(node)}
				title={isPinned ? 'Losmaken' : 'Vastpinnen — blijft zichtbaar bij volgende uitklap'}
				>{isPinned ? '★ Vast' : '☆ Pin'}</button
			>
		{/if}
	</div>
</div>

<style>
	.citepanel {
		position: absolute;
		top: 16px;
		right: 16px;
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

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.dot--article {
		background: #fffdf4;
		border: 1.5px solid #1a1814;
	}
	.dot--judgment {
		background: #2b3a5c;
	}
	.dot--dossier {
		background: #7a1f1a;
	}
	.dot--commissie {
		background: #8a6a1f;
	}
	.dot--fractie {
		background: #44505e;
	}
	.dot--tkstuk {
		background: #fffdf4;
		border: 1.5px solid #7a1f1a;
	}
	.dot--activity {
		background: #fffdf4;
		border: 1.5px solid #8a6a1f;
	}
	.dot--lid {
		background: #fffdf4;
		border: 1.5px solid #44505e;
	}

	.title--stub {
		color: var(--ink-3);
	}
	.stub-note {
		font-style: italic;
		color: var(--ink-4);
	}

	.kind {
		font-family: var(--font-sans);
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-3);
	}

	.cite {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--accent);
		margin-left: auto;
	}

	.title {
		font-family: var(--font-serif);
		font-size: 17px;
		font-weight: 500;
		line-height: 1.2;
		color: var(--ink);
		margin: 0;
		letter-spacing: -0.01em;
	}

	.snippet {
		font-family: var(--font-serif);
		font-size: 14px;
		line-height: 1.55;
		color: var(--ink-3);
		margin: 0;
	}

	.cite-loading {
		font-size: 11px;
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

	.act {
		background: none;
		border: none;
		font-family: var(--font-sans);
		font-size: 12px;
		font-weight: 500;
		letter-spacing: 0.03em;
		color: var(--ink-2);
		cursor: pointer;
		padding: 3px 8px;
		border-radius: var(--r-1);
		transition:
			color var(--dur-1) var(--ease),
			background var(--dur-1) var(--ease);
	}

	.act:first-child {
		color: var(--accent);
	}

	.act--primary {
		color: var(--accent);
		text-decoration: none;
	}

	.act:hover {
		background: var(--paper-2);
		color: var(--accent);
	}

	.act--pin {
		color: var(--ink-3);
		margin-left: auto;
	}
	.act--pin:hover {
		color: var(--spine);
	}
	.act--pinned {
		color: var(--spine);
		font-weight: 600;
	}
</style>
