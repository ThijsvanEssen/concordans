<script lang="ts">
	// A small legend in the style of Concordans: per fractie a dot in the colour of the hall,
	// its name and its seats, by size, in columns; under it the numbered places on one line.
	// The same for both Kamers. It is the list of the sitting fracties (Thijs, 16 Oct): each
	// opens in place, its full name on hover, its members and vacancies marked where they
	// differ from its seats.
	import { fractieNaam } from '$lib/bron/menselijk';
	import { openHref } from '$lib/bron/href';
	import { count } from '$lib/text/words';
	import type { Schema } from '$lib/api/types';
	import { achtergrondVan } from './partijkleuren.svelte';
	import ZaalPlaatsen from './ZaalPlaatsen.svelte';

	type Seats = Schema<'ParliamentSeatsResponse'>;
	let {
		data,
		plaatsen,
		peil = null,
		bron = null,
		kolommen = 3,
		rijen = 0,
		ruimte = null,
		coalitie = null,
		members = null
	}: {
		data: Seats;
		plaatsen: string[];
		/** The peildatum, small at the foot. */
		peil?: string | null;
		bron?: { label: string; href: string } | null;
		/** Beside the hall two columns, under it three. */
		kolommen?: number;
		/** At least this many rows, so the legends of both Kamers stand equally high. */
		rijen?: number;
		/**
		 * The places of the other Kamer, where they take more lines: the line keeps their
		 * height, unseen, so the legends of both Kamers stand equally high at every width.
		 */
		ruimte?: string[] | null;
		/** The cabinet in office and its fracties: one line to the cabinet, where its seats are. */
		coalitie?: { naam: string; href: string; fracties: string[] } | null;
		/** The members of each fractie by its key, where the list of fracties gave them. */
		members?: ReadonlyMap<string, number> | null;
	} = $props();
	/** What sets a fractie's seats apart: members other than its seats, and its vacancies. */
	const marker = (f: Seats['factions'][number]) => {
		const n = f.key ? members?.get(f.key) : undefined;
		return [
			n != null && n !== f.seats ? count(n, 'lid', 'leden') : null,
			f.vacant ? `${f.vacant} vacant` : null
		]
			.filter(Boolean)
			.join(', ');
	};
	const fracties = $derived([...data.factions].sort((a, b) => b.seats - a.seats));
</script>

<div class="leg">
	<ol
		class="fr"
		aria-label="Zetels per fractie"
		style:grid-template-rows="repeat({Math.max(rijen, Math.ceil(fracties.length / kolommen))}, auto)"
		style:grid-template-columns="repeat({kolommen}, minmax(0, 1fr))"
	>
		{#each fracties as f (fractieNaam(f))}
			{@const extra = marker(f)}
			<!-- The whole row is the fractie's link, a finger's height (UX-toets 16 Oct). -->
			{#snippet row()}
				<span class="stip" style:background={achtergrondVan(fractieNaam(f), f.color ?? null)}
				></span>
				<span class="n"
					>{fractieNaam(f)}{#if extra}<span class="extra">, {extra}</span>{/if}</span
				><span class="z">{f.seats}</span>
			{/snippet}
			<li>
				{#if f.key}<a
						class="entry"
						href={openHref(`factions/${f.key}`)}
						title={f.name && f.name !== fractieNaam(f) ? f.name : undefined}>{@render row()}</a
					>{:else}<span class="entry">{@render row()}</span>{/if}
			</li>
		{/each}
	</ol>
	<div class="pl-cel">
		<ZaalPlaatsen {plaatsen} />
		{#if ruimte && ruimte.length > plaatsen.length}<ZaalPlaatsen plaatsen={ruimte} verborgen />{/if}
	</div>
	{#if coalitie}
		<p class="coalitie">
			Coalitie: <a href={coalitie.href}>{coalitie.naam}</a>{coalitie.fracties.length
				? ` (${coalitie.fracties.join(', ')})`
				: ''}
		</p>
	{/if}
	{#if peil}
		<p class="peil">
			<!-- The fixed caption of a date that belongs to what is shown (docs/bediening.md,
			     Bronregels): `Samenstelling op …. Bron: ….` -->
			{peil}. {#if bron}Bron: <a href={bron.href} rel="external">{bron.label}</a>.{/if}
		</p>
	{/if}
</div>

<style>
	.leg {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
		width: 100%;
		max-width: 720px;
		margin: var(--s-4) 0 0;
	}
	.fr {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-auto-flow: column;
		column-gap: var(--s-6);
	}
	.fr li {
		border-bottom: 1px solid var(--rule);
	}
	/* A name and its marker wrap rather than being cut off (UX-toets 16 Oct). */
	.entry {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		min-height: var(--veld-h);
		color: inherit;
		text-decoration: none;
	}
	.stip {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex: none;
	}
	.n {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: var(--lh-tight);
		color: var(--ink);
	}
	a.entry:hover .n {
		text-decoration: underline;
	}
	.extra {
		color: var(--ink-3);
	}
	.z {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
	}
	/* The places and, unseen, the longer list of the other Kamer in one cell. */
	.pl-cel {
		display: grid;
	}
	.pl-cel > :global(.zaal-plaatsen) {
		grid-area: 1 / 1;
	}
	/* The source in full: its name a link (Thijs, 16 Oct: no line cut off). */
	.peil {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.peil a {
		color: inherit;
	}
	.coalitie {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	.coalitie a {
		color: var(--ink);
	}
</style>
