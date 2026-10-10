<script lang="ts">
	import SoortLink from '$lib/bron/SoortLink.svelte';
	import { getDecision, getDecisionDocument, getParliamentSeats } from '$lib/api/records';
	import { coalitieRegel, coalitieVan } from '$lib/components/parliamentary/coalitie';
	import BronLink from '$lib/bron/BronLink.svelte';
	import Stem from '$lib/components/parliamentary/Stem.svelte';
	import DossierNaam from '$lib/bron/DossierNaam.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import { uniqueBy } from '$lib/util/unique';
	import ReaderFrame from './ReaderFrame.svelte';
	import ReaderHead from './ReaderHead.svelte';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import { bronHref } from '$lib/bron/href';
	import { bronLabel } from '$lib/vocabulary';
	import { formatLongDate } from './_shared';
	import { ekFactionGroups, votersOf } from './voters';
	import { decisionMethod, decisionOutcome } from '$lib/components/explore/index/decision-kind';
	import { EK_SOURCE, chamberName } from '$lib/components/parliamentary/chamber';

	let { node }: { node: GraphNode } = $props();

	type State =
		| { kind: 'loading' }
		| { kind: 'error'; message: string }
		| {
				kind: 'loaded';
				decision: Schema<'DecisionDTO'>;
				// The motion, amendment or bill that was voted on.
				document: Schema<'DocumentTextResponse'> | null;
		  };

	let view = $state<State>({ kind: 'loading' });

	// Raised by Opnieuw, to load the bron again after an error.
	let attempt = $state(0);

	// The key, not the node: the node is drawn anew with the same key once its
	// neighbourhood loads, and the record is not asked again for that.
	const bronKey = $derived(node.key);

	$effect(() => {
		void attempt;
		const key = bronKey;
		const ac = new AbortController();
		view = { kind: 'loading' };
		Promise.all([getDecision(key), getDecisionDocument(key).catch(() => null)])
			.then(([decision, document]) => {
				if (!ac.signal.aborted) view = { kind: 'loaded', decision, document };
			})
			.catch(() => {
				if (!ac.signal.aborted)
					view = { kind: 'error', message: 'Stemming kon niet worden geladen.' };
			});
		return () => ac.abort();
	});

	// What the coalition did (API 0.79.34, `coalition`; Thijs, 10 Oct). Only in the Tweede
	// Kamer, and only where the API gives the block: before 0.79.34 nothing shows.
	const coalitie = $derived(
		view.kind === 'loaded' && (view.decision.chamber ?? 'TK') !== 'EK'
			? coalitieVan(view.decision)
			: null
	);
	/** The hall of the day of the vote: the cabinet's name and which fractie is of it. */
	let zaal = $state<{ naam: string; van: Map<string, boolean | null> } | null>(null);
	$effect(() => {
		const c = coalitie;
		const dag = view.kind === 'loaded' ? view.decision.date?.slice(0, 10) : null;
		zaal = null;
		if (!c || !dag) return;
		let weg = false;
		getParliamentSeats('TK', dag)
			.then((z) => {
				if (weg || z.cabinet?.key !== c.cabinet) return;
				zaal = {
					naam: z.cabinet.name ?? c.cabinet,
					van: new Map(
						z.factions.flatMap((f) => (f.key ? [[f.key, f.coalition ?? null] as const] : []))
					)
				};
			})
			.catch(() => {});
		return () => {
			weg = true;
		};
	});
	/** Coalitie or oppositie for a fractie that voted, from the hall of that day. */
	const kabinetVan = (id: string) => {
		if (!zaal || !id.startsWith('factions/')) return null;
		const c = zaal.van.get(id.slice('factions/'.length));
		return c === true ? 'coalitie' : c === false ? 'oppositie' : null;
	};

	const side = (choice: string) =>
		choice === 'Voor' ? 'for' : choice === 'Tegen' ? 'against' : 'other';

	/** A voter id is `factions/vvd` or `members/…`; the key alone does not say which. */
	const voterHref = (id: string) => (id.includes('/') ? bronHref(id) : null);
	/** A fractie of the Eerste Kamer by its key (`ek_<slug>`, #369) or its id. */
	const ekHref = (id: string) => bronHref(id.includes('/') ? id : `factions/${id}`);
