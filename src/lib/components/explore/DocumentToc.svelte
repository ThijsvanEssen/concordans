<script lang="ts">
	import { naamVan } from '$lib/bron/menselijk';
	import NavKolom from './NavKolom.svelte';
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
				title = doc.title ?? naamVan('documents', doc);
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
	<NavKolom
		label="Inhoud"
		titel={title}
		onder={kind ? kind.charAt(0).toUpperCase() + kind.slice(1) : null}
	>
		{#if loading && sections.length === 0}
			<p class="nav-kolom__note">Laden…</p>
		{:else if error}
			<p class="nav-kolom__note">{error}</p>
		{:else if sections.length > 0}
			<ol class="nav-kolom__lijst">
				{#each sections as s (s.id)}
					<li>
						<a
							class="nav-kolom__rij level-{Math.min(s.level, 3)}"
							href="#{s.id}"
							onclick={(e) => jump(e, s.id)}>{s.heading}</a
						>
					</li>
				{/each}
			</ol>
		{:else if !loading}
			<p class="nav-kolom__note">Geen indeling.</p>
		{/if}
	</NavKolom>
{/if}

<style>
	/* Heads a group of the contents: rung 3 of docs/typografie.md. */
	.level-1 {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink);
		margin-top: var(--s-3);
	}

	.level-2 {
		font-family: var(--font-serif);
		font-weight: 600;
		color: var(--ink);
	}

	.level-3 {
		padding-left: calc(var(--s-4) + var(--s-3));
		color: var(--ink-3);
		font-style: italic;
	}
</style>
