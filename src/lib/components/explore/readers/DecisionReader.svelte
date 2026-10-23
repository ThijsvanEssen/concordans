<script lang="ts">
	import { lacks } from '$lib/text/coverage';
	import Coverage from '$lib/components/ui/Coverage.svelte';
	import { shortKind } from '$lib/text/document-kind';
	import { motionKindLabel } from '$lib/components/parliamentary/motion-kind';
	import { CHOICE } from '$lib/components/parliamentary/stemming';
	import Stembalk from '$lib/components/parliamentary/Stembalk.svelte';
	import { voteBarOf } from '$lib/components/parliamentary/stembalk';
	import BronRegel from '$lib/components/parliamentary/BronRegel.svelte';
	import { langeDatum } from '$lib/text/datum';
	import { joinParts } from '$lib/text/words';
	import { citationRecord } from '$lib/text/citation-record';
	import { bewaarItem } from '$lib/map/map';
	import { getDecision, getDecisionDocument, getParliamentSeats } from '$lib/api/records';
	import { coalitionFactionsOf } from '$lib/components/parliamentary/coalitie';
	import CoalitieRegel from '$lib/components/parliamentary/CoalitieRegel.svelte';
	import BronLink from '$lib/bron/BronLink.svelte';
	import Stem from '$lib/components/parliamentary/Stem.svelte';
	import Uitkomst from '$lib/components/parliamentary/Uitkomst.svelte';
	import { outcomeTone } from '$lib/components/parliamentary/vote-line';
	import DossierNaam from '$lib/bron/DossierNaam.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import { uniqueBy } from '$lib/util/unique';
	import ReaderFrame from './ReaderFrame.svelte';
	import ReaderHead from './ReaderHead.svelte';
	import type { Schema } from '$lib/api/types';
	import { load } from '$lib/util/load.svelte';
	import { report } from '$lib/api/errors';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import type { GraphNode } from '$lib/graph/types';
	import { bronHref } from '$lib/bron/href';
	import { ekFactionGroups, votersOf } from './voters';
	import { decisionMethod, decisionOutcome } from '$lib/components/explore/index/decision-kind';
	import { EK_SOURCE, chamberName } from '$lib/components/parliamentary/chamber';
	import { voteCitation } from '$lib/bron/naam';
	import { isAdvicePaper } from './vote-paper';

	let { node }: { node: GraphNode } = $props();

	// The key, not the node: the node is drawn anew with the same key once its
	// neighbourhood loads, and the record is not asked again for that.
	const decision = load(
		() => node.key,
		(key) => getDecision(key),
		'Stemming'
	);
	const loaded = $derived(decision.state.status === 'ready' ? decision.state.data : null);

	// The text of what was voted on, only where the decision gives no dictum (an amendment, a
	// bill): asked after the first paint, which the decision alone makes.
	const zonderDictum = $derived(
		!!loaded && !loaded.dictum?.trim() && !isAdvicePaper(loaded.primary_document)
	);
	const tekst = load(
		() => (zonderDictum ? node.key : null),
		(key) => (key ? getDecisionDocument(key) : Promise.resolve(null)),
		'Stemmingstekst'
	);
	const doc = $derived(tekst.state.status === 'ready' ? tekst.state.data : null);

	/** What was voted on, by its kind and number: `Motie, Kamerstukken II 2025/26, 36764, nr. 31`. */
	const stukNaam = (p: Schema<'DecisionPaperDTO'>) =>
		joinParts([
			p.kind ? shortKind(p.kind) : 'Kamerstuk',
			citationRecord({ ...p, kind: 'kamerstuk', chamber: loaded?.chamber })?.short
		]);

	// What the coalition did (`coalition`). Only in the Tweede Kamer, and only where the API
	// gives the block.
	const coalitie = $derived(
		loaded && (loaded.chamber ?? 'TK') !== 'EK' ? (loaded.coalition ?? null) : null
	);
	/** The hall of the day of the vote: which fractie is of the coalition, by its key. */
	let zaal = $state<Map<string, boolean | null> | null>(null);
	$effect(() => {
		const c = coalitie;
		const dag = loaded?.date?.slice(0, 10);
		zaal = null;
		if (!c || !dag) return;
		let weg = false;
		getParliamentSeats('TK', dag)
			.then((z) => {
				if (weg || z.cabinet?.key !== c.cabinet) return;
				zaal = new Map(
					z.factions.flatMap((f) => (f.key ? [[f.key, f.coalition ?? null] as const] : []))
				);
			})
			.catch((e) => report('Zaal van de stemming', e));
		return () => {
			weg = true;
		};
	});
	/** Coalitie or oppositie for a fractie that voted, from the hall of that day. */
	const kabinetVan = (id: string) => {
		if (!zaal || !id.startsWith('factions/')) return null;
		const c = zaal.get(id.slice('factions/'.length));
		return c === true ? 'coalitie' : c === false ? 'oppositie' : null;
	};

	const side = (choice: string) =>
		choice === CHOICE.for ? 'for' : choice === CHOICE.against ? 'against' : 'other';

	/** A voter id is `factions/vvd` or `members/…`; the key alone does not say which. */
	const voterHref = (id: string) => (id.includes('/') ? bronHref(id) : null);
	/** A fractie of the Eerste Kamer by its key (`ek_<slug>`, #369) or its id. */
	const ekHref = (id: string) => bronHref(id.includes('/') ? id : `factions/${id}`);
