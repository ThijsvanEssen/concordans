<script lang="ts">
	// Bronnen without a category: the four groups with their kinds; what each holds is its
	// title (no explanation under a link, Thijs 9 Oct). "Bronnen" in the top nav opens this, so a
	// reader sees Parlement and Regering before choosing, instead of landing in Dossiers. In the
	// frame of the other full-width pages (Gevolgd, Actueel): the heading above both columns, the
	// groups as anchors in the facet column, and in the list column each group a Sectie with its
	// kinds as rows (Thijs, 10 Oct: "sluit nog niet helemaal aan op de design language").
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import Inhoudsopgave from '$lib/components/ui/Inhoudsopgave.svelte';
	import { sourceParts } from './categories';
	import { SOURCES } from '$lib/nav/sources';
	import { getStats } from '$lib/api/stats';
	import { formatCount } from '$lib/text/getal';
	import { report } from '$lib/api/errors';

	// Each kind with the total its own list gives without a filter (`/api/stats` `lists`,
	// API 0.79.41): the number the list shows when opened. Empty while it is not there.
	let counts = $state<Record<string, number | null>>({});
	$effect(() => {
		getStats()
			.then((s) => (counts = s.lists ?? {}))
			.catch((e) => report('Aantallen per soort', e));
	});
	/** The key of a kind in `lists`: the bewindspersonen are its name for the ministers. A page
	 *  beside the lists (Rechtsgang, Ambten) has no count. */
	const countOf = (kind: string) => counts[kind === 'ministers' ? 'bewindspersonen' : kind] ?? null;
	/** Each rubriek with its lists and the pages beside them, as its tab strip holds them. */
	const groups = SOURCES.map((s) => ({ label: s.label, parts: sourceParts(s) }));

	const anchor = (label: string) => `groep-${label.toLowerCase().replace(/\s+/g, '-')}`;
</script>

<div class="overzicht blad blad__indeling">
	<header class="blad__kop">
		<h1 class="blad__titel">Bronnen</h1>
	</header>

	<!-- The groups of the page, as a facet column holds its groups: a way to each. -->
	<Inhoudsopgave items={groups.map((group) => ({ label: group.label, id: anchor(group.label) }))} />

	<div class="groepen">
		{#each groups as group (group.label)}
			<Sectie title={group.label} id={anchor(group.label)} niveau={2} inklapbaar={false}>
				<ul class="rijen">
					{#each group.parts as part (part.key)}
						{@const n = countOf(part.key)}
						<li>
							<a href={part.href} title={part.about}
								><KindGlyph vorm={part.shape} size={14} /><span>{part.label}</span
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
	.groepen {
		display: flex;
		flex-direction: column;
		--lezer-stap: var(--s-7);
		gap: var(--lezer-stap);
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
</style>
