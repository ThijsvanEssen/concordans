<script lang="ts">
	// The table of contents of a document (memorie, verslag, nota, ...) in Lezen: its
	// headings, the same nav-column slot LezenNav fills for a wet. Fetches its own copy
	// of the document, the way LezenNav fetches its own copy of the law's articles.
	import { api, unwrap } from '$lib/api/client';
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
		unwrap(api.GET('/api/documents/{key}', { params: { path: { key: k } }, signal: ac.signal }))
			.then((doc) => {
				title = doc.title ?? doc.key;
				kind = doc.kind ?? null;
				sections = doc.sections ?? [];
			})
			.catch(() => {
				if (!ac.signal.aborted) error = 'Overzicht niet geladen.';
			})
			.finally(() => {
				if (!ac.signal.aborted) loading = false;
			});
		return () => ac.abort();
	});

	function jump(id: string) {
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

{#if key}
	<aside class="doc-toc" aria-label="Inhoud">
		<header class="head">
			<h3 class="head__title">{title}</h3>
			{#if kind}<div class="head__section">{kind}</div>{/if}
		</header>

		{#if loading && sections.length === 0}
			<p class="note">Laden</p>
		{:else if error}
			<p class="note">{error}</p>
		{:else if sections.length > 0}
			<ol class="list">
				{#each sections as s (s.id)}
					<li>
						<button
							type="button"
							class="row level-{Math.min(s.level, 3)}"
							onclick={() => jump(s.id)}>{s.heading}</button
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
		padding: 4px 18px;
		border: 0;
		background: none;
		text-align: left;
		color: var(--ink-2);
		line-height: 1.3;
		cursor: pointer;
	}

	.row:hover {
		background: var(--paper-2);
		color: var(--ink);
	}

	.row.level-1 {
		font-family: var(--font-sans);
		font-size: 11.5px;
		font-weight: 600;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		color: var(--ink-3);
		margin-top: var(--s-3);
	}

	.row.level-2 {
		font-family: var(--font-serif);
		font-weight: 500;
		color: var(--ink);
	}

	.row.level-3 {
		padding-left: 28px;
		color: var(--ink-3);
		font-style: italic;
	}
</style>
