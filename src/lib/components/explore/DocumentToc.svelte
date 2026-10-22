<script lang="ts">
	import { gewoneKlik } from '$lib/actions/klik';
	import NavKolom from './NavKolom.svelte';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	// The table of contents of a document (memorie, verslag, nota, ...) in Lezen: its
	// headings, the same nav-column slot LezenNav fills for a wet. Fetches its own copy
	// of the document, the way LezenNav fetches its own copy of the law's articles.
	import { getDocument } from '$lib/api/records';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { load } from '$lib/util/load.svelte';
	import { keepMarkedInView } from './nav-column';
	import { followSections } from './toc-position.svelte';

	let { selection }: { selection: GraphNode | null } = $props();

	type Section = Schema<'SectionDTO'>;

	const key = $derived(selection?.collection === 'documents' ? selection.key : null);
	const toc = load(
		() => key,
		async (k) => {
			if (!k) return null;
			const doc = await getDocument(k);
			return {
				sections: (doc.sections ?? []) as Section[]
			};
		},
		'Inhoudsopgave'
	);
	const loaded = $derived(toc.state.status === 'ready' ? toc.state.data : null);

	// The section at the top of the text, marked in the list and kept in view in the column.
	const position = followSections(() => loaded?.sections.map((s) => s.id) ?? []);
	let navEl = $state<HTMLElement | null>(null);
	$effect(() => {
		if (position.current) keepMarkedInView(navEl);
	});

	// A link to the passage, so that it can be copied and opened elsewhere; a plain click
	// scrolls smoothly and puts the passage in the address without a history entry.
	function jump(e: MouseEvent, id: string) {
		if (!gewoneKlik(e)) return;
		e.preventDefault();
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		replaceState(`#${id}`, page.state);
	}
</script>

{#if key}
	<NavKolom bind:el={navEl}>
		<LoadState state={toc.state} what="De inhoudsopgave" retry={toc.retry}>
			{#snippet children(doc)}
				{#if doc && doc.sections.length > 0}
					<ol class="nav-kolom__lijst">
						{#each doc.sections as s (s.id)}
							<li>
								<a
									class="nav-kolom__rij level-{Math.min(s.level, 3)}"
									class:is-active={position.current === s.id}
									aria-current={position.current === s.id ? 'location' : undefined}
									href="#{s.id}"
									onclick={(e) => jump(e, s.id)}>{s.heading}</a
								>
							</li>
						{/each}
					</ol>
				{:else}
					<p class="nav-kolom__note">Geen indeling.</p>
				{/if}
			{/snippet}
		</LoadState>
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
