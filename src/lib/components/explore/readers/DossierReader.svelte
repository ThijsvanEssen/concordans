<script lang="ts">
	import SlowLoad from '$lib/components/ui/SlowLoad.svelte';
	import FullTitle from '$lib/components/ui/FullTitle.svelte';
	import BronRegel from '$lib/components/parliamentary/BronRegel.svelte';
	import { capitalize, textOf } from '$lib/text/words';
	import { changeVerb } from '$lib/verbonden/relation-words';
	import { onDate } from '$lib/text/datum';
	import { bewaarDossier } from '$lib/map/map';
	import { naamVan } from '$lib/bron/menselijk';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import DossierNaam from '$lib/bron/DossierNaam.svelte';
	import { dossierName, dossierNumberLabel, officialNumber } from '$lib/bron/dossier-naam';
	import { atomHref } from '$lib/components/actueel/feed';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import { uniqueBy } from '$lib/util/unique';
	import BronLink from '$lib/bron/BronLink.svelte';
	import MinistryLink from '$lib/bron/MinistryLink.svelte';
	import ReaderFrame from './ReaderFrame.svelte';
	import { stand } from '$lib/components/parliamentary/stand';
	import ReaderHead from './ReaderHead.svelte';
	import { bronHref } from '$lib/bron/href';
	import { getDossierTimeline } from '$lib/api/records';
	import type { Schema } from '$lib/api/types';
	import { load } from '$lib/util/load.svelte';
	import { report } from '$lib/api/errors';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import type { GraphNode } from '$lib/graph/types';
	import { getDossier } from '$lib/api/dossiers';

	import StandBalk from '$lib/components/parliamentary/StandBalk.svelte';
	import ProposedBy from '$lib/components/parliamentary/ProposedBy.svelte';
	import PassedLaw from '$lib/components/parliamentary/PassedLaw.svelte';
	import Tijdlijn from '$lib/components/tijdlijn/Tijdlijn.svelte';
	import CoalitieRegel from '$lib/components/parliamentary/CoalitieRegel.svelte';
	import type { CoalitieBij } from '$lib/components/parliamentary/coalitie';
	import RijInhoud from '$lib/components/open/RijInhoud.svelte';
	import { procedure } from '$lib/components/parliamentary/procedure';
	import GewijzigdeArtikelen from '$lib/components/parliamentary/GewijzigdeArtikelen.svelte';
	import AmendementenDienstregeling from '$lib/components/parliamentary/AmendementenDienstregeling.svelte';
	import { aantalAmendementen } from '$lib/components/parliamentary/amendementen';
	import { getChangedArticles } from '$lib/api/dossiers';
	import Coverage from '$lib/components/ui/Coverage.svelte';
	import { coverageLine } from '$lib/text/coverage';
	import type { ChangedArticles } from '$lib/components/parliamentary/changed-articles';
	let withOther = $state(false);

	let { node }: { node: GraphNode } = $props();

	const TIMELINE_LIMIT = 200;

	// The API addresses a dossier by its number (`37020-XV`), the node's `label`. The
	// number, not the node: the node is drawn anew once its neighbourhood loads.
	const dossierNumber = $derived(textOf(node.raw?.props?.label));
	const dossier = load(
		() => dossierNumber,
		(number) => (number ? getDossier(number) : Promise.reject(new Error('Dossier zonder nummer'))),
		'Dossier'
	);
	// The procedure and the changed articles come after the dossier: the reader stands on the
	// dossier alone (Thijs, 9 Oct: "alles zo lazy mogelijk").
	const timeline = load(
		() => dossierNumber,
		(number) => (number ? getDossierTimeline(number, TIMELINE_LIMIT) : Promise.resolve(null)),
		'Procedure van het dossier'
	);
	/** The articles the bill changes; null without them. */
	let changed = $state<ChangedArticles | null>(null);
	$effect(() => {
		const number = dossierNumber;
		changed = null;
		if (!number) return;
		let stale = false;
		// A dossier without changed articles has no section.
		getChangedArticles(number)
			.then((c) => {
				if (!stale) changed = c;
			})
			.catch((e) => report('Gewijzigde artikelen', e));
		return () => (stale = true);
	});

	type Reading = Schema<'DossierRelationDTO'>['dossier'];
	/**
	 * A change in the Grondwet passes two readings, each its own dossier. The memorie van
	 * toelichting is in the dossier of the first reading; the second only refers to it.
	 */
	const readings = $derived.by(() => {
		const relations = dossier.state.status === 'ready' ? (dossier.state.data.relations ?? []) : [];
		const of = (direction: 'outgoing' | 'incoming'): Reading[] =>
			relations
				.filter((r) => r.relation === 'second_reading_of' && r.direction === direction)
				.map((r) => r.dossier);
		return { first: of('outgoing'), second: of('incoming') };
	});
