<script lang="ts">
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import SoortLink from '$lib/bron/SoortLink.svelte';
	import DossierNaam from '$lib/bron/DossierNaam.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import { uniqueBy } from '$lib/util/unique';
	import BronLink from '$lib/bron/BronLink.svelte';
	import ReaderFrame from './ReaderFrame.svelte';
	import ReaderHead from './ReaderHead.svelte';
	import { bronHref } from '$lib/bron/href';
	import { getDossierTimeline } from '$lib/api/records';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import { bronLabel } from '$lib/vocabulary';
	import { getDossier, str } from '$lib/components/parliamentary/data';
	import { formatLongDate } from './_shared';

	import StandBalk from '$lib/components/parliamentary/StandBalk.svelte';
	import Tijdlijn from '$lib/components/tijdlijn/Tijdlijn.svelte';
	import { procedure } from '$lib/components/parliamentary/procedure';
	import GewijzigdeArtikelen from '$lib/components/parliamentary/GewijzigdeArtikelen.svelte';
	import AmendementenDienstregeling from '$lib/components/parliamentary/AmendementenDienstregeling.svelte';
	import { aantalAmendementen } from '$lib/components/parliamentary/amendementen';
	import {
		getChangedArticles,
		type ChangedArticles
	} from '$lib/components/parliamentary/changed-articles';
	let metOverig = $state(false);

	let { node }: { node: GraphNode } = $props();

	type State =
		| { kind: 'loading' }
		| { kind: 'error'; message: string }
		| {
				kind: 'loaded';
				dossier: Schema<'DossierDetailResponse'>;
		  };

	const TIMELINE_LIMIT = 200;

	let view = $state<State>({ kind: 'loading' });
	// The procedure and the changed articles come after the dossier: the reader stands on the
	// dossier alone (Thijs, 9 Oct: "alles zo lazy mogelijk"). Null when the API has none.
	let timeline = $state<Schema<'DossierTimelineResponse'> | null>(null);
	let timelineLaden = $state(true);
	/** The articles the bill changes; null without them or on an older API. */
	let changed = $state<ChangedArticles | null>(null);

	type Reading = Schema<'DossierRelationDTO'>['dossier'];
	/**
	 * A change in the Grondwet passes two readings, each its own dossier. The memorie van
	 * toelichting is in the dossier of the first reading; the second only refers to it.
	 */
	const readings = $derived.by(() => {
		const relations = view.kind === 'loaded' ? (view.dossier.relations ?? []) : [];
		const of = (direction: 'outgoing' | 'incoming'): Reading[] =>
			relations
				.filter((r) => r.relation === 'second_reading_of' && r.direction === direction)
				.map((r) => r.dossier);
		return { first: of('outgoing'), second: of('incoming') };
	});

	// Raised by Opnieuw, to load the bron again after an error.
	let attempt = $state(0);

	// The API addresses a dossier by its number (`37020-XV`), the node's `label`. The
	// number, not the node: the node is drawn anew once its neighbourhood loads.
	const dossierNumber = $derived(str(node.raw?.props?.label));

	$effect(() => {
		void attempt;
		const number = dossierNumber;
		if (!number) {
			view = { kind: 'error', message: 'Dossier kon niet worden geladen.' };
			return;
		}
		const ac = new AbortController();
		view = { kind: 'loading' };
		timeline = null;
		timelineLaden = true;
		changed = null;
		getDossier(number)
			.then((dossier) => {
				if (!ac.signal.aborted) view = { kind: 'loaded', dossier };
			})
			.catch(() => {
				if (!ac.signal.aborted)
					view = { kind: 'error', message: 'Dossier kon niet worden geladen.' };
			});
		// The timeline is optional: when it fails its section is left out.
		getDossierTimeline(number, TIMELINE_LIMIT)
			.catch(() => null)
			.then((t) => {
				if (ac.signal.aborted) return;
				timeline = t;
				timelineLaden = false;
			});
		// Optional too: a dossier without changed articles has no section.
		getChangedArticles(number)
			.then((c) => {
				if (!ac.signal.aborted) changed = c;
			})
			.catch(() => {});
		return () => ac.abort();
	});
</script>

