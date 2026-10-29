<script lang="ts">
	// Eén kopje van de dagrij: een rechtsgebied met zijn aantal, dat opent op de plaats zelf en
	// dan de eerste uitspraken toont (lui opgehaald), met "Alle N" voor de rest.
	import { getFeed } from '$lib/api/feed';
	import { report } from '$lib/api/errors';
	import { untrack } from 'svelte';
	import BronLink from '$lib/bron/BronLink.svelte';
	import AllLink from '$lib/components/ui/AlleN.svelte';
	import Caret from '$lib/components/ui/Caret.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { load } from '$lib/util/load.svelte';
	import { formatCount } from '$lib/text/getal';
	import { headlineOf } from './home-stream';
	import type { FeedItem } from './feed';
	import { FIRST_JUDGMENTS, PAGE_JUDGMENTS, areaQuery, type LowerArea } from './lower-courts';

	let {
		date,
		area,
		label,
		opened = false
	}: { date: string; area: LowerArea; label: string; opened?: boolean } = $props();

	let open = $state(untrack(() => opened));
	/** "Alle N" is open: the judgments of the area in pages, not the first few. */
	let showAll = $state(false);
	const uid = $props.id();

	const firstPage = load(
		() => (open ? `${date}|${area.value}|${showAll}` : null),
		(key, signal) =>
			key
				? getFeed(areaQuery(date, area, showAll ? PAGE_JUDGMENTS : FIRST_JUDGMENTS), { signal })
				: Promise.resolve(null),
		'Actueel uitspraken per rechtsgebied'
	);

	// The pages after the first of "Alle N", added under it; a new key starts over.
	let more = $state.raw<FeedItem[]>([]);
	let cursor = $state<string | null>(null);
	let loading = $state(false);
	let failed = $state(false);
	$effect(() => {
		const s = firstPage.state;
		more = [];
		failed = false;
		cursor = s.status === 'ready' ? (s.data?.next_cursor ?? null) : null;
	});

	async function loadNext() {
		if (!cursor || loading) return;
		loading = true;
		failed = false;
		try {
			const r = await getFeed(areaQuery(date, area, PAGE_JUDGMENTS, cursor));
			more = [...more, ...r.items];
			cursor = r.next_cursor ?? null;
		} catch (e) {
			report('Actueel uitspraken per rechtsgebied', e);
			failed = true;
		} finally {
			loading = false;
		}
	}

	let listEl = $state<Element | null>(null);
	const refOf = (i: FeedItem) => `${i.node.collection}/${i.node.key}`;
</script>

<section class="group" class:is-open={open}>
	<button
		type="button"
		class="head"
		aria-expanded={open}
		aria-controls={open ? `${uid}-listEl` : undefined}
		onclick={() => (open = !open)}
	>
		<span class="name">{label}<Caret {open} /></span>
		<span class="count">{formatCount(area.count)}</span>
	</button>
	{#if open}
		<div class="listEl" id="{uid}-listEl">
			<LoadState state={firstPage.state} what="De uitspraken" plural retry={firstPage.retry}>
				{#snippet children(page)}
					{@const items = [...(page?.items ?? []), ...more]}
					<ul class="judgments" bind:this={listEl}>
						{#each items as i (i.id)}
							{@const h = headlineOf(i)}
							<li>
								{#if i.judgment?.court}<span class="court">{i.judgment.court}</span>{/if}
								<BronLink ref={refOf(i)} class="title">{h.title}</BronLink>
								{#if i.judgment?.outcome || i.judgment?.procedure}
									<span class="meta"
										>{#if i.judgment.outcome}<span>{i.judgment.outcome}</span
											>{/if}{#if i.judgment.procedure}<span>{i.judgment.procedure}</span>{/if}</span
									>
								{/if}
							</li>
						{/each}
					</ul>
					{#if showAll}
						{#if cursor || loading || failed}
							<p class="onward">
								<AllLink
									volgende
									noun="uitspraken"
									stap={PAGE_JUDGMENTS}
									rest={Math.max(area.count - items.length, 0)}
									laden={loading}
									opnieuw={failed}
									loaded={items.length}
									list={listEl}
									onclick={loadNext}
								/>
							</p>
						{/if}
						<p class="onward">
							<AllLink noun="uitspraken" open onclick={() => (showAll = false)} />
						</p>
					{:else if area.count > FIRST_JUDGMENTS}
						<p class="onward">
							<AllLink aantal={area.count} noun="uitspraken" onclick={() => (showAll = true)} />
						</p>
					{/if}
				{/snippet}
			</LoadState>
		</div>
	{/if}
</section>

<style>
	.group {
		border-top: 1px solid var(--rule);
		padding: var(--s-1) 0;
	}
	.group:first-child {
		border-top: 0;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-3);
		width: 100%;
		min-height: var(--veld-h-raak);
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-weight: 600;
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}
	.head:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}
	.head:hover .name {
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
	}
	.count {
		font-weight: 400;
		color: var(--ink-3);
	}
	.listEl {
		padding-bottom: var(--s-2);
	}
	.judgments {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}
	.judgments li {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		padding: var(--s-2) 0;
		border-top: 1px solid var(--rule);
	}
	.judgments li:first-child {
		border-top: 0;
	}
	.court {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-2);
	}
	.judgments :global(a.title) {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
		text-decoration: none;
	}
	.judgments :global(a.title:hover) {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-3);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	.onward {
		margin: var(--s-1) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
	}
</style>
