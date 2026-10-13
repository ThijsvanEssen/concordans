<script lang="ts">
	// One day of Actueel in the shared timeline, as on the homepage: the day as the heading
	// (rung 2, the timeline is the page), its kinds counted beside it; each line the kind above
	// its headline, the teken of its kind on the line. An item with content of its own opens it
	// in place (RijInhoud), a fold of many items of one kind on one dossier its items; the
	// bron is one step further. Names of persons and dossiers are links, as everywhere. The
	// counts are the whole day's from the summary when it has come; until then, those of the
	// lines loaded.
	import Tijdlijn from '$lib/components/tijdlijn/Tijdlijn.svelte';
	import type { TijdRegel } from '$lib/components/tijdlijn/tijdlijn';
	import RijInhoud from '$lib/components/open/RijInhoud.svelte';
	import CoalitieRegel from '$lib/components/parliamentary/CoalitieRegel.svelte';
	import { inhoudVan } from '$lib/components/open/rij-inhoud';
	import { uniqueBy } from '$lib/util/unique';
	import BronLink from '$lib/bron/BronLink.svelte';
	import SubmitterLine from '$lib/bron/SubmitterLine.svelte';
	import { fromFeed } from '$lib/bron/submitters';
	import {
		KIND_LABEL,
		countLine,
		dayLabel,
		dossierLabel,
		foldTitle,
		publicationCite,
		shortDate,
		summaryCounts,
		titleOf,
		type Day,
		type DaySummary,
		type Fold,
		type FeedItem
	} from './feed';
	import { headlineOf, tekenVanFeed, voteHow, vormVanFeed } from './timeline';

	/** Medeindieners named in a line; the rest are counted. */
	const SUBMITTERS_SHOWN = 2;
	/** The kinds whose persons are its indieners: a motie, an amendement, the vote on one. */
	const SUBMITTED = new Set<FeedItem['kind']>(['Motie', 'Amendement', 'stemming']);

	let {
		day,
		today,
		openId,
		onToggle,
		colorOf,
		ministryName,
		filterHref,
		summary,
		nieuwSinds = null,
		meer
	}: {
		day: Day;
		today: string;
		openId: string | null;
		onToggle: (id: string) => void;
		colorOf: (short: string | null | undefined) => string;
		ministryName: (key: string | null | undefined) => string;
		/** Actueel with one more filter: `{ dossier: '36832' }`. */
		filterHref: (patch: Record<string, string>) => string;
		/** The day as `/api/feed/summary` counts it, under the same filters. */
		summary?: DaySummary;
		/** A followed topic's visit before this one: what is newer says so (Onderwerpen). */
		nieuwSinds?: string | null;
		/** Under the day, in the text column: the next days, on the last day loaded. */
		meer?: import('svelte').Snippet;
	} = $props();

	const counts = $derived(summary ? summaryCounts(summary) : day.counts);

	const nieuw = (date: string | undefined) =>
		nieuwSinds && date && date > nieuwSinds ? ', nieuw' : '';
	const refOf = (i: FeedItem) => `${i.node.collection}/${i.node.key}`;
	const tally = (i: FeedItem) => {
		const t = (i.vote?.tally ?? {}) as Record<string, number>;
		return { voor: t['Voor'] ?? 0, tegen: t['Tegen'] ?? 0 };
	};
	const hoofd = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

	// The items and folds of the day by their line's id, for what a line shows under it.
	const items = $derived(
		new Map(day.entries.flatMap((e) => ('item' in e ? [[e.item.id, e.item] as const] : [])))
	);
	const folds = $derived(
		new Map(day.entries.flatMap((e) => ('fold' in e ? [[e.fold.id, e.fold] as const] : [])))
	);

	const regels = $derived<TijdRegel[]>(
		day.entries.map((entry) => {
			if ('fold' in entry) {
				const f = entry.fold;
				return {
					id: f.id,
					datum: f.items[0]?.date ?? day.date,
					teken: f.kind === 'toezegging' ? 'open' : 'stuk',
					vorm: vormVanFeed({ kind: f.kind }),
					label: `${hoofd(KIND_LABEL[f.kind].many)}${nieuw(f.items[0]?.date)}`,
					zin: foldTitle(f, summary?.votes),
					inhoud: foldInhoud
				};
			}
			const i = entry.item;
			const h = headlineOf(i);
			return {
				id: i.id,
				datum: i.date,
				teken: tekenVanFeed(i, h),
				vorm: h.vorm,
				label: `${h.label}${nieuw(i.date)}`,
				zin: h.title,
				ref: refOf(i),
				heeftTekst: i.has_text,
				bron: i.id,
				groot: h.major,
				onder: itemOnder,
				// What the coalition did on a vote of the Tweede Kamer (API 0.79.45, #546): the
				// same line as under the bill's vote in a dossier's procedure.
				coalitie: i.vote?.coalition
					? { blok: i.vote.coalition, fracties: i.vote.coalition_factions ?? [] }
					: null,
				// Opened, the bron's own content; a kind with none beyond the line does not open,
				// and its title goes to the bron.
				inhoud: inhoudVan(i) ? itemInhoud : null
			};
		})
	);
