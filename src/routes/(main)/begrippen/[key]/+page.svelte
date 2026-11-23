<script lang="ts">
	// A begrip on a page of its own (/begrippen/<key>): the articles that together make one
	// doctrine, then every judgment and paper that cites or explains them, each list with its
	// filters. The concept is kept by Concordans, not the law: the label over the title says so.
	import { page } from '$app/state';
	import { getConcept } from '$lib/api/concepts';
	import ConceptArticles from '$lib/components/explore/readers/ConceptArticles.svelte';
	import ConceptDocuments from '$lib/concepts/ConceptDocuments.svelte';
	import ConceptJudgments from '$lib/concepts/ConceptJudgments.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import Section from '$lib/components/ui/Sectie.svelte';
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import { siteTitle } from '$lib/seo/server-head.svelte';
	import { load } from '$lib/util/load.svelte';
	import { BEGRIP_KOP, BEGRIP_METHODE } from '$lib/vocabulary';

	const concept = load(() => page.params.key ?? '', getConcept, 'Begrip');
	const name = $derived(concept.state.status === 'ready' ? concept.state.data.name : null);
</script>

<RouteKop title={name ? siteTitle(name) : undefined} />

<div class="blad begrip">
	<LoadState state={concept.state} what="Het begrip" retry={concept.retry}>
		{#snippet children(c)}
			<header class="blad__kop">
				<div>
					<p class="label"><a href={BEGRIP_METHODE}>{BEGRIP_KOP}</a></p>
					<h1 class="blad__titel">{c.name}</h1>
				</div>
				{#if c.explanation}
					<a
						class="uitleg"
						href={c.explanation.url}
						target="_blank"
						rel="noopener noreferrer external">Uitleg: {c.explanation.label}</a
					>
				{/if}
			</header>
			<Section id="artikelen" title="Artikelen" inklapbaar={false}>
				<ConceptArticles concept={c} />
			</Section>
			<ConceptJudgments concept={c} />
			<ConceptDocuments concept={c} />
		{/snippet}
	</LoadState>
</div>

<style>
	.label {
		margin: 0 0 var(--s-1);
		font-size: var(--t-micro);
	}
	.label a,
	.uitleg {
		color: var(--ink-3);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
	}
	.uitleg {
		font-size: var(--t-meta);
		color: var(--ink);
		white-space: nowrap;
		align-self: end;
	}
</style>
