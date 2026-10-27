<script lang="ts">
	// One line under the head of an article in a recodification (`TRANSPOSED_TO`): on the
	// old article the article of the new law that takes its place, In het nieuwe recht; on the
	// new one the article whose place it takes, Voorheen. A click opens it where the reader
	// is; the leden fold out under the line; Vergelijk opens the old text beside the new in
	// place (`?vergelijk=`); the transposition table is one step further. An old article no
	// new article takes the place of says what became of it (`outcomes`): vervallen bij,
	// niet overgenomen in, blijft in or naar the law the table names (a link where the API knows
	// that law, NamedLaw), or that the table places it nowhere (besluit 23); a part with an
	// outcome of its own stands in the fold-out.
	import { page } from '$app/state';
	import { withParams } from '$lib/util/address';
	import BronLink from '$lib/bron/BronLink.svelte';
	import { bronHref } from '$lib/bron/href';
	import Caret from '$lib/components/ui/Caret.svelte';
	import Coverage from '$lib/components/ui/Coverage.svelte';
	import { OUTCOME_WORD } from '$lib/verbonden/relation-words';
	import NamedLaw from './NamedLaw.svelte';
	import {
		outcomeParts,
		partRows,
		successionName,
		successionSources,
		successionStatus,
		type Direction,
		type OutcomeEdge,
		type OwnLaw,
		type Succession
	} from './succession';

	let {
		successors = [],
		predecessors = [],
		outcomes = [],
		own
	}: {
		successors?: readonly Succession[];
		predecessors?: readonly Succession[];
		/** What became of the old article where no new article takes its place, per new law. */
		outcomes?: readonly OutcomeEdge[];
		own: OwnLaw;
	} = $props();

	const LABEL: Record<Direction, string> = { new: 'In het nieuwe recht', old: 'Voorheen' };

	const lines = $derived(
		(
			[
				['new', successors],
				['old', predecessors]
			] as const
		)
			.filter(
				([direction, list]) => list.length > 0 || (direction === 'new' && outcomes.length > 0)
			)
			.map(([direction, list]) => {
				const items = list.map((s) => ({
					s,
					name: successionName(s, own, direction),
					status: successionStatus(s)
				}));
				const statuses = new Set(items.map((i) => i.status));
				// One law, one status: said once after the names.
				const shared = statuses.size === 1 ? items[0].status : null;
				const told = direction === 'new' ? outcomes : [];
				const rows = [
					...items.flatMap((i) =>
						partRows(i.s.parts).map((r) => ({
							old: direction === 'old' && items.length > 1 ? `${i.name}, ${r.old}` : r.old,
							place: r.place,
							law: r.law
						}))
					),
					// Beside a successor, the parts of an outcome stand in the fold-out alone.
					...partRows(outcomeParts(told, { inLine: items.length === 0 }), {
						whole: items.length > 0
					})
				];
				return {
					direction,
					items,
					// Without a successor, the line says what became of the article.
					outcomes: items.length > 0 ? [] : told,
					shared,
					perItem: statuses.size > 1,
					rows,
					sources: successionSources(list, told)
				};
			})
	);

	let unfolded = $state<Direction | null>(null);

	// The comparison opens in the reader, in place of the text; the same link closes it.
	const comparing = $derived(page.url.searchParams.get('vergelijk'));
	const compareHref = (id: string) =>
		comparing === id
			? withParams(page.url, { vergelijk: null, weergave: null })
			: withParams(page.url, { vergelijk: id, versies: null });
</script>

