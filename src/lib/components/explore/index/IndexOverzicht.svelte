<script lang="ts">
	// Bronnen without a category: the four groups with their kinds; what each holds is its
	// title (no explanation under a link, Thijs 9 Oct). "Bronnen" in the top nav opens this, so a
	// reader sees Parlement and Regering before choosing, instead of landing in Dossiers. In the
	// frame of the other full-width pages (Gevolgd, Actueel): the heading above both columns, the
	// groups as anchors in the facet column, and in the list column each group a Sectie with its
	// kinds as rows (Thijs, 10 Oct: "sluit nog niet helemaal aan op de design language").
	import { indexHref } from '$lib/bron/href';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import { collectionOf, INDEX_TABS } from './categories';
	import { getStats } from '$lib/api/stats';
	import { formatCount } from '$lib/text/getal';

	// Each kind with the total its own list gives without a filter (`/api/stats` `lists`,
	// API 0.79.41): the number the list shows when opened. Empty while it is not there.
	let lijsten = $state<Record<string, number | null>>({});
	$effect(() => {
		getStats()
			.then((s) => (lijsten = (s as { lists?: Record<string, number | null> }).lists ?? {}))
			.catch(() => {});
	});
	/** The key of a kind in `lists`: the bewindspersonen are its name for the ministers. */
	const telVan = (kind: string) => lijsten[kind === 'ministers' ? 'bewindspersonen' : kind] ?? null;

	const anker = (label: string) => `groep-${label.toLowerCase().replace(/\s+/g, '-')}`;
</script>

<div class="overzicht blad blad__indeling">
	<header class="blad__kop">
		<h1 class="blad__titel">Bronnen</h1>
	</header>

	<!-- The groups of the page, as a facet column holds its groups: a way to each. -->
	<nav class="opzij" aria-label="Groepen van bronnen">
		<ul>
			{#each INDEX_TABS as groep (groep.label)}
				<li><a href="#{anker(groep.label)}">{groep.label}</a></li>
			{/each}
		</ul>
	</nav>

	<div class="groepen">
		{#each INDEX_TABS as groep (groep.label)}
			<Sectie titel={groep.label} id={anker(groep.label)} niveau={2} inklapbaar={false}>
				<ul class="rijen">
					{#each groep.categories as cat (cat.key)}
						{@const n = telVan(cat.key)}
						<li>
							<a href={indexHref(cat.key)} title={cat.about}
								><KindGlyph collection={collectionOf(cat.key)} size={14} /><span>{cat.label}</span
								>{#if n !== null}<span class="tel">{formatCount(n)}</span>{/if}</a
							>
						</li>
					{/each}
				</ul>
			</Sectie>
		{/each}
	</div>
</div>

<style>
	/* The column's first line on the line of the first group's heading, under its rule
	   (Sectie: 2 px and --s-3), as on Gevolgd. */
	.opzij {
		padding-top: calc(var(--s-3) + 2px);
	}
	.opzij ul {
		margin: 0;
		padding: 0;
		list-style: none;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
	}
	.opzij li {
		padding: 2px 0;
	}
	.opzij a {
		color: var(--ink-2);
		text-decoration: none;
	}
	.opzij a:hover {
		color: var(--ink);
		text-decoration: underline;
	}
	.groepen {
		display: flex;
		flex-direction: column;
		gap: var(--s-7);
		min-width: 0;
	}
	/* Each kind a row, as the rows of Bladeren: the glyph and the name, a rule under it. */
	.rijen {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.rijen li {
		border-bottom: 1px solid var(--rule);
	}
	.rijen a {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		padding: var(--s-2) var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-body);
		color: var(--ink);
		text-decoration: none;
	}
	.rijen a:hover span:not(.tel) {
		text-decoration: underline;
	}
	/* The count at the row's right, a column of figures. */
	.tel {
		margin-left: auto;
		font-size: var(--t-meta);
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
	}
	@media (max-width: 768px) {
		.opzij {
			display: none;
		}
	}
</style>
