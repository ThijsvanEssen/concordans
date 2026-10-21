<script lang="ts">
	import { gewoneKlik } from '$lib/actions/klik';
	import NavKolom from './NavKolom.svelte';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	// The table of contents of a judgment in Lezen: samenvatting, partijen, and its
	// headings — the same nav-column slot LezenNav fills for a wet. Shares the judgment
	// request in flight with JudgmentReader (`getJudgmentDetail`'s own cache).
	import { getJudgmentDetail } from '$lib/api/judgments';
	import { headingCite } from '$lib/text/judgment-heading';
	import type { GraphNode } from '$lib/graph/types';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { load } from '$lib/util/load.svelte';
	import { bodyItems, judgmentParticipants, signatureStart } from './readers/judgment-text';

	let { selection }: { selection: GraphNode | null } = $props();

	type Item = { id: string; label: string; kind: 'summary' | 'parties' | 'heading' };

	const ecli = $derived(
		selection?.collection === 'judgments'
			? String(selection.raw?.props?.ecli ?? selection.key)
			: null
	);

	const toc = load(
		() => ecli,
		async (e) => {
			if (!e) return null;
			const j = (await getJudgmentDetail(e)).judgment;
			const paragraphs = j.paragraphs ?? [];
			// The same condition under which JudgmentReader renders its table.
			const hasParties = judgmentParticipants(j).length > 0;

			const items: Item[] = [];
			if (j.summary?.trim()) items.push({ id: 'summary', label: 'Samenvatting', kind: 'summary' });
			if (hasParties) items.push({ id: 'parties', label: 'Partijen', kind: 'parties' });
			// The headings as the reader lays the body out, the text left in the kop included.
			for (const item of bodyItems(paragraphs.slice(0, signatureStart(paragraphs))))
				if (item.kind === 'heading') items.push({ id: item.id, label: item.text, kind: 'heading' });
			return { label: headingCite(j)?.short ?? j.display_name ?? 'Uitspraak', items };
		},
		'Inhoudsopgave'
	);
	// While the contents load, or after they failed, the column keeps the name of the uitspraak.
	const ecliLabel = $derived(
		(toc.state.status === 'ready' ? toc.state.data?.label : null) ?? selection?.label ?? null
	);

	// A link to the passage, so that it can be copied and opened elsewhere; a plain click
	// scrolls smoothly and puts the passage in the address without a history entry.
	function jump(e: MouseEvent, id: string) {
		if (!gewoneKlik(e)) return;
		e.preventDefault();
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		replaceState(`#${id}`, page.state);
	}
</script>

{#if ecli}
	<NavKolom label="Inhoud" title={ecliLabel}>
		<LoadState state={toc.state} what="De inhoudsopgave" retry={toc.retry}>
			{#snippet children(toc)}
				{#if toc && toc.items.length > 0}
					<ol class="nav-kolom__lijst">
						{#each toc.items as it, i (i)}
							<li>
								<a
									class="nav-kolom__rij row--{it.kind}"
									href="#{it.id}"
									onclick={(e) => jump(e, it.id)}>{it.label}</a
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
	.row--summary,
	.row--parties {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 400;
		color: var(--ink-3);
	}

	.row--heading {
		font-family: var(--font-serif);
		font-weight: 600;
		color: var(--ink);
	}
</style>