</script>

<ReaderFrame>
	<div class="r-decision">
		{#if view.kind === 'loading'}
			<p class="loading stil">Laden…</p>
		{:else if view.kind === 'error'}
			<p class="error">
				{view.message}
				<button type="button" class="btn is-text" onclick={() => attempt++}>Opnieuw</button>
			</p>
		{:else}
			{@const d = view.decision}
			{@const doc = view.document}
			{@const tally = d.tally ?? {}}
			{@const inFavour = tally['Voor'] ?? 0}
			{@const against = tally['Tegen'] ?? 0}
			{@const inFavourPct =
				inFavour + against > 0 ? Math.round((inFavour / (inFavour + against)) * 100) : 50}
			{@const others = Object.entries(tally).filter(
				([choice]) => choice !== 'Voor' && choice !== 'Tegen'
			)}
			<!-- The dossiers by number and name (API 0.79.30); the node's numbers before it. -->
			{@const dossiers = d.dossiers?.length
				? d.dossiers
				: ((node.raw?.props?.dossier_numbers ?? []) as string[]).map((number) => ({ number }))}
			{@const chamber = d.chamber ?? 'TK'}
			<!-- The Eerste Kamer's fracties stand once, in its own lists (complete, also a fractie
			     without a node); its votes[] (#369) only link the names they share. -->
			{@const voters = chamber === 'EK' ? [] : votersOf(d)}
			{@const ekLink = new Map(
				chamber === 'EK'
					? (d.votes ?? []).flatMap((v) => (v.name?.trim() ? [[v.name.trim(), v.voter_id]] : []))
					: []
			)}

			{@const uitkomst = decisionOutcome(d)}
			{@const eigen = uniqueBy(dossiers, (x) => x.number).slice(0, 3)}
			{@const verder = eigen.slice(1)}
			{@const onderwerp = (d.subject ?? doc?.title ?? '').trim()}
			<ReaderHead
				collection="decisions"
				title={d.subject ?? doc?.title ?? 'Onderwerp niet in de gegevens'}
				acties={{
					bewaar: {
						id: node.id,
						at: '',
						kort: `Stemming${d.date ? ` ${formatLongDate(d.date)}` : ''}: ${onderwerp}`,
						voluit: `Stemming ${chamberName(chamber)}${d.date ? `, ${formatLongDate(d.date)}` : ''}: ${onderwerp}`,
						groep: eigen[0] ? `Kamerstukken ${eigen[0].number}` : 'Stemmingen'
					}
				}}
			>
				{#snippet soort()}
					<SoortLink collection="decisions">{bronLabel('decisions')}</SoortLink><span
						>, {chamberName(chamber)}{d.date ? `, ${formatLongDate(d.date)}` : ''}</span
					>
				{/snippet}
				<!-- The outcome and what was voted on; the dossier is in the band ("Over 34372 …"), a
				     second one here. A stemming is cited through what was voted on (KOP_ACTIES). -->
				{#snippet status()}
					<p class="woorden">
						{#if uitkomst}<span
								class="uitslag"
								class:uitslag--passed={d.passed === true}
								class:uitslag--failed={d.passed === false}>{uitkomst}</span
							>{/if}{#if d.primary_case_kind}{uitkomst ? ', ' : ''}<span class="zaaksoort"
								>{d.primary_case_kind}</span
							>{/if}{#each verder as dossier, i (dossier.number)}{uitkomst ||
							d.primary_case_kind ||
							i > 0
								? ', '
								: ''}<BronLink ref={`dossiers/${dossier.number}`} class="dossier-woord"
								><DossierNaam {dossier} /></BronLink
							>{/each}
					</p>
				{/snippet}
			</ReaderHead>

			{#if doc?.text}
				<Sectie titel={doc.kind ?? 'Document'} soort="documents">
					<p class="document-text">{doc.text}</p>
				</Sectie>
			{:else if chamber !== 'EK'}
				<p class="document-unavailable">Tekst niet in de gegevens.</p>
			{/if}

			<!-- Seats of 0 are unknown (an older Eerste Kamer vote), not a tally of 0. -->
			{#if d.vote_kind && inFavour + against > 0}
				<div class="vote-summary">
					<div class="vote-bar">
						<div class="vote-bar-for" style="width: {inFavourPct}%"></div>
					</div>
					<!-- A sentence: 33 voor, 116 tegen, 1 niet deelgenomen. -->
					<p class="vote-totals">
						<span class="vote-total vote-total--for">{inFavour} voor</span>,
						<span class="vote-total vote-total--against">{against} tegen</span
						>{#each others as [choice, seats] (choice)}, <span class="vote-total vote-total--other"
								>{seats} {choice.toLowerCase()}</span
							>{/each}
					</p>
				</div>
			{:else if chamber === 'EK' && decisionMethod(d)}
				<p class="vote-totals">{decisionMethod(d)}</p>
			{:else if d.decision_kind}
				<!-- A decision without votes (a hamerstuk): no tally, the Kamer's own words. -->
				<p class="vote-totals">{d.decision_kind}</p>
			{/if}

			{#if coalitie}
				{@const r = coalitieRegel(
					coalitie,
					voters,
					zaal ? (k: string) => zaal?.van.get(k) ?? null : null
				)}
				<!-- The coalition on this vote, in words and the shape of a stem; seats where the
				     names of its fracties are not known (a vote by member). -->
				<p class="coalitie">
					<span class="coalitie-kop">Coalitie{zaal ? ` (${zaal.naam})` : ''} {r.stand}</span>
					{#if r.kant}
						<span class="zijde"
							><Stem keuze={r.kant} />
							<span class="coalitie-n">{r.kant === 'voor' ? r.voor : r.tegen} zetels</span></span
						>
					{:else}
						{#each [['voor', r.fractiesVoor, r.voor], ['tegen', r.fractiesTegen, r.tegen]] as const as [kant, fracties, zetels] (kant)}
							<span class="zijde"
								><Stem keuze={kant} />
								{#if fracties.length}<span class="coalitie-f"
										>{fracties.map((f) => f.name).join(', ')}</span
									>{:else}<span class="coalitie-n">{zetels} zetels</span>{/if}</span
							>
						{/each}
					{/if}
				</p>
			{/if}

			{#if chamber === 'EK'}
				{@const groups = ekFactionGroups(d)}
				{#if groups.length > 0}
					<Sectie titel="Fracties" soort="factions">
						<dl class="ek-factions">
							{#each groups as g (g.label)}
								<dt>{g.label}</dt>
								<dd>
									{#each g.names as name, i (name)}{i > 0 ? ', ' : ''}{#if ekLink.get(name)}<a
												href={ekHref(ekLink.get(name)!)}>{name}</a
											>{:else}{name}{/if}{/each}
								</dd>
							{/each}
						</dl>
					</Sectie>
				{/if}
				<p class="source">
					Bron: <a href={d.source_url ?? EK_SOURCE.url} rel="external"
						>{EK_SOURCE.name}, {EK_SOURCE.site}</a
					>{d.retrieved_on ? `, geraadpleegd op ${formatLongDate(d.retrieved_on)}` : ''}.
				</p>
			{/if}

			{#if voters.length > 0}
				<Sectie
					titel={d.vote_kind === 'member' ? 'Stemverdeling per lid' : 'Stemverdeling per fractie'}
				>
					<ul class="voter-list" class:met-kabinet={!!zaal && d.vote_kind !== 'member'}>
						{#each voters as v (v.id)}
							{@const href = voterHref(v.id)}
							<li class="voter-row voter-row--{side(v.choice)}">
								<span class="voter-choice"><Stem keuze={v.choice} /></span>
								{#if href}
									<a class="voter-name" {href} data-sveltekit-noscroll>{v.name}</a>
								{:else}
									<span class="voter-name">{v.name}</span>
								{/if}
								{#if zaal && d.vote_kind !== 'member'}<span class="voter-kabinet"
										>{kabinetVan(v.id) ?? ''}</span
									>{/if}
								{#if v.seats !== null}<span class="voter-seats">{v.seats}</span>{/if}
							</li>
						{/each}
					</ul>
				</Sectie>
			{/if}
		{/if}
	</div>
</ReaderFrame>

<style>
	.r-decision {
		display: flex;
		flex-direction: column;
		/* Its step between blocks, which the head subtracts from its own (ReaderHead). */
		--lezer-stap: var(--s-4);
		gap: var(--lezer-stap);
		color: var(--ink-2);
	}
	.loading,
	.error {
		margin: 0;
	}

	.head {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	/* A comma against the word before it: the kicker's gap only after it. */
	.ek-factions {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: var(--s-2) var(--s-4);
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
	}
	.ek-factions dt {
		font-weight: 600;
		color: var(--ink);
	}
	.ek-factions dd {
		margin: 0;
		color: var(--ink-2);
	}
	.source {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* As the article's status line: t-meta, in ink. */
	.woorden {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink);
	}

	/* The outcome, the kind of case and the dossier numbers are words, not tags. */
	.uitslag,
	.zaaksoort,
	:global(.dossier-woord) {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		text-decoration: none;
	}
	.uitslag--passed,
	.uitslag--failed {
		color: var(--ink-2);
	}
	.zaaksoort {
		color: var(--ink-3);
	}
	:global(.dossier-woord) {
		color: var(--ink-3);
	}
	:global(.dossier-woord:hover) {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}

	.document-text {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink);
		white-space: pre-wrap;
		margin: 0;
	}
	.document-unavailable {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: var(--t-body-2);
		color: var(--ink-3);
		margin: 0;
	}

	.vote-summary {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
	}
	/* Seats for and against are told apart by the word; the bar shows the share only. */
	.vote-bar {
		height: 14px;
		background: var(--rule);
		border-radius: var(--r-2);
		overflow: hidden;
	}
	.vote-bar-for {
		height: 100%;
		background: var(--ink-2);
		transition: width var(--dur-2) var(--ease);
	}
	.vote-totals {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.vote-total--for,
	.vote-total--against {
		color: var(--ink-2);
		font-weight: 600;
	}
	.vote-total--other {
		color: var(--ink-3);
	}

	.voter-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.voter-row {
		display: grid;
		grid-template-columns: max(calc(var(--reader-term, 0px) - var(--s-2)), 50px) 1fr auto;
		gap: var(--s-2);
		padding: var(--s-1) var(--s-1);
		margin: 0 calc(-1 * var(--s-1));
		align-items: baseline;
		border-radius: var(--r-1);
		font-size: var(--t-meta);
	}
	.voter-row:hover {
		background: var(--paper-2);
	}
	/* The stem in shape, colour and word (Stem), as on a member's page. */
	.voter-choice {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
	}
	.voter-name {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
		text-decoration: none;
	}
	a.voter-name:hover {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	/* Coalitie or oppositie: a column of its own, as quiet as the seats beside it. */
	.met-kabinet .voter-row {
		grid-template-columns: max(calc(var(--reader-term, 0px) - var(--s-2)), 50px) 1fr auto 3.5em;
	}
	.voter-kabinet {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.coalitie {
		margin: var(--s-2) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-1) var(--s-2);
	}
	.coalitie-kop {
		font-weight: 600;
		color: var(--ink);
	}
	/* A side: its stem and the coalition fracties on it, kept together on a narrow screen. */
	.zijde {
		display: inline-flex;
		align-items: baseline;
		gap: var(--s-2);
	}
	.coalitie-f {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
	}
	.voter-seats {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
	}
</style>