</script>

{#snippet dossierLinks(all: Reading[])}
	{@const dossiers = uniqueBy(all, (r) => r.key)}
	{#each dossiers as r, i (r.key)}{#if i > 0}{i === dossiers.length - 1
				? ' en '
				: ', '}{/if}<BronLink
			ref={{ collection: 'dossiers', key: r.key, number: r.number }}
			title={r.title ?? undefined}><DossierNaam dossier={r} hover={false} /></BronLink
		>{/each}
{/snippet}

<!-- The dossier as an Atom feed, for a reader that follows it elsewhere (#866). -->
<svelte:head>
	{#if dossierNumber}<link
			rel="alternate"
			type="application/atom+xml"
			title="Actueel in {dossierNumberLabel(dossierNumber)}"
			href={atomHref({ dossier: dossierNumber })}
		/>{/if}
</svelte:head>

<!-- Verbonden under the text waits for the procedure (ReaderFrame `pending`, T9). -->
<ReaderFrame
	state={dossier.state}
	what="Dossier"
	retry={dossier.retry}
	pending={timeline.state.status === 'loading'}
>
	{#snippet children(d)}
		<div class="r-dossier">
			<ReaderHead
				collection="dossiers"
				kindLabel={dossierNumberLabel(d.number)}
				title={capitalize(d.short_title ?? d.title ?? officialNumber(d.number))}
				acties={{
					// One group per dossier in a map, as a Kamerstuk of it is grouped (map.ts).
					bewaar: bewaarDossier(d),
					// Volg: the dossier under Gevolgd, what is new in it since the visit before.
					follow: { number: d.number, title: dossierName(d) }
				}}
			>
				{#snippet onderTitel()}
					{#if d.short_title && d.title && d.title.trim() !== d.short_title}
						<FullTitle title={d.title} />
					{/if}
					<!-- What the bill does to the law, under its title (concept 21, Thijs 10 Oct): the laws
				     it amends and the EU acts it implements (`legal_effect`), as links. -->
					{#if (d.legal_effect?.amends ?? []).length || (d.legal_effect?.implements ?? []).length}
						<p class="effect">
							{#each [[changeVerb('AMENDS', 'instruments'), d.legal_effect?.amends ?? []], ['Implementeert', d.legal_effect?.implements ?? []]] as const as [term, laws], i (term)}
								{#if laws.length}<span class="effect__regel"
										>{i > 0 && (d.legal_effect?.amends ?? []).length ? '; ' : ''}<span
											class="effect__term"
											>{i > 0 && (d.legal_effect?.amends ?? []).length
												? term.toLowerCase()
												: term}</span
										>
										{#each laws as w, j (w.key)}{j > 0
												? j === laws.length - 1
													? ' en '
													: ', '
												: ''}<a
												href={bronHref({ collection: 'instruments', key: w.key })}
												title={w.name ?? naamVan('instruments', w)}
												>{w.name ?? w.short ?? naamVan('instruments', w)}</a
											>{/each}</span
									>{/if}
							{/each}
						</p>
					{/if}
				{/snippet}
				{#snippet statusLine()}
					{#if d.ministry}
						<p class="reading">
							Ministerie: <MinistryLink ministry={d.ministry} name={d.ministry_name} />.
						</p>
					{/if}
					<ProposedBy proposer={d.proposed_by} documentKinds={d.documents_by_kind} />
					{#if d.submitted_on_tk && stand(d)?.group !== 'ingediend'}
						<!-- The day the bill reached the Kamer (API 0.75), before any stage below it; where
						     the stand says it already ("Ingediend bij de Tweede Kamer op …"), once (R3-L F9). -->
						<p class="reading">
							Ingediend bij de Tweede Kamer {onDate(d.submitted_on_tk)}.
						</p>
					{/if}
				{/snippet}
				<StandBalk {d} />
				<!-- Where it ended: the law it made and its day in force (productcheck 0.80, 4). -->
				<PassedLaw dossier={d} />
				<!-- An open bill: the Kamer records no withdrawal, so no end is not "still running". -->
				{#if coverageLine(d.completeness)}<p class="reading">
						<Coverage coverage={d.completeness} />
					</p>{/if}
				{#if d.ek_outcome}
					{@const ek = d.ek_outcome}
					<!-- The Eerste Kamer's decision stands in the bar; its source is named here. -->
					<BronRegel readOn={ek.retrieved_on} label={ek.attribution} href={ek.source_url} />
				{:else if d.senate?.source?.url}
					{@const bill = d.senate.source}
					<!-- Where the Eerste Kamer's progress in the bar and the procedure comes from. -->
					<BronRegel readOn={bill.read_on} label={bill.attribution} href={bill.url} />
				{/if}
				{#if readings.first.length > 0}
					<p class="reading">
						Tweede lezing van {@render dossierLinks(readings.first)}
					</p>
				{/if}
				{#if readings.second.length > 0}
					<p class="reading">
						Eerste lezing. Tweede lezing in {@render dossierLinks(readings.second)}
					</p>
				{/if}
			</ReaderHead>

			{#if timeline.state.status === 'loading'}
				<SlowLoad label="Procedure laden…" visible />
			{:else if timeline.state.status === 'error'}
				<LoadState state={timeline.state} what="De procedure" retry={timeline.retry} />
			{:else if timeline.state.data}
				{@const p = procedure(
					d,
					timeline.state.data.entries,
					withOther,
					timeline.state.data.entries.length >= TIMELINE_LIMIT
				)}
				<!-- A paper opens its text in place, the vote on the bill its bar, a day's papers of
				     the bill their list; the bron is one step further (Thijs, 11 Oct). -->
				{#snippet inhoud(id: string)}
					{@const i = p.inhoud.get(id)}
					{#if i?.soort === 'stukken'}
						<ul class="stukken">
							{#each i.stukken as s (s.ref)}<li><BronLink ref={s.ref}>{s.zin}</BronLink></li>{/each}
						</ul>
					{:else if i}
						<RijInhoud item={i.item} als={i.soort} />
					{/if}
				{/snippet}
				<!-- The course of the dossier stands open: the line to read it by (mockup V1-c). -->
				<Sectie title="Procedure">
					<Tijdlijn
						groepen={p.groepen.map((g) => ({
							...g,
							regels: g.regels.map((r) => (p.inhoud.has(r.id) ? { ...r, inhoud } : r))
						}))}
						volgorde="oplopend"
						inklapbaar
					>
						{#snippet onderRegel(c: CoalitieBij)}<CoalitieRegel
								coalitie={c.blok}
								fracties={c.fracties}
							/>{/snippet}
						{#snippet meer()}
							{#if p.overig}<TekstLink onclick={() => (withOther = !withOther)}
									>{withOther
										? 'Alleen de procedure'
										: `Toon ook de ${p.overig} andere items`}</TekstLink
								>{/if}
						{/snippet}
					</Tijdlijn>
				</Sectie>
			{/if}

			<!-- The amendments as a timetable, asked once in view; only where the dossier counts any. -->
			<!-- Under the procedure once it is in: it does not stand where the procedure comes and get
			     pushed down by it (UX-toets T9b). -->
			{#if aantalAmendementen(d.documents_by_kind) > 0 && timeline.state.status !== 'loading'}
				<AmendementenDienstregeling dossierNumber={d.number} />
			{/if}

			{#if changed && changed.total > 0}
				<GewijzigdeArtikelen data={changed} wijzigt={d.legal_effect?.amends ?? []} />
			{/if}
		</div>
	{/snippet}
</ReaderFrame>

<style>
	/* The papers of one day, each by its kind and number, a link onward. */
	.stukken {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
	}
	.stukken :global(a) {
		color: var(--ink);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
	}
	.r-dossier {
		display: flex;
		flex-direction: column;
		/* Its step between blocks, which the head subtracts from its own (ReaderHead). */
		--lezer-stap: var(--s-4);
		gap: var(--lezer-stap);
		color: var(--ink-2);
	}
	/* What the bill amends and implements: one line under the title, the laws as links. */
	.effect {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.effect__term {
		color: var(--ink-3);
	}
	.effect a {
		color: var(--ink);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 2px;
	}
	.effect a:hover {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	.reading {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-2);
		margin: 0;
	}
	.reading :global(a) {
		color: inherit;
		text-decoration: underline;
		text-decoration-color: var(--rule);
		text-underline-offset: 2px;
	}
	.reading :global(a:hover) {
		text-decoration-color: currentColor;
	}
	/* Where the Eerste Kamer's outcome comes from: its site, named as its terms ask. */
</style>
