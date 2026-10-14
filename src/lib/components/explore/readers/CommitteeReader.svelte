<script lang="ts">
	import { bewaarItem } from '$lib/map/map';
	import { opsomming } from '$lib/text/opsomming';
	import ReaderHead from './ReaderHead.svelte';
	import SoortLink from '$lib/bron/SoortLink.svelte';
	import BronLink from '$lib/bron/BronLink.svelte';
	import ReaderFrame from './ReaderFrame.svelte';
	import type { GraphNode } from '$lib/graph/types';
	import type { Schema } from '$lib/api/types';
	import { bronLabel } from '$lib/vocabulary';
	import { committeeSlug, getCommittee, str } from '$lib/components/parliamentary/data';
	import { OUTCOME_LABEL, type Outcome } from '$lib/components/parliamentary/stages';
	import { chamberName } from '$lib/components/parliamentary/chamber';
	import { seatWord } from '$lib/components/parliamentary/career';
	import { formatLongDate } from './_shared';

	let { node }: { node: GraphNode } = $props();

	const p = $derived(node.raw?.props ?? {});
	const name = $derived(str(p.name) ?? node.raw?.display_name ?? node.label);
	const abbreviation = $derived(str(p.abbreviation));
	const kind = $derived(str(p.kind));

	/** A seat's role as a label: `PlvLid` and `Plv. lid` alike "Plaatsvervangend lid". */
	const zetelVan = (role: string | null | undefined) => {
		const w = seatWord(role) ?? 'lid';
		return w.charAt(0).toUpperCase() + w.slice(1);
	};
	const RANG: Record<string, number> = { Voorzitter: 0, Ondervoorzitter: 1, Lid: 2 };
	const rang = (zetel: string) => RANG[zetel] ?? 3;

	type State =
		| { kind: 'loading' }
		| { kind: 'error' }
		| { kind: 'loaded'; committee: Schema<'CommitteeDetailDTO'> };

	let view = $state<State>({ kind: 'loading' });
	const chamber = $derived(
		str(p.chamber) ?? (view.kind === 'loaded' ? (view.committee.chamber ?? null) : null)
	);

	$effect(() => {
		const slug = committeeSlug(node);
		let stale = false;
		view = { kind: 'loading' };
		if (!slug) {
			view = { kind: 'error' };
			return;
		}
		getCommittee(slug)
			.then((committee) => {
				if (!stale) view = { kind: 'loaded', committee };
			})
			.catch(() => {
				if (!stale) view = { kind: 'error' };
			});
		return () => (stale = true);
	});
</script>

<ReaderFrame>
	<div class="r-committee">
		<!-- The header comes from the node, so a failed detail request costs the counts only. -->
		<ReaderHead
			collection="committees"
			title={name}
			acties={{
				bewaar: bewaarItem(node.id, {
					kort: abbreviation ?? name,
					voluit: `${name}, ${chamberName(chamber)}`
				})
			}}
		>
			{#snippet soort()}
				<SoortLink collection="committees">{bronLabel('committees')}</SoortLink>{opsomming([
					'',
					chamberName(chamber),
					kind
				]) && `, ${opsomming([chamberName(chamber), kind])}`}
			{/snippet}
			{#snippet status()}
				{#if abbreviation && abbreviation !== name}<span class="afk">{abbreviation}</span>{/if}
			{/snippet}
		</ReaderHead>

		{#if view.kind === 'loading'}
			<p class="loading stil">Laden…</p>
		{:else if view.kind === 'loaded'}
			{@const c = view.committee}
			{@const dossiers = c.dossiers ?? []}
			{@const openDossiers = dossiers.filter((d) => !d.closed)}
			{@const outcomes = Object.keys(OUTCOME_LABEL) as Outcome[]}
			{@const ek = c.chamber === 'EK'}
			<!-- The members with a role, in the word of a member's page (seatWord): the
			     voorzitter first, then the ondervoorzitter, the leden and the plaatsvervangers. -->
			{@const officers = (c.members ?? [])
				.filter((m) => m.role)
				.map((m) => ({ ...m, zetel: zetelVan(m.role) }))
				.sort((a, b) => rang(a.zetel) - rang(b.zetel))}
			{@const source = c.source}

			<ul class="stats">
				<li>
					<span class="stat-num">{(c.members ?? []).length}</span><span class="stat-label"
						>Leden</span
					>
				</li>
				{#if !ek}
					<!-- The Eerste Kamer's committees are not yet linked to dossiers. -->
					<li>
						<span class="stat-num">{openDossiers.length}</span><span class="stat-label"
							>Open dossiers</span
						>
					</li>
				{/if}
				{#each outcomes as outcome (outcome)}
					{@const count = dossiers.filter((d) => d.outcome === outcome).length}
					{#if count > 0}
						<li>
							<span class="stat-num">{count}</span><span class="stat-label"
								>{OUTCOME_LABEL[outcome]}</span
							>
						</li>
					{/if}
				{/each}
			</ul>

			{#if officers.length > 0}
				<dl class="officers">
					{#each officers as m (m.key)}
						<dt>{m.zetel}</dt>
						<dd>
							<BronLink ref={`members/${m.key}`}>{m.name}</BronLink>{#if m.ek?.abbreviation}<span
									class="faction">, {m.ek.abbreviation}</span
								>{/if}
						</dd>
					{/each}
				</dl>
			{/if}

			{#if ek && source}
				<p class="source">
					{`Samenstelling op ${formatLongDate(source.composition_date ?? null)}, gegevens sinds ${formatLongDate(source.data_since ?? null)}. `}Bron:
					<a href={source.url} rel="external">{source.attribution}</a>.
				</p>
			{/if}
		{/if}
	</div>
</ReaderFrame>

<style>
	.r-committee {
		display: flex;
		flex-direction: column;
		/* Its step between blocks, which the head subtracts from its own (ReaderHead). */
		--lezer-stap: var(--s-4);
		gap: var(--lezer-stap);
		color: var(--ink-2);
	}
	.loading {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	/* A comma against the word before it: the kicker's gap only after it. */
	.officers {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: var(--s-2) var(--s-4);
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
	}
	.officers dt {
		color: var(--ink-3);
	}
	.officers dt::first-letter {
		text-transform: uppercase;
	}
	.officers dd {
		margin: 0;
		color: var(--ink);
	}
	.faction {
		color: var(--ink-3);
	}
	.source {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* The abbreviation: a word, not a tag. */
	.afk {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}

	.stats {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
		gap: var(--s-2);
	}
	.stats li {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		padding: var(--s-2);
		background: var(--paper-2);
		border: 1px solid var(--rule);
		border-radius: var(--r-1);
	}
	.stat-num {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		font-weight: 600;
		color: var(--ink);
	}
	.stat-label {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
</style>
