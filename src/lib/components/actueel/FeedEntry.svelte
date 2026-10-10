<script lang="ts">
	import Picto from '$lib/components/ui/Picto.svelte';
	import { uniqueBy } from '$lib/util/unique';
	// One line of Actueel: an item, or a fold of many items of one kind on one dossier. The
	// title of an item links to the bron; the rest of the line opens its details beneath it.
	// Names of persons and dossiers are links, as everywhere.
	import BronLink from '$lib/bron/BronLink.svelte';
	import { bronHref, indexHref } from '$lib/bron/href';
	import IndexRow from '$lib/components/explore/index/IndexRow.svelte';
	import {
		KIND_LABEL,
		dossierLabel,
		foldTitle,
		publicationCite,
		shortDate,
		titleOf,
		type Entry,
		type FeedItem,
		type VoteCount
	} from './feed';
	import { headlineOf, voteHow, vormVanFeed } from './timeline';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { langeDatum } from '$lib/text/datum';
	import SubmitterLine from '$lib/bron/SubmitterLine.svelte';
	import { bewindspersoonVan, fromFeed } from '$lib/bron/submitters';

	/** Medeindieners named in a row; the rest are counted. */
	const SUBMITTERS_SHOWN = 2;
	/** The kinds whose persons are its indieners: a motie, an amendement, the vote on one. */
	const SUBMITTED = new Set<FeedItem['kind']>(['Motie', 'Amendement', 'stemming']);

	let {
		entry,
		openId,
		onToggle,
		colorOf,
		ministryName,
		filterHref,
		votes,
		nieuwSinds = null
	}: {
		entry: Entry;
		openId: string | null;
		onToggle: (id: string) => void;
		colorOf: (short: string | null | undefined) => string;
		ministryName: (key: string | null | undefined) => string;
		/** Actueel with one more filter: `{ dossier: '36832' }`. */
		filterHref: (patch: Record<string, string>) => string;
		/** The day's votes counted by the summary: the fold of votes names them all. */
		votes?: VoteCount[];
		/** A followed topic's visit before this one: what is newer says so (Onderwerpen). */
		nieuwSinds?: string | null;
	} = $props();

	const nieuw = (date: string | undefined) =>
		nieuwSinds && date && date > nieuwSinds ? ', nieuw' : '';
	const refOf = (i: FeedItem) => `${i.node.collection}/${i.node.key}`;
	const tally = (i: FeedItem) => {
		const t = (i.vote?.tally ?? {}) as Record<string, number>;
		return { voor: t['Voor'] ?? 0, tegen: t['Tegen'] ?? 0 };
	};
</script>

