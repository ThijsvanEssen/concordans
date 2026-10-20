<script lang="ts">
	// One line under the head of an article in a recodification (`TRANSPOSED_TO`): on the
	// old article the article of the new law that takes its place, In het nieuwe recht; on the
	// new one the article whose place it takes, Voorheen. A click opens it where the reader
	// is; the leden fold out under the line; Vergelijk opens the old text beside the new in
	// place (`?vergelijk=`); the transposition table is one step further.
	import { page } from '$app/state';
	import { withParams } from '$lib/util/address';
	import BronLink from '$lib/bron/BronLink.svelte';
	import { bronHref } from '$lib/bron/href';
	import Caret from '$lib/components/ui/Caret.svelte';
	import {
		partRows,
		successionName,
		successionSources,
		successionStatus,
		type Direction,
		type OwnLaw,
		type Succession
	} from './succession';

	let {
		successors = [],
		predecessors = [],
		own
	}: {
		successors?: readonly Succession[];
		predecessors?: readonly Succession[];
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
			.filter(([, list]) => list.length > 0)
			.map(([direction, list]) => {
				const items = list.map((s) => ({
					s,
					name: successionName(s, own, direction),
					status: successionStatus(s)
				}));
				const statuses = new Set(items.map((i) => i.status));
				// One law, one status: said once after the names.
				const shared = statuses.size === 1 ? items[0].status : null;
				const rows = items.flatMap((i) =>
					partRows(i.s.parts).map((r) => ({
						old: direction === 'old' && items.length > 1 ? `${i.name}, ${r.old}` : r.old,
						place: r.place
					}))
				);
				return {
					direction,
					items,
					shared,
					perItem: statuses.size > 1,
					rows,
					sources: successionSources(list)
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
		class="succession__toggle"
		href={compareHref(id)}
		data-sveltekit-noscroll
		aria-expanded={comparing === id}>Vergelijk</a
	>
{/snippet}

{#each lines as line (line.direction)}
	{@const open = unfolded === line.direction}
	<div class="succession">
		<p class="succession__line">
			<span class="succession__label">{LABEL[line.direction]}:</span>
			{#each line.items as item, i (item.s.article.id)}{#if i > 0},
				{/if}<BronLink ref={item.s.article.id} href={bronHref(item.s.article.id)}
					>{item.name}</BronLink
				>{#if line.perItem && item.status}<span class="succession__status"
						>&nbsp;({item.status})</span
					>{/if}{#if line.items.length > 1}{@render compare(
						item.s.article.id
					)}{/if}{/each}{#if line.shared}<span class="succession__status">, {line.shared}</span
				>{/if}
			{#if line.items.length === 1}{@render compare(line.items[0].s.article.id)}{/if}
			{#if line.rows.length > 0}
				<button
					type="button"
					class="succession__toggle"
					aria-expanded={open}
					onclick={() => (unfolded = open ? null : line.direction)}>Leden<Caret {open} /></button
				>
			{/if}
			{#each line.sources as url (url)}
				<a class="succession__source" href={url} target="_blank" rel="noopener noreferrer"
					>Transponeringstabel ↗</a
				>
			{/each}
		</p>
		{#if open}
			<dl class="succession__parts">
				{#each line.rows as row (`${row.old}|${row.place}`)}
					<dt>{row.old}</dt>
					<dd>{row.place}</dd>
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
		display: inline-flex;
		align-items: center;
		gap: var(--s-1);
		margin-left: var(--s-2);
		padding: 0;
		border: 0;
		background: none;
		font-family: var(--font-ui);
		font-size: var(--t-ui-micro);
		font-weight: 500;
		color: var(--ink);
		cursor: pointer;
	}
	.succession__toggle[aria-expanded='true'] {
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	.succession__toggle:hover {
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	.succession__source {
		margin-left: var(--s-2);
		white-space: nowrap;
		font-size: var(--t-micro);
	}
	.succession__line .succession__source {
		color: var(--ink-2);
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
