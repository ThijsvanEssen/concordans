<script lang="ts">
	import { votesSentence } from '$lib/components/parliamentary/stemming';
	import { capitalize, count } from '$lib/text/words';
	import { korteDatum } from '$lib/text/datum';
	// One day of Actueel in the shared timeline, as on the homepage: the day as the heading
	// (rung 2, the timeline is the page), its kinds counted beside it; each line the kind above
	// its headline, the teken of its kind on the line. An item with content of its own opens it
	// in place (RijInhoud), a fold of many items of one kind on one dossier its items; the
	// bron is one step further. Names of persons and dossiers are links, as everywhere. The
	// counts are the whole day's from the summary when it has come; until then, those of the
	// lines loaded. The words of a followed topic or a search (`termen`) are marked where the
	// row shows them; where it does not, a line under the headline says where they are
	// (`In dossier: …`): the reason the row is there, as the API found it (`matched`). Of a
	// followed law, how the row is tied to it (`via`). What a row is tied to stands under it
	// without a click (verband.ts): the laws of a publication, the publication of a new
	// version, the motions a letter answers, the articles an amendment changes.
	import Tijdlijn from '$lib/components/tijdlijn/Tijdlijn.svelte';
	import type { TijdRegel } from '$lib/components/tijdlijn/tijdlijn';
	import RijInhoud from '$lib/components/open/RijInhoud.svelte';
	import CoalitieRegel from '$lib/components/parliamentary/CoalitieRegel.svelte';
	import type { CoalitieBij } from '$lib/components/parliamentary/coalitie';
	import { inhoudVan } from '$lib/components/open/rij-inhoud';
	import BronLink from '$lib/bron/BronLink.svelte';
	import SubmitterLine from '$lib/bron/SubmitterLine.svelte';
	import { fromFeed } from '$lib/bron/submitters';
	import {
		KIND_LABEL,
		countLine,
		dayLabel,
		foldTitle,
		publicationCite,
		summaryCounts,
		titleOf,
		type Day,
		type DaySummary,
		type Fold,
		type FeedItem
	} from './feed';
	import { dossierLabel } from '$lib/bron/dossier-naam';
	import { headlineOf, voteHow, vormVanFeed } from './home-stream';
	import { getoondOnder, plekVan, termenVan, type Plek } from './match-place';
	import {
		inwerkingVerbanden,
		publicatieVerbanden,
		relatieVerbanden,
		viaRegel,
		type Gevolgd,
		type Verband
	} from './verband';
	import { markeer } from '$lib/text/treffer';
	import Markering from '$lib/components/ui/Markering.svelte';
	import { ministryName } from '$lib/components/explore/index/ministries.svelte';
	import { partyColor } from '$lib/components/explore/party-color.svelte';

	/** Medeindieners named in a line; the rest are counted. */
	const SUBMITTERS_SHOWN = 2;
	/** The kinds whose persons are its indieners: a motie, an amendement, the vote on one. */
	const SUBMITTED = new Set<FeedItem['kind']>(['Motie', 'Amendement', 'stemming']);

	let {
		day,
		today,
		openId,
		onToggle,
		filterHref,
		summary,
		nieuwSinds = null,
		termen,
		wet = null,
		meer
	}: {
		day: Day;
		today: string;
		openId: string | null;
		onToggle: (id: string) => void;
		/** Actueel with one more filter: `{ dossier: '36832' }`. */
		filterHref: (patch: Record<string, string>) => string;
		/** The day as `/api/feed/summary` counts it, under the same filters. */
		summary?: DaySummary;
		/** A followed topic's visit before this one: what is newer says so (Onderwerpen). */
		nieuwSinds?: string | null;
		/** The words the feed was asked for (`q`): a followed topic's, Actueel's search; or none. */
		termen: readonly string[];
		/** The law followed: how each row is tied to it (`via`), where the row does not say it. */
		wet?: Gevolgd | null;
		/** Under the day, in the text column: the next days, on the last day loaded. */
		meer?: import('svelte').Snippet;
	} = $props();

	/** A person's fractie colour; a person without a fractie in a quiet rule. */
	const colorOf = (short: string | null | undefined) =>
		short ? partyColor(short) : 'var(--rule-strong)';

	const counts = $derived(summary ? summaryCounts(summary) : day.counts);

	const nieuw = (date: string | undefined) =>
		nieuwSinds && date && date > nieuwSinds ? ', nieuw' : '';
	const refOf = (i: FeedItem) => `${i.node.collection}/${i.node.key}`;

	// The items and folds of the day by their line's id, for what a line shows under it.
	const items = $derived(
		new Map(day.entries.flatMap((e) => ('item' in e ? [[e.item.id, e.item] as const] : [])))
	);
	const folds = $derived(
		new Map(day.entries.flatMap((e) => ('fold' in e ? [[e.fold.id, e.fold] as const] : [])))
	);

	/**
	 * Where the words are, per line's id, where the line does not show them: of a fold of one
	 * dossier its title, once for the fold; of an item its title or its dossier's.
	 */
	const plekken = $derived(
		new Map(
			day.entries.flatMap((entry): [string, Plek][] => {
				if ('fold' in entry) {
					const f = entry.fold;
					const p = f.dossier
						? plekVan(termen, { kind: f.kind, title: null, summary: null, dossier: f.dossier }, [
								foldTitle(f, summary?.votes)
							])
						: null;
					return p ? [[f.id, p]] : [];
				}
				const i = entry.item;
				const p = plekVan(termen, i, [headlineOf(i).title, ...getoondOnder(i)]);
				return p ? [[i.id, p]] : [];
			})
		)
	);

	const regels = $derived<TijdRegel<CoalitieBij>[]>(
		day.entries.map((entry) => {
			if ('fold' in entry) {
				const f = entry.fold;
				const zin = foldTitle(f, summary?.votes);
				return {
					id: f.id,
					datum: f.items[0]?.date ?? day.date,
					teken: f.kind === 'toezegging' ? 'open' : 'stuk',
					vorm: vormVanFeed({ kind: f.kind }),
					label: `${capitalize(KIND_LABEL[f.kind].many)}${nieuw(f.items[0]?.date)}`,
					zin,
					zinDelen: markeer(termen, zin),
					onder: plekken.has(f.id) ? foldOnder : null,
					inhoud: foldInhoud
				};
			}
			const i = entry.item;
			const h = headlineOf(i);
			return {
				id: i.id,
				datum: i.date,
				teken: h.teken,
				vorm: h.vorm,
				label: `${h.label}${nieuw(i.date)}`,
				zin: h.title,
				zinDelen: markeer(termenVan(termen, i), h.title),
				ref: refOf(i),
				heeftTekst: i.has_text,
				bron: i.id,
				groot: h.major,
				onder: itemOnder,
				// What the coalition did on a vote of the Tweede Kamer (API 0.79.45, #546): the
				// same line as under the bill's vote in a dossier's procedure.
				bij: i.vote?.coalition
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
	{onderRegel}
/>

{#snippet onderRegel(c: CoalitieBij)}<CoalitieRegel
		coalitie={c.blok}
		fracties={c.fracties}
	/>{/snippet}

<!-- Under an item's headline: where it was published, its dossier, its persons, its ministry,
     the law it concerns; then the tally of a vote, the state of a toezegging. -->
{#snippet itemOnder(id: string)}
	{@const i = items.get(id)}
	{#if i}
		{@const woorden = termenVan(termen, i)}
		{@const via = viaRegel(i, wet)}
		{@const cited = i.publication ? publicationCite(i.publication) : null}
		<span class="meta">
			{@render plekRegel(id)}
			{#if via}<span class="plek">{via}</span>{/if}
			<!-- The citation where the headline is another name; a headline that is it says it once. -->
			{#if cited && cited !== titleOf(i)}<span>{cited}</span>{/if}
			{#if i.dossier}
				<BronLink
					ref={{ collection: 'dossiers', key: i.dossier.key, number: i.dossier.number }}
					title={i.dossier.title ?? undefined}
					>{@render merk(dossierLabel(i.dossier), woorden)}</BronLink
				>
			{/if}
			{#if i.persons.length}{@render persons(i)}{/if}
			{#if i.ministry}<span class="ministry">{ministryName(i.ministry)}</span>{/if}
			{#if i.commencement?.instrument && i.kind !== 'inwerkingtreding'}
				<BronLink ref={`instruments/${i.commencement.instrument.key}`}
					>{@render merk(i.commencement.instrument.title, woorden)}</BronLink
				>
			{/if}
			{#if i.judgment?.procedure}<span class="ministry">{i.judgment.procedure}</span>{/if}
			{#if i.publication?.instruments?.length}
				<!-- Stelt vast: Cyberbeveiligingswet. Wijzigt: Telecommunicatiewet (5 artikelen). -->
				<span class="verband verband--regel"
					>{#each publicatieVerbanden(i.publication) as v, n (v.label)}{n ? ' ' : ''}<span
							class="verband-label">{v.label}:&nbsp;</span
						>{@render delen(v, woorden)}.{/each}</span
				>
			{/if}
			{#if i.vote}
				<!-- The outcome is in the label; the tally beside it, or how it was decided. -->
				{@const how = votesSentence(i.vote.tally) ?? voteHow(i)}
				{#if how}<span>{how}</span>{/if}
			{:else if i.commitment}
				<span
					>{i.commitment.status ?? ''}{i.commitment.expected_resolution
						? `, verwacht ${korteDatum(i.commitment.expected_resolution)}`
						: ''}</span
				>
			{:else if i.commencement}
				{#each inwerkingVerbanden(i.commencement) as v, n (n)}{@render verband(v, woorden)}{/each}
			{/if}
			{#each relatieVerbanden(i) as v (v.label)}{@render verband(v, woorden, true)}{/each}
		</span>
	{/if}
{/snippet}

<!-- Where the words of the topic are, when the line does not show them: `In dossier: …`. -->
{#snippet plekRegel(id: string)}
	{@const p = plekken.get(id)}
	{#if p}{@render plekTekst(p)}{/if}
{/snippet}

{#snippet plekTekst(p: Plek)}
	<span class="plek"><span class="plek-waar">{p.waar}:</span> <Markering delen={p.delen} /></span>
{/snippet}

{#snippet foldOnder(id: string)}
	<span class="meta">{@render plekRegel(id)}</span>
{/snippet}

<!-- A name the row shows, the words of the topic marked in it. -->
{#snippet merk(tekst: string | null | undefined, woorden: readonly string[] = termen)}
	{@const delen = markeer(woorden, tekst)}
	{#if delen}<Markering {delen} />{:else}{tekst ?? ''}{/if}
{/snippet}

<!-- What a row is tied to: `Gaat in op motie-Kathmann (36764, nr. 31)`, each bron a link that
     opens it. A line of its own (`regel`) under the row's names, or one among them. -->
{#snippet verband(v: Verband, woorden: readonly string[], regel = false)}
	<span class="verband" class:verband--regel={regel}
		>{#if v.label}<span class="verband-label">{v.label}&nbsp;</span>{/if}{@render delen(
			v,
			woorden
		)}</span
	>
{/snippet}

{#snippet delen(v: Verband, woorden: readonly string[])}
	{#each v.delen as d, n (n)}{#if d.ref}<BronLink ref={d.ref} href={d.href ?? null}
				>{@render merk(d.tekst, woorden)}</BronLink
			>{:else}{d.tekst}{/if}{/each}
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
			{@const titel = titleOf(i)}
			<!-- In a fold of one dossier, the fold's line says where; in the day's votes, each. -->
			{@const p = f.dossier ? null : plekVan(termen, i, [titel])}
			<li>
				<BronLink ref={refOf(i)} class="fold-title"
					>{@render merk(titel, termenVan(termen, i))}</BronLink
				>
				{#if p}<span class="meta">{@render plekTekst(p)}</span>{/if}
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
		{#if rest > 0}<span class="faction">en {count(rest, 'ander', 'anderen')}</span>{/if}
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
	/* The links in a line's meta a finger can hit: the shared target (.raakvlak, lib/styles/basis.css),
	   on a touch screen and below 768. */
	@media (pointer: coarse), (max-width: 768px) {
		.meta :global(a) {
			position: relative;
		}
		.meta :global(a::after) {
			content: '';
			position: absolute;
			inset: calc(-1 * var(--s-2)) calc(-1 * var(--s-1));
		}
	}
	/* Why the row is in a followed topic, where its line does not show the words: a line
	   of its own under the headline. */
	.plek {
		flex-basis: 100%;
		color: var(--ink-2);
	}
	.plek-waar {
		color: var(--ink-3);
	}
	/* What the row is tied to: its verb in the grey of a label, its bronnen as the names. */
	.verband-label {
		color: var(--ink-3);
	}
	.verband--regel {
		flex-basis: 100%;
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