{#if 'fold' in entry}
	{@const f = entry.fold}
	{@const many = KIND_LABEL[f.kind].many}
	<IndexRow
		bron={f.id}
		title={foldTitle(f, votes)}
		open={openId === f.id}
		onToggle={() => onToggle(f.id)}
	>
		{#snippet lead()}
			<span class="kind"
				><KindGlyph vorm={vormVanFeed({ kind: f.kind })} size={11} />
				{many.charAt(0).toUpperCase()}{many.slice(1)}{nieuw(f.items[0]?.date)}</span
			>
		{/snippet}
		{#snippet detail()}
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
					</li>
				{/each}
			</ul>
			<p class="links">
				{#if f.dossier}
					<BronLink ref={{ collection: 'dossiers', key: f.dossier.key, number: f.dossier.number }}
						>Dossier {dossierLabel(f.dossier)}</BronLink
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
	</IndexRow>
{:else}
	{@const i = entry.item}
	{@const h = headlineOf(i)}
	<IndexRow
		bron={i.id}
		title={h.title}
		href={bronHref(refOf(i), { keepMode: false, mode: 'graph' })}
		open={openId === i.id}
		onToggle={() => onToggle(i.id)}
		emphasis={h.major}
	>
		{#snippet lead()}
			<span class="kind" class:kind--failed={h.failed}
				><KindGlyph vorm={h.vorm} size={11} /> {h.label}{nieuw(i.date)}</span
			>
			{#if i.publication}<span class="kind-sub">{publicationCite(i.publication)}</span>{/if}
		{/snippet}
		{#snippet body()}
			<span class="meta">
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
			</span>
		{/snippet}
		{#snippet aside()}
			{#if i.vote}
				<!-- The outcome is in the label; the tally beside it, or how it was decided. -->
				{@const t = tally(i)}
				{@const how = voteHow(i)}
				{#if t.voor + t.tegen}<span class="aside-note">{`${t.voor} voor, ${t.tegen} tegen`}</span
					>{:else if how}<span class="aside-note">{how}</span>{/if}
			{:else if i.commitment}
				<span class="aside-note"
					>{i.commitment.status ?? ''}{i.commitment.expected_resolution
						? `, verwacht ${shortDate(i.commitment.expected_resolution)}`
						: ''}</span
				>
			{:else if i.commencement}
				<span class="aside-note"
					>{i.commencement.changed_articles ?? 0} van {i.commencement.article_count ?? 0} artikelen</span
				>
			{/if}
		{/snippet}
		{#snippet detail()}
			{#if i.judgment}
				<!-- Published on the day of the row; decided earlier, as the court dates it. -->
				<p class="summary">
					Gepubliceerd op {langeDatum(i.date)}{i.judgment.decided_on
						? `, beslist op ${langeDatum(i.judgment.decided_on)}`
						: ''}.
				</p>
			{/if}
			{#if i.summary && i.kind !== 'toezegging' && !i.vote}
				<p class="summary">{i.summary}</p>
			{/if}
			{#if i.persons.length}
				<ul class="people">
					{#each i.persons as p, n (`${p.key ?? p.name}/${n}`)}
						<li>
							{#if p.key}<BronLink ref={`members/${p.key}`}>{p.name}</BronLink>{:else}{p.name}{/if}
							<span class="role"
								>{p.role === 'medeindiener' ? 'medeindiener' : p.role}{p.faction?.short
									? `, ${p.faction.short}`
									: ''}</span
							>
						</li>
					{/each}
				</ul>
			{/if}
			<!-- The same two buttons as every opened row (OpenRij); the rest as links. -->
			<p class="acts">
				<a
					class="btn is-groot is-primary"
					href={bronHref(refOf(i), { keepMode: false, mode: 'read' })}
					><Picto naam="tekst" size={13} />Lees</a
				>
				<a class="btn is-groot" href={bronHref(refOf(i), { keepMode: false, mode: 'graph' })}
					><Picto naam="netwerk" size={13} />In het netwerk</a
				>
			</p>
			<p class="links">
				{#if i.official_url}<a href={i.official_url} rel="external"
						>{i.judgment ? 'Op rechtspraak.nl' : 'Officiële publicatie'}</a
					>{/if}
				{#if i.tk_url}<a href={i.tk_url} rel="external">Op tweedekamer.nl</a>{/if}
				{#if i.dossier}<a href={filterHref({ dossier: i.dossier.number })}
						>Alles over dit dossier in Actueel</a
					>{/if}
				{#if i.kind === 'toezegging' && bewindspersoonVan(i.persons)?.key}
					{@const wie = bewindspersoonVan(i.persons)!}
					<a href={indexHref('commitments', { member: wie.key! })}
						>Alle toezeggingen van {wie.name}</a
					>
				{/if}
			</p>
		{/snippet}
	</IndexRow>
{/if}

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
	/* The kind by weight, as on the homepage; a vote lost in the accent. */
	.kind {
		display: block;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
	}
	.kind--failed {
		color: var(--accent);
	}
	.kind-sub {
		display: block;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-3);
		margin-top: var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	.meta :global(a) {
		color: var(--ink-2);
		text-decoration: none;
	}
	.meta :global(a:hover) {
		color: var(--accent);
		text-decoration: underline;
	}
	.person {
		padding-left: var(--s-1);
		border-left: 3px solid var(--party);
	}
	.faction,
	.ministry,
	.role {
		color: var(--ink-3);
	}
	.role {
		margin-left: var(--s-1);
	}
	.outcome {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	/* What deviates stands out: a rejected vote in the accent. */
	.outcome--failed {
		color: var(--accent);
	}
	.aside-note {
		display: block;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}

	.summary {
		margin: var(--s-2) 0;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: 1.5;
		max-width: 68ch;
	}
	.people,
	.fold-items {
		list-style: none;
		margin: var(--s-2) 0;
		padding: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
	}
	.people li,
	.fold-items li {
		padding: var(--s-1) 0;
	}
	.fold-items li {
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
	.acts {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
		margin: var(--s-3) 0 0;
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-4);
		margin: var(--s-2) 0 var(--s-3);
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
		color: var(--accent);
	}
</style>