</script>

<Tijdlijn
	groepen={[{ id: day.date, titel: dayLabel(day.date, today), sub: countLine(counts), regels }]}
	niveau={2}
	datums={false}
	bewaar
	{openId}
	{onToggle}
	{meer}
/>

<!-- Under an item's headline: where it was published, its dossier, its persons, its ministry,
     the law it concerns; then the tally of a vote, the state of a toezegging. -->
{#snippet itemOnder(id: string)}
	{@const i = items.get(id)}
	{#if i}
		<span class="meta">
			{#if i.publication}<span>{publicationCite(i.publication)}</span>{/if}
			{#if i.dossier}
				<BronLink
					ref={{ collection: 'dossiers', key: i.dossier.key, number: i.dossier.number }}
					title={i.dossier.title ?? undefined}>{dossierLabel(i.dossier)}</BronLink
				>
			{/if}
			{#if i.persons.length}{@render persons(i)}{/if}
			{#if i.ministry}<span class="ministry">{ministryName(i.ministry)}</span>{/if}
			{#if i.commencement?.instrument && i.kind !== 'inwerkingtreding'}
				<BronLink ref={`instruments/${i.commencement.instrument.key}`}
					>{i.commencement.instrument.title}</BronLink
				>
			{/if}
			{#if i.judgment?.procedure}<span class="ministry">{i.judgment.procedure}</span>{/if}
			{#each uniqueBy(i.publication?.instruments ?? [], (w) => w.key) as w (w.key)}
				<BronLink ref={`instruments/${w.key}`}>{w.title}</BronLink>
			{/each}
			{#if i.vote}
				<!-- The outcome is in the label; the tally beside it, or how it was decided. -->
				{@const t = tally(i)}
				{@const how = voteHow(i)}
				{#if t.voor + t.tegen}<span>{`${t.voor} voor, ${t.tegen} tegen`}</span>{:else if how}<span
						>{how}</span
					>{/if}
			{:else if i.commitment}
				<span
					>{i.commitment.status ?? ''}{i.commitment.expected_resolution
						? `, verwacht ${shortDate(i.commitment.expected_resolution)}`
						: ''}</span
				>
			{:else if i.commencement}
				<span
					>{i.commencement.changed_articles ?? 0} van {i.commencement.article_count ?? 0} artikelen</span
				>
			{/if}
		</span>
	{/if}
{/snippet}

{#snippet itemInhoud(id: string)}
	{@const i = items.get(id)}
	{#if i}<RijInhoud item={i} />{/if}
{/snippet}

<!-- A fold opened: its items, each a bron, then the ways to all of them in Actueel. -->
{#snippet foldInhoud(id: string)}
	{@const f = folds.get(id)}
	{#if f}{@render foldItems(f)}{/if}
{/snippet}

{#snippet foldItems(f: Fold)}
	<ul class="fold-items">
		{#each f.items as i (i.id)}
			<li>
				<BronLink ref={refOf(i)} class="fold-title">{titleOf(i)}</BronLink>
				{#if i.persons.length || i.vote}
					<span class="meta"
						>{#if i.vote}<span class="outcome" class:outcome--failed={!i.vote.passed}
								>{i.vote.passed ? 'Aangenomen' : 'Verworpen'}</span
							>{/if}{@render persons(i)}</span
					>
				{/if}
				{#if i.vote?.coalition}
					<CoalitieRegel coalitie={i.vote.coalition} fracties={i.vote.coalition_factions ?? []} />
				{/if}
			</li>
		{/each}
	</ul>
	<p class="links">
		{#if f.dossier}
			<BronLink ref={{ collection: 'dossiers', key: f.dossier.key, number: f.dossier.number }}
				>{dossierLabel(f.dossier)}</BronLink
			>
			<a href={filterHref({ dossier: f.dossier.number })}>Alles over dit dossier in Actueel</a>
		{:else}
			{@const date = f.items[0]?.date ?? ''}
			<a href={filterHref({ soort: 'stemming', van: date, tot: date })}
				>Alle stemmingen van deze dag</a
			>
		{/if}
	</p>
{/snippet}

<!-- The persons of an item: names as links, the party a bar, the rest grey. -->
{#snippet persons(i: FeedItem)}
	{@const submitters = SUBMITTED.has(i.kind) ? fromFeed(i.persons) : []}
	{#if submitters.length}
		<!-- A paper of the Kamer, or the vote on one: who submitted it, with their fractie. -->
		<SubmitterLine {submitters} max={SUBMITTERS_SHOWN} />
	{:else}
		{@render signers(i)}
	{/if}
{/snippet}

<!-- The bewindspersonen of a brief or a toezegging: names as links, the party a bar. -->
{#snippet signers(i: FeedItem)}
	{#each i.persons
		.filter((p) => p.role !== 'medeindiener')
		.slice(0, 2) as p, n (`${p.key ?? p.name}/${n}`)}
		<span class="person" style:--party={colorOf(p.faction?.short)}
			>{#if p.key}<BronLink ref={`members/${p.key}`} preview={false}>{p.name}</BronLink
				>{:else}{p.name}{/if}{#if p.faction?.short}<span class="faction"
					>{` ${p.faction.short}`}</span
				>{/if}</span
		>
	{/each}
	{#if i.persons.length > 2 || i.persons.some((p) => p.role === 'medeindiener')}
		{@const rest =
			i.persons.length - Math.min(2, i.persons.filter((p) => p.role !== 'medeindiener').length)}
		{#if rest > 0}<span class="faction">en {rest} {rest === 1 ? 'ander' : 'anderen'}</span>{/if}
	{/if}
{/snippet}

<style>
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-3);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	.meta :global(a) {
		color: var(--ink-2);
		text-decoration: none;
	}
	.meta :global(a:hover) {
		color: var(--ink);
		text-decoration: underline;
	}
	/* The links in a line's meta a finger can hit: the shared target of AppShell (.raakvlak),
	   on a touch screen only. */
	@media (pointer: coarse) {
		.meta :global(a) {
			position: relative;
		}
		.meta :global(a::after) {
			content: '';
			position: absolute;
			inset: calc(-1 * var(--s-2)) calc(-1 * var(--s-1));
		}
	}
	.person {
		padding-left: var(--s-1);
		border-left: 3px solid var(--party);
	}
	.faction,
	.ministry {
		color: var(--ink-3);
	}
	.outcome {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	/* What deviates stands out: a rejected vote in the accent. */
	.outcome--failed {
		color: var(--uitkomst-nee);
	}

	.fold-items {
		list-style: none;
		margin: 0 0 var(--s-2);
		padding: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
	}
	.fold-items li {
		padding: var(--s-1) 0;
		border-bottom: 1px solid var(--rule);
	}
	.fold-items :global(a.fold-title) {
		display: block;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
		text-decoration: none;
	}
	.fold-items :global(a.fold-title:hover) {
		text-decoration: underline;
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-4);
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
	}
	.links a,
	.links :global(a) {
		color: var(--ink);
		text-decoration: none;
		border-bottom: 1px solid var(--rule-strong);
	}
	.links a:hover,
	.links :global(a:hover) {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
</style>