{#snippet compare(id: string)}
	<a
		class="btn is-text succession__toggle"
		href={compareHref(id)}
		data-sveltekit-noscroll
		aria-expanded={comparing === id}>Vergelijk</a
	>
{/snippet}

{#snippet outcome(o: OutcomeEdge)}
	{@const kind = o.reading.outcome?.kind}
	{@const word = kind && kind !== 'gat' ? `${OUTCOME_WORD[kind]} ` : ''}
	{@const named = o.reading.outcome?.law ?? (kind === 'blijft_in' ? own.citationTitle : null)}
	{#if kind === 'gat'}<Coverage
			lack="successor"
		/>{:else if (kind === 'blijft_in' || kind === 'naar') && named}{word}<NamedLaw
			name={named}
		/>{:else}{word}<BronLink ref={o.law.id} href={bronHref(o.law.id)}>{o.law.name}</BronLink>{/if}
{/snippet}

{#snippet item(
	item: (typeof lines)[number]['items'][number],
	line: (typeof lines)[number]
)}<BronLink ref={item.s.article.id} href={bronHref(item.s.article.id)}>{item.name}</BronLink
	>{#if line.perItem && item.status}<span class="succession__status">&nbsp;({item.status})</span
		>{/if}
{/snippet}

{#each lines as line (line.direction)}
	{@const open = unfolded === line.direction}
	<!-- More than one: each on a line of its own, its Vergelijk beside it; one stays in the line. -->
	{@const several = line.items.length + line.outcomes.length > 1}
	<div class="succession">
		<p class="succession__line">
			<span class="succession__label">{LABEL[line.direction]}:</span>
			{#if several}{#if line.shared}<span class="succession__status">{line.shared}</span>{/if}
			{:else}{#each line.items as it (it.s.article.id)}{@render item(
						it,
						line
					)}{/each}{#each line.outcomes as o (o.law.id)}{@render outcome(
						o
					)}{/each}{#if line.shared}<span class="succession__status">, {line.shared}</span>{/if}
				{#each line.items as it (it.s.article.id)}{@render compare(it.s.article.id)}{/each}
			{/if}
			{#if line.rows.length > 0}
				<button
					type="button"
					class="btn is-text succession__toggle"
					aria-expanded={open}
					onclick={() => (unfolded = open ? null : line.direction)}>Leden<Caret {open} /></button
				>
			{/if}
			{#each line.sources as url (url)}
				<a class="succession__source" href={url} target="_blank" rel="external noopener noreferrer"
					>Transponeringstabel</a
				>
			{/each}
		</p>
		{#if several}
			<ul class="succession__items">
				{#each line.items as it (it.s.article.id)}<li>
						{@render item(it, line)}{@render compare(it.s.article.id)}
					</li>{/each}
				{#each line.outcomes as o (o.law.id)}<li>{@render outcome(o)}</li>{/each}
			</ul>
		{/if}
		{#if open}
			<dl class="succession__parts">
				{#each line.rows as row (`${row.old}|${row.place}`)}
					<dt>{row.old}</dt>
					<dd>
						{#if row.law}{row.law.word} <NamedLaw name={row.law.name} />{:else}{row.place}{/if}
					</dd>
				{/each}
			</dl>
		{/if}
	</div>
{/each}

<style>
	.succession {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink);
	}
	/* Running text: a comma stays with the name before it where the line wraps. */
	.succession__line {
		margin: 0;
	}
	.succession__line :global(a) {
		color: var(--ink);
	}
	.succession__line :global(a:hover) {
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	.succession__label,
	.succession__status {
		color: var(--ink-2);
	}
	.succession__toggle {
		margin-left: var(--s-2);
	}
	.succession__source {
		margin-left: var(--s-2);
		white-space: nowrap;
		font-size: var(--t-micro);
	}
	.succession__line .succession__source {
		color: var(--ink-2);
	}
	.succession__items {
		list-style: none;
		margin: var(--s-1) 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
	}
	.succession__items :global(a) {
		color: var(--ink);
	}
	.succession__parts {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--s-1) var(--s-4);
		margin: var(--s-2) 0 0;
		font-size: var(--t-micro);
	}
	.succession__parts dt {
		color: var(--ink-2);
	}
	.succession__parts dd {
		margin: 0;
	}
</style>
