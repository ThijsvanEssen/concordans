<script lang="ts">
	// Europa: what the Union prepares, how the Netherlands transposes it and what the Court of
	// Justice decides, three short lists in the form of Bladeren (IndexRow, Sectie, AlleN), each
	// from its own call. An EU proposal and a transposing bill are dossiers of the Tweede Kamer;
	// the sources behind them (EUR-Lex, the Legislative Train) are one step further, by the
	// number the title names. What no call can give yet is said in the list it belongs to.
	import { getCourtRulings, getEuProposals, getTransposingBills } from '$lib/api/europa';
	import { openHref } from '$lib/bron/href';
	import { officialNumber, dossierNumberLabel } from '$lib/bron/dossier-naam';
	import { LIST_PATHS } from '$lib/bron/lists';
	import IndexRow from '$lib/components/explore/index/IndexRow.svelte';
	import { citationRecord } from '$lib/text/citation-record';
	import { OUTCOME_LABEL, isOutcome } from '$lib/votes/stages';
	import AllLink from '$lib/components/ui/AlleN.svelte';
	import DateTime from '$lib/components/ui/DateTime.svelte';
	import Inhoudsopgave from '$lib/components/ui/Inhoudsopgave.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import Section from '$lib/components/ui/Sectie.svelte';
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import { SOURCES } from '$lib/nav/sources';
	import SourceTabs from '$lib/nav/SourceTabs.svelte';
	import { sourceTabs } from '$lib/components/explore/index/categories';
	import { load } from '$lib/util/load.svelte';
	import {
		LEGISLATIVE_TRAIN,
		unionCourt,
		actOf,
		comOf,
		eurLexAct,
		eurLexCom,
		euTitle
	} from '$lib/europa/europa';

	const proposals = load(
		() => 'voorstellen',
		() => getEuProposals(),
		'Europa, voorstellen'
	);
	const bills = load(
		() => 'omzetting',
		() => getTransposingBills(),
		'Europa, omzetting'
	);
	const rulings = load(
		() => 'hof',
		() => getCourtRulings(),
		'Europa, Hof van Justitie'
	);

	const laws = SOURCES.find((x) => x.id === 'wetten')!;

	const SECTIONS = [
		{ id: 'voorstellen', label: 'Voorstellen van de Commissie' },
		{ id: 'omzetting', label: 'Omzetting in Nederland' },
		{ id: 'hof', label: 'Hof van Justitie' }
	];
	// The whole lists, in the list of Bladeren they are rows of.
	const ALL_PROPOSALS = `${LIST_PATHS.dossiers}?q=EU-voorstel&stand=open`;
	const ALL_BILLS = `${LIST_PATHS.dossiers}?q=implementatie&track=Wetgeving&stand=all`;
	const ALL_RULINGS = `${LIST_PATHS.judgments}?tier=hvj_eu`;
</script>

<RouteKop />

<SourceTabs label={laws.label} tabs={sourceTabs(laws)} current="/europa" />