{#snippet dossierLinks(all: Reading[])}
	{@const dossiers = uniqueBy(all, (r) => r.key)}
	{dossiers.length === 1 ? 'Kamerstuk' : 'Kamerstukken'}
	{#each dossiers as r, i (r.key)}{#if i > 0}{i === dossiers.length - 1
				? ' en '
				: ', '}{/if}<BronLink
			ref={{ collection: 'dossiers', key: r.key, number: r.number }}
			title={r.title ?? undefined}><DossierNaam dossier={r} /></BronLink
		>{/each}
{/snippet}

<ReaderFrame>
	<div class="r-dossier">
		{#if view.kind === 'loading'}
			<p class="loading">Laden…</p>
		{:else if view.kind === 'error'}
			<p class="error">
				{view.message}
				<button type="button" class="btn is-text" onclick={() => attempt++}>Opnieuw</button>
			</p>
		{:else}
			{@const d = view.dossier}

			<ReaderHead
				collection="dossiers"
				title={d.short_title ?? d.title ?? d.number}
				acties={{
					bewaar: {
						id: node.id,
						at: '',
						kort: `Kamerstukken ${d.number}`,
						voluit: `Kamerstukken ${d.number}${d.title ? ` (${d.short_title ?? d.title})` : ''}`,
						groep: d.short_title ?? d.title ?? `Dossier ${d.number}`
					}
				}}
			>
				{#snippet soort()}
					<SoortLink collection="dossiers">{bronLabel('dossiers')}</SoortLink><span
						>, Kamerstuk {d.number}</span
					>
				{/snippet}
				{#snippet onderTitel()}
					{#if d.short_title && d.title && d.title.trim() !== d.short_title}
						<details class="full-title">
							<summary>Volledige titel</summary>
							<p>{d.title}</p>
						</details>
					{/if}
					<!-- What the bill does to the law, under its title (concept 21, Thijs 10 Oct): the laws
				     it amends and the EU acts it implements (`legal_effect`), as links. -->
					{#if (d.legal_effect?.amends ?? []).length || (d.legal_effect?.implements ?? []).length}
						<p class="effect">
							{#each [['Wijzigt', d.legal_effect?.amends ?? []], ['Implementeert', d.legal_effect?.implements ?? []]] as const as [term, wetten], i (term)}
								{#if wetten.length}<span class="effect__regel"
										>{i > 0 && (d.legal_effect?.amends ?? []).length ? '; ' : ''}<span
											class="effect__term"
											>{i > 0 && (d.legal_effect?.amends ?? []).length
												? term.toLowerCase()
												: term}</span
										>
										{#each wetten as w, j (w.key)}{j > 0
												? j === wetten.length - 1
													? ' en '
													: ', '
												: ''}<a
												href={bronHref({ collection: 'instruments', key: w.key })}
												title={w.name ?? w.key}>{w.name ?? w.short ?? w.key}</a
											>{/each}</span
									>{/if}
							{/each}
						</p>
					{/if}
				{/snippet}
				{#snippet status()}
					{#if d.submitted_on_tk}
						<!-- The day the bill reached the Kamer (API 0.75), before any stage below it. -->
						<p class="reading">
							Ingediend bij de Tweede Kamer op {formatLongDate(d.submitted_on_tk)}.
						</p>
					{/if}
				{/snippet}
				<StandBalk {d} />
				{#if d.ek_outcome}
					{@const ek = d.ek_outcome}
					<!-- The Eerste Kamer's decision stands in the bar; its source is named here. -->
					<p class="source">
						Bron: <a href={ek.source_url} rel="external">{ek.attribution}</a>{ek.retrieved_on
							? `, geraadpleegd op ${formatLongDate(ek.retrieved_on)}`
							: ''}.
					</p>
				{:else if d.senate?.source?.url}
					{@const bill = d.senate.source}
					<!-- Where the Eerste Kamer's progress in the bar and the procedure comes from. -->
					<p class="source">
						Bron: <a href={bill.url} rel="external">{bill.attribution}</a>{bill.read_on
							? `, geraadpleegd op ${formatLongDate(bill.read_on)}`
							: ''}.
					</p>
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

			{#if timelineLaden}
				<p class="laden">Procedure laden…</p>
			{:else if timeline}
				{@const p = procedure(d, timeline.entries, metOverig)}
				<Sectie titel="Procedure">
					<Tijdlijn groepen={p.groepen} inklapbaar />
					{#if p.overig}
						<p class="overig">
							<TekstLink onclick={() => (metOverig = !metOverig)}
								>{metOverig
									? 'Alleen de procedure'
									: `Toon ook de ${p.overig} andere items`}</TekstLink
							>
						</p>
					{/if}
				</Sectie>
			{/if}

			<!-- The amendments as a timetable, asked once in view; only where the dossier counts any. -->
			{@const amendementen = aantalAmendementen(d.documents_by_kind)}
			{#if amendementen > 0}
				<AmendementenDienstregeling dossierKey={node.key} />
			{/if}

			{#if changed && changed.total > 0}
				<GewijzigdeArtikelen data={changed} wijzigt={d.legal_effect?.amends ?? []} />
			{/if}
		{/if}
	</div>
</ReaderFrame>

<style>
	.overig {
		margin: var(--s-3) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
	}
	.full-title summary {
		font-family: var(--font-ui);
		font-size: var(--t-ui-micro);
		color: var(--ink-2);
		cursor: pointer;
	}
	.full-title p {
		margin: var(--s-1) 0 0;
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.r-dossier {
		display: flex;
		flex-direction: column;
		/* Its step between blocks, which the head subtracts from its own (ReaderHead). */
		--lezer-stap: var(--s-4);
		gap: var(--lezer-stap);
		color: var(--ink-2);
	}
	.loading,
	.error {
		font-family: var(--font-serif);
		font-style: italic;
		color: var(--ink-3);
		margin: 0;
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
	.source {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.source a {
		color: inherit;
		text-decoration: underline;
		text-decoration-color: var(--rule);
		text-underline-offset: 2px;
	}
	.source a:hover {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	.laden {
		margin: var(--s-4) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
</style>
