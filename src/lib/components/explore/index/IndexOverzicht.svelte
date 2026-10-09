<script lang="ts">
	// Bladeren without a category: the four groups with their categories; what each holds
	// is its title (no explanation under a link, Thijs 9 Oct). "Bladeren" in the top nav opens this, so a reader
	// sees Parlement and Regering before choosing, instead of landing in Dossiers.
	import { indexHref } from '$lib/bron/href';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import { collectionOf, INDEX_TABS } from './categories';
</script>

<div class="overzicht">
	<aside class="side">
		<h1>Bladeren</h1>
	</aside>
	<div class="groepen">
		{#each INDEX_TABS as groep (groep.label)}
			<Sectie titel={groep.label} niveau={2} inklapbaar={false}>
				<ul>
					{#each groep.categories as cat (cat.key)}
						<li>
							<a href={indexHref(cat.key)} title={cat.about}
								><KindGlyph collection={collectionOf(cat.key)} size={14} />{cat.label}</a
							>
						</li>
					{/each}
				</ul>
			</Sectie>
		{/each}
	</div>
</div>

<style>
	/* The content column starts where it does on the start page (240 + 40): 248 + 32. */
	.overzicht {
		max-width: 1440px;
		margin: 0 auto;
		padding: var(--s-6) var(--s-6) var(--s-8);
		display: grid;
		grid-template-columns: 248px minmax(0, 1fr);
		column-gap: var(--s-6);
		align-items: start;
	}
	h1 {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h1);
		font-weight: 600;
	}
	.groepen {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--s-6) var(--s-7);
		min-width: 0;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
	}
	a {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-body);
		color: var(--ink);
		text-decoration: none;
	}
	a:hover {
		text-decoration: underline;
	}
	@media (max-width: 860px) {
		.overzicht,
		.groepen {
			grid-template-columns: minmax(0, 1fr);
			row-gap: var(--s-5);
		}
		.overzicht {
			padding: var(--s-5) var(--s-4) var(--s-7);
		}
	}
</style>