<div class="blad blad__indeling">
	<!-- The tab names the page, as on the other pages beside the lists. -->
	<h1 class="blad__titel sr-only">Bronnen: Europa</h1>
	<Inhoudsopgave items={SECTIONS} />
	<div class="blad__lijst results">
		<p class="intro">
			Wat de Europese Unie voorbereidt, hoe Nederland het omzet en wat het Hof van Justitie beslist.
		</p>

		<div class="groepen">
			<Section title={SECTIONS[0].label} id={SECTIONS[0].id} niveau={2} inklapbaar={false} rijen>
				{#if proposals.state.status !== 'ready'}
					<LoadState state={proposals.state} what="De voorstellen" plural retry={proposals.retry} />
				{:else}
					<ul class="list">
						{#each proposals.state.data.items as d (d.id)}
							{@const bron = `dossiers/${d.number}`}
							{@const com = comOf(d.title ?? '')}
							<IndexRow
								{bron}
								title={euTitle(d.title ?? officialNumber(d.number))}
								href={openHref(bron)}
								acties
							>
								{#snippet lead()}
									<span class="row-id-main"><DateTime iso={d.opened_on} /></span>
									<span class="row-id-sub">{dossierNumberLabel(d.number)}</span>
								{/snippet}
								{#snippet body()}
									{#if com}
										<span class="row-sub"
											><a
												class="raakvlak"
												href={eurLexCom(com)}
												target="_blank"
												rel="external noopener">EUR-Lex, COM ({com.year}) {com.number}</a
											></span
										>
									{/if}
								{/snippet}
							</IndexRow>
						{/each}
					</ul>
					<p class="alle">
						<AllLink noun="EU-voorstellen" href={ALL_PROPOSALS} />
						<a class="raakvlak" href={LEGISLATIVE_TRAIN} target="_blank" rel="external noopener"
							>Legislative Train</a
						>
					</p>
				{/if}
			</Section>

			<Section title={SECTIONS[1].label} id={SECTIONS[1].id} niveau={2} inklapbaar={false} rijen>
				{#if bills.state.status !== 'ready'}
					<LoadState state={bills.state} what="De wetsvoorstellen" plural retry={bills.retry} />
				{:else}
					<ul class="list">
						{#each bills.state.data.items as d (d.id)}
							{@const bron = `dossiers/${d.number}`}
							{@const act = actOf(d.title ?? '')}
							<IndexRow
								{bron}
								title={d.short_title ?? d.title ?? officialNumber(d.number)}
								href={openHref(bron)}
								acties
							>
								{#snippet lead()}
									<span class="row-id-main"><DateTime iso={d.opened_on} /></span>
									<span class="row-id-sub">{dossierNumberLabel(d.number)}</span>
								{/snippet}
								{#snippet body()}
									<span class="row-sub"
										>{isOutcome(d.outcome) ? OUTCOME_LABEL[d.outcome] : 'In behandeling'}</span
									>
									{#if act}
										<span class="row-sub"
											><a
												class="raakvlak"
												href={eurLexAct(act)}
												target="_blank"
												rel="external noopener"
												>EUR-Lex, {act.kind === 'dir' ? 'Richtlijn' : 'Verordening'} (EU) {act.year}/{act.number}</a
											></span
										>
									{/if}
								{/snippet}
							</IndexRow>
						{/each}
					</ul>
					<p class="alle"><AllLink noun="wetsvoorstellen" href={ALL_BILLS} /></p>
				{/if}
			</Section>

			<Section title={SECTIONS[2].label} id={SECTIONS[2].id} niveau={2} inklapbaar={false} rijen>
				{#if rulings.state.status !== 'ready'}
					<LoadState state={rulings.state} what="De arresten" plural retry={rulings.retry} />
				{:else}
					<ul class="list">
						{#each rulings.state.data.items as j (j.id)}
							{@const bron = `judgments/${j.key}`}
							<IndexRow
								{bron}
								title={j.display_name ?? j.ecli ?? j.key}
								href={openHref(bron)}
								acties
							>
								{#snippet lead()}
									<span class="row-id-main"><DateTime iso={j.date} /></span>
									<span class="row-id-sub">{unionCourt(j.court)}</span>
								{/snippet}
								{#snippet body()}
									{@const record = citationRecord({ ...j, kind: 'judgment' })}<span class="row-sub"
										>{record?.short}</span
									>
								{/snippet}
							</IndexRow>
						{/each}
					</ul>
					<!-- What no call gives yet: which judgments answer a Dutch court. -->
					<p class="dekking">
						Verwijzingen van Nederlandse rechters zijn hier nog niet te onderscheiden.
					</p>
					<p class="alle"><AllLink noun="arresten" href={ALL_RULINGS} /></p>
				{/if}
			</Section>
		</div>
	</div>
</div>

<style>
	.intro {
		margin: 0 0 var(--s-6);
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-snug);
		color: var(--ink-2);
	}
	.groepen {
		display: flex;
		flex-direction: column;
		--lezer-stap: var(--s-7);
		gap: var(--lezer-stap);
		--row-aside: 0;
	}
	.results :global(.list) {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	/* What identifies the row, small and grey; the title is what is read (as in Bladeren). */
	.results :global(.row-id-main) {
		display: block;
	}
	.results :global(.row-id-sub) {
		display: block;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
		margin-top: var(--s-1);
	}
	.results :global(.row-sub) {
		display: block;
		margin-top: var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.dekking {
		margin: var(--s-2) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-style: italic;
		color: var(--ink-3);
	}
	.alle {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-5);
		margin: var(--s-2) 0 0;
		font-size: var(--t-meta);
	}
</style>
