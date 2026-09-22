<script lang="ts">
	// Reader for a document (memorie van toelichting, verslag, nota, amendement, motie, ...):
	// its text. Opened as the toelichting of an article, it lands on the passage for it.
	import { api, unwrap } from '$lib/api/client';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import GlossaryPill from './GlossaryPill.svelte';
	import { landOn } from '$lib/bron/anchor';
	import { findPassage } from '$lib/text/find-passage';
	import { tick } from 'svelte';
	import { formatDate } from './_shared';

	let {
		node,
		articleNumber = null
	}: {
		node: Pick<GraphNode, 'key'>;
		/** The article whose toelichting is wanted; the reader opens at its passage. */
		articleNumber?: string | null;
	} = $props();

	type State =
		| { kind: 'loading' }
		| { kind: 'error'; message: string }
		| { kind: 'loaded'; document: Schema<'DocumentTextResponse'> };

	let view = $state<State>({ kind: 'loading' });

	$effect(() => {
		const key = node.key;
		const ac = new AbortController();
		view = { kind: 'loading' };
		unwrap(api.GET('/api/documents/{key}', { params: { path: { key } }, signal: ac.signal }))
			.then((document) => {
				if (!ac.signal.aborted) view = { kind: 'loaded', document };
			})
			.catch(() => {
				if (!ac.signal.aborted)
					view = { kind: 'error', message: 'Document kon niet geladen worden.' };
			});
		return () => ac.abort();
	});

	// The source gives a paragraph per line. Each keeps its place in the text, so that
	// a passage can be found back.
	const paragraphs = $derived.by(() => {
		if (view.kind !== 'loaded' || !view.document.text) return [];
		const text = view.document.text;
		const out: { start: number; text: string }[] = [];
		for (const m of text.matchAll(/[^\n]+/g)) {
			if (m[0].trim()) out.push({ start: m.index, text: m[0].trim() });
		}
		return out;
	});

	const passage = $derived(
		view.kind === 'loaded' && articleNumber
			? findPassage(view.document.text ?? '', articleNumber)
			: null
	);
	const passageIndex = $derived(
		passage ? paragraphs.findLastIndex((p) => p.start <= passage.start) : -1
	);

	let root = $state<HTMLElement | null>(null);
	$effect(() => {
		if (passageIndex < 0 || !root) return;
		const container = root;
		void tick().then(() => landOn(container, 'passage'));
	});

	// The kind is the source's own wording; where a glossary term exists the kicker links to it.
	function glossaryTerm(kind: string | null | undefined): string | null {
		const k = kind?.toLowerCase();
		if (!k) return null;
		if (k.includes('memorie') || k === 'mvt') return 'MvT';
		if (k.includes('verslag')) return 'Verslag';
		if (k.includes('nota')) return 'Nota';
		if (k.includes('amendement')) return 'Amendement';
		if (k.includes('motie')) return 'Motie';
		return null;
	}
</script>

<div class="r-document">
	{#if view.kind === 'loading'}
		<p class="loading">Laden…</p>
	{:else if view.kind === 'error'}
		<p class="error">{view.message}</p>
	{:else}
		{@const doc = view.document}
		{@const term = glossaryTerm(doc.kind)}
		<header class="head">
			<span class="kicker">
				{#if term}<GlossaryPill {term} label={doc.kind ?? term} />{:else}{doc.kind ??
						'Document'}{/if}
				{#if doc.date}<span class="dot">·</span>{formatDate(doc.date)}{/if}
			</span>
			<h2 class="title">{doc.title ?? doc.key}</h2>
			{#if doc.external_id}
				<code class="ext-id">{doc.external_id}</code>
			{/if}
		</header>

		{#if doc.text}
			<div class="body" bind:this={root}>
				{#each paragraphs as para, i (para.start)}
					{#if i === passageIndex}
						<p class="body-para body-para--passage" id="passage">
							{para.text}<span class="derived" role="img" aria-label="afgeleid">≈</span>
						</p>
					{:else}
						<p class="body-para">{para.text}</p>
					{/if}
				{/each}
			</div>
		{:else}
			<p class="empty">Geen tekst beschikbaar.</p>
		{/if}

		{#if doc.tk_url}
			<footer class="foot">
				<a href={doc.tk_url} target="_blank" rel="noopener noreferrer" class="full-link">
					tweedekamer.nl ↗
				</a>
			</footer>
		{/if}
	{/if}
</div>

<style>
	.body-para--passage {
		scroll-margin: 20vh;
		font-weight: 600;
	}
	.body-para--passage:global(.is-landed) {
		background: var(--accent-soft);
	}
	.derived {
		margin-left: 6px;
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 400;
		color: var(--ink-4);
	}
	.r-document {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
		padding: var(--s-5) var(--s-5) var(--s-6);
		color: var(--ink-2);
		height: 100%;
		overflow-y: auto;
	}
	.loading,
	.error,
	.empty {
		font-family: var(--font-serif);
		font-style: italic;
		color: var(--ink-4);
		margin: 0;
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.kicker {
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--ink-4);
		display: flex;
		gap: 5px;
		align-items: baseline;
	}
	.dot {
		opacity: 0.6;
	}
	.title {
		font-family: var(--font-serif);
		font-size: 19px;
		font-weight: 400;
		color: var(--ink);
		margin: 0;
		line-height: 1.3;
	}
	.ext-id {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--ink-4);
	}

	.body {
		font-family: var(--font-serif);
		font-size: 14px;
		line-height: 1.65;
		color: var(--ink-2);
		border-top: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
		padding: var(--s-3) 0;
	}

	.body-para {
		margin: 0;
	}
	.body-para + .body-para {
		margin-top: var(--s-3);
	}
	.foot {
		display: flex;
	}
	.full-link {
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--spine);
		text-decoration: none;
		border-bottom: 1px solid var(--spine-faint);
	}
	.full-link:hover {
		border-bottom-color: var(--spine);
	}
</style>
