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

	const anker = (label: string) => `groep-${label.toLowerCase().replace(/\s+/g, '-')}`;
</script>

<div class="overzicht blad blad__indeling">
	<header class="kop">
		<h1 class="titel">Bronnen</h1>
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
						<li>
							<a href={indexHref(cat.key)} title={cat.about}
								><KindGlyph collection={collectionOf(cat.key)} size={14} /><span>{cat.label}</span
								></a
							>
						</li>
					{/each}
				</ul>
			</Sectie>
		{/each}
	</div>
</div>

<style>
	/* The frame and grid of Bladeren (AppShell): the heading over both columns. */
	.kop {
		grid-column: 1 / -1;
		margin-bottom: var(--s-4);
	}
	.titel {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h1);
		font-weight: 600;
	}
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
	.rijen a:hover span {
		text-decoration: underline;
	}
	@media (max-width: 768px) {
		.opzij {
			display: none;
		}
	}
</style>
