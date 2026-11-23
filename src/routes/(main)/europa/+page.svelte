<script lang="ts">
	// Europa: what the Union prepares, how the Netherlands transposes it and what a Dutch court
	// asked the Court of Justice, three short lists in the form of Bladeren (IndexRow, Sectie,
	// AlleN), each from its own call. An EU proposal and a transposing bill are dossiers of the
	// Tweede Kamer; the sources behind them (EUR-Lex, the Legislative Train) are one step
	// further, by the number the API names (`eu_ref`, `implements`).
	import { getDutchCases, getEuProposals, getTransposingBills } from '$lib/api/europa';
	import { unionRow } from '$lib/components/explore/index/judgment-row';
	import { openHref } from '$lib/bron/href';
	import { officialNumber, dossierNumberLabel } from '$lib/bron/dossier-naam';
	import { LIST_PATHS } from '$lib/bron/lists';
	import IndexRow from '$lib/components/explore/index/IndexRow.svelte';
	import Verwijzer from '$lib/components/explore/index/rows/Verwijzer.svelte';
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
		eurLexEcli,
		proposalKind,
		actOfCelex,
		eurLexCelex,
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
		() => 'nederland',
		() => getDutchCases(),
		'Europa, zaken uit Nederland'
	);

	const NEW_TAB = 'opent in nieuw tabblad';

	const laws = SOURCES.find((x) => x.id === 'wetten')!;

	const SECTIONS = [
		{ id: 'voorstellen', label: 'EU-voorstellen in behandeling' },
		{ id: 'omzetting', label: 'Omzetting in Nederland' },
		{ id: 'nederland', label: 'Zaken uit Nederland' }
	];
	// The whole lists, in the list of Bladeren they are rows of.
	const ALL_PROPOSALS = `${LIST_PATHS.dossiers}?eu=proposal&stand=open`;
	const ALL_BILLS = `${LIST_PATHS.dossiers}?eu=implementation&stand=all`;
	const ALL_CASES = `${LIST_PATHS.judgments}?source=cjeu&referred_by=NL`;
	const ALL_RULINGS = `${LIST_PATHS.judgments}?source=cjeu`;
</script>

<RouteKop />

<SourceTabs label={laws.label} tabs={sourceTabs(laws)} current="/europa" />

<div class="blad blad__indeling">
	<!-- The tab names the page, as on the other pages beside the lists. -->
	<h1 class="blad__titel sr-only">Bronnen: Europa</h1>
	<Inhoudsopgave items={SECTIONS} />
	<div class="blad__lijst results">
		<div class="groepen">
			<Section title={SECTIONS[0].label} id={SECTIONS[0].id} niveau={2} inklapbaar={false} rijen>
				{#if proposals.state.status !== 'ready'}
					<LoadState state={proposals.state} what="De voorstellen" plural retry={proposals.retry} />
				{:else}
					<ul class="list">
						{#each proposals.state.data.items as d (d.id)}
							{@const bron = `dossiers/${d.number}`}
							{@const com = d.eu_ref[0]}
							{@const comHref = com ? eurLexCom(com.com) : null}
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
									<span class="row-sub">{proposalKind(d.title ?? '')}</span>
									{#if com && comHref}
										<span class="row-sub"
											><a class="raakvlak" href={comHref} target="_blank" rel="external noopener"
												>EUR-Lex, {com.com}<span class="sr-only">, {NEW_TAB}</span></a
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
							>Voortgang bij het Europees Parlement (Legislative Train)<span class="sr-only"
								>, {NEW_TAB}</span
							></a
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
							{@const celex = d.implements[0]?.celex}
							{@const act = celex ? actOfCelex(celex) : null}
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
									{#if isOutcome(d.outcome)}
										<span class="row-sub">{OUTCOME_LABEL[d.outcome]}</span>
									{/if}
									{#if celex && act}
										<span class="row-sub"
											><a
												class="raakvlak"
												href={eurLexCelex(celex)}
												target="_blank"
												rel="external noopener"
												>EUR-Lex, {act.kind} {act.number}<span class="sr-only">, {NEW_TAB}</span></a
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
				{#snippet mark()}<span class="onder">Prejudiciële arresten</span>{/snippet}
				{#if rulings.state.status !== 'ready'}
					<LoadState state={rulings.state} what="De zaken" plural retry={rulings.retry} />
				{:else}
					<ul class="list">
						{#each rulings.state.data.items as j (j.id)}
							{@const bron = `judgments/${j.key}`}
							{@const row = unionRow(j)}
							<IndexRow {bron} title={row.title} href={openHref(bron)} acties>
								{#snippet lead()}
									<span class="row-id-main"><DateTime iso={j.date} /></span>
									<span class="row-id-sub">{row.court}</span>
								{/snippet}
								{#snippet body()}
									<Verwijzer decision={j.referring_decision} />
									{#if j.ecli}
										<span class="row-sub"
											><a
												class="raakvlak"
												href={eurLexEcli(j.ecli)}
												target="_blank"
												rel="external noopener"
												>EUR-Lex{row.caseNumber ? `, ${row.caseNumber}` : ''}<span class="sr-only"
													>, {NEW_TAB}</span
												></a
											></span
										>
									{/if}
								{/snippet}
							</IndexRow>
						{/each}
					</ul>
					<p class="alle">
						<AllLink noun="zaken uit Nederland" href={ALL_CASES} />
						<AllLink noun="arresten van het Hof en het Gerecht" href={ALL_RULINGS} />
					</p>
				{/if}
			</Section>
		</div>
	</div>
</div>

<style>
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
	.onder {
		margin-left: var(--s-3);
		font-size: var(--t-meta);
		font-weight: normal;
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
