<script lang="ts">
	// Under the text in the Zijpaneel, one article's stand as its page has it in the feitenrij:
	// Geldigheid, Verbonden and the bills that touch it, a row per fact with the label at the left
	// and the value at the right. What the data lacks says so. Each value leads to the article's
	// page, one step further: the text of a day, its versions, a soort in Verbonden. Its counts
	// are those of Verbonden on that page: one source, whose answers that page then finds ready.
	import { onDestroy } from 'svelte';
	import { getNode } from '$lib/api/records';
	import type { GraphNode } from '$lib/graph/types';
	import {
		LOAD_FAILED,
		createVerbondenSource,
		type VerbondenState
	} from '$lib/verbonden/data-source';
	import { kindsTotal } from '$lib/verbonden/summary';
	import { panelKinds, panelSettled } from '$lib/verbonden/view';
	import { goto } from '$app/navigation';
	import { inView } from '$lib/actions/in-view';
	import { bronHref } from '$lib/bron/href';
	import WholeLawReaderPeildatum from '$lib/components/explore/WholeLawReaderPeildatum.svelte';
	import Feiten from '$lib/components/ui/Feiten.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import Validity from '$lib/components/ui/Validity.svelte';
	import Veld from '$lib/components/ui/Veld.svelte';
	import { lacks } from '$lib/text/coverage';
	import { langeDatum } from '$lib/text/datum';
	import { formatCount } from '$lib/text/getal';
	import { statusOf } from '$lib/text/validity';
	import { load } from '$lib/util/load.svelte';
	import { articleBills, articleStand, kindFilter } from './article-meta';
	import type { ArticleTextData } from './blocks';

	let { article, path }: { article: ArticleTextData; path: string } = $props();

	let seen = $state(false);
	const standOf = load(
		() => (seen ? article.key : null),
		(key, signal) => (key ? articleStand(article, signal) : Promise.resolve(null)),
		'Zijpaneel, geldigheid'
	);
	const bills = load(
		() => (seen ? article.key : null),
		(key) => (key ? articleBills(article) : Promise.resolve([])),
		'Zijpaneel, wetsvoorstellen'
	);

	const source = createVerbondenSource({ nodeResponse: getNode });
	let verbonden = $state<VerbondenState | null>(null);
	source.subscribe((v) => (verbonden = v));
	onDestroy(() => source.destroy());
	$effect(() => {
		if (seen)
			source.load({ id: article.id, key: article.key, collection: 'articles' } as GraphNode);
	});
	const kinds = $derived(
		verbonden && panelSettled(verbonden)
			? panelKinds(verbonden, 'articles')
					.filter((k) => k.count > 0)
					.toSorted((x, y) => y.count - x.count)
			: []
	);

	const status = $derived(statusOf(article.validity));
	const stand = $derived(status?.text ?? (article.validity ? 'Geldend recht' : null));
	const host = (url: string) => new URL(url).hostname.replace(/^www\./, '');
	const choose = (day: string) => goto(day ? `${path}?peildatum=${day}` : path);
	const versionsHref = (wordings: { from: string | null }[]) =>
		`${path}?versies=${wordings.at(-2)?.from ?? ''}..${wordings.at(-1)?.from ?? ''}`;
</script>

<section class="meta" aria-label="Gegevens van het artikel" use:inView={() => (seen = true)}>
	{#if seen}
		<LoadState state={standOf.state} what="De geldigheid" retry={standOf.retry} form="block">
			{#snippet children(data)}
				<h3 class="kop">Geldigheid</h3>
				<Feiten rijen>
					<Veld label="Stand" value={stand} nodig>
						{#if status}<Validity validity={article.validity} />{:else}{stand}{/if}
					</Veld>
					{#if !status}
						<Veld label="Tekst sinds" value={data?.since ? langeDatum(data.since) : null} nodig />
					{/if}
					{#if data?.lawDays.length}
						<WholeLawReaderPeildatum asFact versions={data.lawDays} peildatum={null} {choose} />
					{/if}
					<Veld label="Tekstversies" value={data?.wordings.length || null} nodig>
						{#if data && data.wordings.length > 1}
							<a href={versionsHref(data.wordings)} data-sveltekit-noscroll
								>{formatCount(data.wordings.length)}</a
							>
						{:else}
							{formatCount(data?.wordings.length ?? 0)}
						{/if}
					</Veld>
					<Veld label="Officiële tekst" value={data?.officialUrl} nodig>
						{#if data?.officialUrl}
							<a href={data.officialUrl} target="_blank" rel="noopener">{host(data.officialUrl)}</a>
						{/if}
					</Veld>
				</Feiten>
			{/snippet}
		</LoadState>
		{#if verbonden?.failed}
			<LoadState state={LOAD_FAILED} what="De verbindingen" plural retry={() => source.reload()} />
		{:else if kinds.length}
			<h3 class="kop kop--tel">
				<span>Verbonden</span><span class="tel">{formatCount(kindsTotal(kinds))}</span>
			</h3>
			<Feiten rijen>
				{#each kinds as k (k.id)}
					<Veld label={k.label} value={k.count}>
						<a href="{path}?bronnen={kindFilter(k.id)}" data-sveltekit-noscroll
							>{formatCount(k.count)}</a
						>
					</Veld>
				{/each}
			</Feiten>
		{/if}
		<LoadState
			state={bills.state}
			what="De wetsvoorstellen"
			plural
			retry={bills.retry}
			form="block"
		>
			{#snippet children(list)}
				{#if list?.length}
					<h3 class="kop kop--tel">
						<span>Wetsvoorstellen die dit artikel raken</span><span class="tel"
							>{formatCount(list.length)}</span
						>
					</h3>
					<ul class="bills">
						{#each list as bill, i (i)}
							<li>
								{#if bill.id}
									<a href={bronHref(bill.id)} class:leeg={!bill.title}
										>{bill.title ?? lacks('titel')}</a
									>
								{:else}
									<span class:leeg={!bill.title}>{bill.title ?? lacks('titel')}</span>
								{/if}
								{#if bill.line}<span class="regel">{bill.line}</span>{/if}
							</li>
						{/each}
					</ul>
				{/if}
			{/snippet}
		</LoadState>
	{/if}
</section>

<style>
	.meta {
		/* Its room while it comes, so the panel's text does not move at the end of the scroll. */
		min-height: var(--s-5);
		margin-top: var(--s-5);
		padding-top: var(--s-3);
		border-top: 1px solid var(--rule);
		font: var(--t-meta) / var(--lh-snug) var(--font-serif);
	}
	.kop {
		margin: 0 0 var(--s-2);
		font: 600 var(--t-meta) / var(--lh-snug) var(--font-serif);
		color: var(--ink);
	}
	.kop--tel {
		display: flex;
		justify-content: space-between;
		gap: var(--s-3);
		margin-top: var(--s-4);
	}
	.tel {
		font-weight: 400;
		color: var(--ink-2);
	}
	.meta a {
		color: inherit;
		text-decoration-line: underline;
		text-underline-offset: 3px;
		text-decoration-thickness: 1px;
	}
	.bills {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--s-2);
	}
	.bills li {
		display: grid;
	}
	.regel {
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.meta a.leeg,
	.leeg {
		color: var(--ink-3);
	}
	/* A finger's target. */
	@media (pointer: coarse), (max-width: 768px) {
		.meta a {
			display: inline-flex;
			align-items: center;
			min-height: var(--veld-h-raak);
		}
	}
</style>
