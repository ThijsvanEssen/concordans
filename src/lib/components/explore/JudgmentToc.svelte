<script lang="ts">
	import { gewoneKlik } from '$lib/actions/klik';
	import NavKolom from './NavKolom.svelte';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	// The table of contents of a judgment in Lezen: samenvatting, partijen, and its
	// headings — the same nav-column slot LezenNav fills for a wet. Shares the judgment
	// request in flight with JudgmentReader (`getJudgmentDetail`'s own cache).
	import { getJudgmentDetail } from '$lib/api/judgments';
	import type { GraphNode } from '$lib/graph/types';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { load } from '$lib/util/load.svelte';
	import { bodyItems, judgmentParticipants, signatureStart } from './readers/judgment-text';
	import { keepMarkedInView } from './nav-column';
	import { followSections } from './toc-position.svelte';
	import { reportContents } from './contents-state.svelte';

	let { selection }: { selection: GraphNode | null } = $props();

	type Item = { id: string; label: string };
	/** An overweging (r.o.) by its number, for the list to jump to. */
	type Ro = { id: string; num: string };

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
			if (j.summary?.trim()) items.push({ id: 'summary', label: 'Samenvatting' });
			if (hasParties) items.push({ id: 'parties', label: 'Partijen' });
			// The headings as the reader lays the body out, the text left in the kop included.
			const ro: Ro[] = [];
			for (const item of bodyItems(paragraphs.slice(0, signatureStart(paragraphs)))) {
				if (item.kind === 'heading') items.push({ id: item.id, label: item.text });
				else if (item.kind === 'rov' && item.id) ro.push({ id: item.id, num: item.num });
			}
			return {
				items,
				ro,
				// A conclusion numbers its punten, a judgment its overwegingen (JudgmentReader).
				roLabel: j.decision_kind === 'conclusie' ? 'Punten' : 'Rechtsoverwegingen'
			};
		},
		'Inhoudsopgave'
	);
	const loaded = $derived(toc.state.status === 'ready' ? toc.state.data : null);
	$effect(() => {
		if (selection && loaded) reportContents(selection.id, loaded.items.length + loaded.ro.length);
	});
	// The heading and the overweging at the top of the text, marked in the lists and kept in
	// view in the column.
	const headingAt = followSections(() => loaded?.items.map((i) => i.id) ?? []);
	const roAt = followSections(() => loaded?.ro.map((r) => r.id) ?? []);
	let navEl = $state<HTMLElement | null>(null);
	$effect(() => {
		void headingAt.current;
		void roAt.current;
		keepMarkedInView(navEl);
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

{#if ecli}
	<NavKolom bind:el={navEl}>
		<LoadState state={toc.state} what="De inhoudsopgave" retry={toc.retry}>
			{#snippet children(toc)}
				{#if toc && toc.items.length > 0}
					<ol class="nav-kolom__lijst">
						{#each toc.items as it, i (i)}
							<li>
								<a
									class="nav-kolom__rij"
									class:is-active={headingAt.current === it.id}
									aria-current={headingAt.current === it.id ? 'location' : undefined}
									href="#{it.id}"
									onclick={(e) => jump(e, it.id)}>{it.label}</a
								>
							</li>
						{/each}
					</ol>
					{#if toc.ro.length > 0}
						<!-- The springlijst: every overweging by its number. -->
						<div class="ro" role="group" aria-label={toc.roLabel}>
							<span class="ro__label">{toc.roLabel}</span>
							<ol class="ro__lijst">
								{#each toc.ro as r (r.id)}
									<li>
										<a
											class="ro__nr"
											class:is-active={roAt.current === r.id}
											aria-current={roAt.current === r.id ? 'location' : undefined}
											href="#{r.id}"
											onclick={(e) => jump(e, r.id)}>{r.num}</a
										>
									</li>
								{/each}
							</ol>
						</div>
					{/if}
				{/if}
			{/snippet}
		</LoadState>
	</NavKolom>
{/if}

<style>
	/* The springlijst of the overwegingen: their numbers in a wrapping row, the one at the
	   top of the text marked. */
	.ro {
		padding: var(--s-2) var(--s-4) var(--s-5);
	}
	.ro__label {
		display: block;
		margin-bottom: var(--s-2);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.ro__lijst {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.ro__nr {
		display: block;
		min-width: var(--s-6);
		padding: var(--s-1) var(--s-2);
		border-radius: var(--r-1);
		text-align: center;
		font-size: var(--t-micro);
		color: var(--ink-2);
		text-decoration: none;
	}
	.ro__nr:hover,
	.ro__nr.is-active {
		background: var(--paper-2);
		color: var(--ink);
	}
	.ro__nr.is-active {
		font-weight: 600;
		box-shadow: inset 0 0 0 1px var(--ink);
	}
	/* A finger's target: 32 px at least. */
	@media (pointer: coarse), (max-width: 768px) {
		.ro__nr {
			display: flex;
			align-items: center;
			justify-content: center;
			min-height: var(--s-6);
		}
	}
</style>