</script>

<ReaderFrame state={decision.state} what="Stemming" retry={decision.retry}>
	{#snippet children(d)}
		{@const bar = voteBarOf(d)}
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
		<div class="r-decision">
			<ReaderHead
				collection="decisions"
				kindParts={[chamberName(chamber), d.date ? langeDatum(d.date) : null]}
				title={d.subject ?? doc?.title ?? lacks('onderwerp')}
				acties={{
					bewaar: bewaarItem(node.id, voteCitation({ date: d.date, chamber, subject: onderwerp }), {
						dossier: eigen[0]?.number
					})
				}}
			>
				<!-- The outcome and what was voted on; the dossier is in the band ("Over 34372 …"), a
				     second one here. A stemming is cited through what was voted on (KOP_ACTIES). -->
				{#snippet statusLine()}
					<p class="woorden">
						{#if uitkomst}<Uitkomst
								tone={outcomeTone(d)}
								woord={uitkomst}
							/>{/if}{#if d.primary_case_kind}{uitkomst ? ', ' : ''}<span class="zaaksoort"
								>{motionKindLabel(d.motion_kind) ?? d.primary_case_kind}</span
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

			<!-- What was voted on (`primary_document`), its dictum under it: the stuk itself is one
			     step further, by its link or its card on hover. -->
			{#if d.primary_document && !isAdvicePaper(d.primary_document)}
				{@const p = d.primary_document}
				<div class="over">
					<p class="over__regel">
						Over: <BronLink ref={{ collection: 'documents', key: p.key }}>{stukNaam(p)}</BronLink>
					</p>
					{#if d.dictum?.trim()}
						<p class="over__dictum">{d.dictum}</p>
					{:else}
						<LoadState state={tekst.state} what="De tekst" retry={tekst.retry}>
							{#snippet children(doc)}
								{#if doc?.text}<p class="document-text">{doc.text}</p>{/if}
							{/snippet}
						</LoadState>
					{/if}
				</div>
			{:else if zonderDictum && !d.primary_document}
				<LoadState state={tekst.state} what="De tekst" retry={tekst.retry}>
					{#snippet children(doc)}
						{#if doc?.text}
							<Sectie title={doc.kind ?? 'Document'} collection="documents">
								<p class="document-text">{doc.text}</p>
							</Sectie>
						{:else if chamber !== 'EK'}
							<p class="document-unavailable"><Coverage noText coverage={doc?.completeness} /></p>
						{/if}
					{/snippet}
				</LoadState>
			{/if}

			<!-- Seats of 0 are unknown (an older Eerste Kamer vote), not a tally of 0. -->
			{#if d.vote_kind && bar}
				<Stembalk model={bar} members={d.vote_kind === 'member'} />
			{:else if chamber === 'EK' && decisionMethod(d)}
				<p class="vote-totals">{decisionMethod(d)}</p>
			{:else if d.decision_kind}
				<!-- A decision without votes (a hamerstuk): no tally, the Kamer's own words. -->
				<p class="vote-totals">{d.decision_kind}</p>
			{/if}

			{#if coalitie}
				<CoalitieRegel {coalitie} fracties={coalitionFactionsOf(voters, zaal)} />
			{/if}

			{#if chamber === 'EK'}
				{@const groups = ekFactionGroups(d)}
				{#if groups.length > 0}
					<Sectie title="Fracties" collection="factions">
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
				<BronRegel
					readOn={d.retrieved_on}
					label={`${EK_SOURCE.name}, ${EK_SOURCE.site}`}
					href={d.source_url ?? EK_SOURCE.url}
				/>
			{/if}

			{#if voters.length > 0}
				<Sectie
					title={d.vote_kind === 'member' ? 'Stemverdeling per lid' : 'Stemverdeling per fractie'}
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
		</div>
	{/snippet}
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
	/* As the article's status line: t-meta, in ink. */
	.woorden {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink);
	}

	/* The outcome, the kind of case and the dossier numbers are words, not tags. */
	.zaaksoort,
	:global(.dossier-woord) {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		text-decoration: none;
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
	.over {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.over__regel {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.over__regel :global(a) {
		color: var(--ink);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
	}
	/* The dictum as a motie reads, in the reader's letter: what the Kamer was asked. */
	.over__dictum {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		font-style: italic;
		color: var(--ink);
	}
	.document-unavailable {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: var(--t-body-2);
		color: var(--ink-3);
		margin: 0;
	}

	.vote-totals {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
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
	.voter-seats {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
	}
</style>
