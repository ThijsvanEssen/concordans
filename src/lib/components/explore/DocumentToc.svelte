<script lang="ts">
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	// The table of contents of a document (memorie, verslag, nota, ...) in Lezen: its
	// headings, the same nav-column slot LezenNav fills for a wet. Fetches its own copy
	// of the document, the way LezenNav fetches its own copy of the law's articles.
	import { getDocument } from '$lib/api/records';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';

	let { selection }: { selection: GraphNode | null } = $props();

	type Section = Schema<'SectionDTO'>;

	let title = $state<string | null>(null);
	let kind = $state<string | null>(null);
	let sections = $state<Section[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	const key = $derived(selection?.collection === 'documents' ? selection.key : null);

	$effect(() => {
		const k = key;
		if (!k) return;
		const ac = new AbortController();
		loading = true;
		error = null;
		getDocument(k)
			.then((doc) => {
				title = doc.title ?? doc.key;
				kind = doc.kind ?? null;
				sections = doc.sections ?? [];
			})
			.catch(() => {
				if (!ac.signal.aborted) error = 'De inhoudsopgave kon niet worden geladen.';
			})
			.finally(() => {
				if (!ac.signal.aborted) loading = false;
			});
		return () => ac.abort();
	});

	// A link to the passage, so that it can be copied and opened elsewhere; a plain click
	// scrolls smoothly and puts the passage in the address without a history entry.
	function jump(e: MouseEvent, id: string) {
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
		e.preventDefault();
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		replaceState(`#${id}`, page.state);
	}
</script>

{#if key}
	<aside class="doc-toc" aria-label="Inhoud">
		<header class="head">
			<h3 class="head__title">{title}</h3>
			{#if kind}<div class="head__section">{kind}</div>{/if}
		</header>

		{#if loading && sections.length === 0}
			<p class="note">Laden…</p>
		{:else if error}
			<p class="note">{error}</p>
		{:else if sections.length > 0}
			<ol class="list">
				{#each sections as s (s.id)}
					<li>
						<a
							class="row level-{Math.min(s.level, 3)}"
							href="#{s.id}"
							onclick={(e) => jump(e, s.id)}>{s.heading}</a
						>
					</li>
				{/each}
			</ol>
		{:else if !loading}
			<p class="note">Geen indeling.</p>
		{/if}
	</aside>
{/if}

<style>
	.doc-toc {
		height: 100%;
		overflow-y: auto;
		padding-top: var(--s-5);
		background: var(--paper-2);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
	}

	.note {
		margin: 0;
		padding: var(--s-4);
		color: var(--ink-3);
	}

	.head {
		padding: 0 var(--s-4) var(--s-3);
	}

	.head__title {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-weight: 500;
		line-height: 1.2;
		color: var(--ink);
	}

	.head__section {
		margin-top: var(--s-1);
		font-size: var(--t-micro);
		color: var(--ink-3);
		text-transform: capitalize;
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0 0 var(--s-5);
	}

	.row {
		display: block;
		width: 100%;
		padding: var(--s-1) var(--s-4);
		border: 0;
		background: none;
		text-align: left;
		color: var(--ink-2);
		line-height: 1.3;
		cursor: pointer;
		text-decoration: none;
	}

	.row:hover {
		background: var(--paper);
		color: var(--ink);
	}

	/* Heads a group of the contents: rung 3 of docs/typografie.md. */
	.row.level-1 {
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink);
		margin-top: var(--s-3);
	}

	.row.level-2 {
		font-family: var(--font-serif);
		font-weight: 500;
		color: var(--ink);
	}

	.row.level-3 {
		padding-left: calc(var(--s-4) + var(--s-3));
		color: var(--ink-3);
		font-style: italic;
	}
</style>
