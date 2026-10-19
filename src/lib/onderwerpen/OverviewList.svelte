<script lang="ts">
	import { formatCount } from '$lib/text/getal';
	// The list under the Kruiswoord: the decisions with their outcome, the fractie's vote and the
	// researcher's strekking of a motie; or the amendments of a cell by their chains; or the
	// feed's events of a cell.
	import { buildOpenHref } from '$lib/bron/href';
	import { dossierLabel } from '$lib/bron/dossier-naam';
	import type { FeedItem } from '$lib/components/actueel/feed';
	import { chamberName } from '$lib/components/parliamentary/chamber';
	import StemTeken from '$lib/components/parliamentary/Stem.svelte';
	import { votesSentence } from '$lib/components/parliamentary/stemming';
	import UitkomstTeken from '$lib/components/parliamentary/Uitkomst.svelte';
	import { failureText } from '$lib/components/ui/LoadState.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import { korteDatum } from '$lib/text/datum';
	import type { Amendement } from './kruiswoord';
	import {
		outcomeShape,
		soortVan,
		uitkomstVan,
		type Besluit,
		type Stem,
		type Uitkomst
	} from './overzicht';
	import { STREKKINGEN, STREKKING_LABEL, type Strekking } from './strekking';
	import { motionOrAmendment } from '$lib/text/document-kind';

	type Kind = 'besluiten' | 'lokaal' | 'feed' | 'amendementen';

	let {
		kind,
		count,
		selection,
		allHref,
		decisions,
		amendments,
		feedItems,
		faction,
		voteOf,
		coding,
		topicName,
		onStrekking,
		canSaveCoding,
		onSaveCoding,
		onLoadCoding,
		more,
		error,
		loading
	}: {
		kind: Kind;
		/** How many the list holds, as said beside its heading. */
		count: string;
		/** What is chosen in the grid, and the way back where a number is chosen. */
		selection: { label: string; clear: (() => void) | null } | null;
		/** An older address with its own filters: the way to every decision. */
		allHref: string | null;
		decisions: readonly Besluit[];
		amendments: readonly Amendement[];
		feedItems: readonly FeedItem[];
		/** The fractie chosen; '' for none. */
		faction: string;
		voteOf: (d: Besluit) => Stem | undefined;
		/** The researcher's strekking per motie of this topic. */
		coding: Readonly<Record<string, Strekking>>;
		topicName: string;
		onStrekking: (d: Besluit, r: Strekking | null) => void;
		canSaveCoding: boolean;
		onSaveCoding: () => void;
		onLoadCoding: (file: File) => void;
		/** The next rows, where there are more. */
		more: { label: string; loading: boolean; onclick: () => void } | null;
		error: unknown;
		loading: boolean;
	} = $props();

	const UITKOMST_LABEL: Record<Uitkomst, string> = {
		aangenomen: 'aangenomen',
		verworpen: 'verworpen',
		overig: 'zonder uitkomst'
	};
	const SOORT_LABEL: Record<string, string> = {
		Motie: 'Motie',
		'Brief regering': 'Brief regering',
		toezegging: 'Toezegging'
	};
	const isMotie = (d: Besluit) => motionOrAmendment(soortVan(d)) === 'motie';
	const feedHref = (i: FeedItem) =>
		i.path ?? buildOpenHref(null, `${i.node.collection}/${i.node.key}`, { hasText: i.has_text });

	/** The dictum of a row opens in place, from the decision itself: no request. */
	let dictumOpen = $state<Set<string>>(new Set());
	function toggleDictum(key: string) {
		const open = new Set(dictumOpen);
		if (open.has(key)) open.delete(key);
		else open.add(key);
		dictumOpen = open;
	}
</script>

<section class="lijst" aria-labelledby="t-lijst">
	<div class="lijst__kop">
		<h2 id="t-lijst">Stukken</h2>
		<span class="aantal">{count}</span>
		<!-- Bewaren and laden behind one quiet word, where the coding is done. -->
		<span class="lijst__rechts">
			<TekstMenu klein rechts label="Codering" tekst="Codering">
				{#snippet inhoud(sluit)}
					<button
						type="button"
						role="menuitem"
						class="tekstmenu__item menu-regel"
						disabled={!canSaveCoding}
						onclick={() => {
							sluit();
							onSaveCoding();
						}}>Bewaren als CSV</button
					>
					<label class="tekstmenu__item menu-regel">
						Laden uit CSV
						<input
							type="file"
							accept=".csv,text/csv"
							class="sr-only"
							onchange={(e) => {
								sluit();
								const input = e.currentTarget;
								const file = input.files?.[0];
								input.value = '';
								if (file) onLoadCoding(file);
							}}
						/>
					</label>
				{/snippet}
			</TekstMenu>
		</span>
	</div>
	{#if selection}
		<p class="selectie">
			<span>{selection.label}</span>
			{#if selection.clear}<TekstLink onclick={selection.clear}>Selectie wissen</TekstLink>{/if}
		</p>
	{:else if allHref}
		<p class="selectie">
			<TekstLink href={allHref}>Alle besluiten</TekstLink>
		</p>
	{/if}
	<ol class="rijen">
		{#if kind === 'besluiten' || kind === 'lokaal'}
			{#each decisions as d (d.key)}
				{@const s = voteOf(d)}
				{@const u = uitkomstVan(d)}
				{@const tally = votesSentence(d.tally)}
				<li class="rij">
					<span class="rij__datum">{korteDatum(d.date)}</span>
					<div class="rij__tekst">
						<span class="rij__soort">{soortVan(d)}, {chamberName(d.chamber)}</span>
						<a
							class="rij__titel"
							href={buildOpenHref(null, { collection: 'decisions', key: d.key })}
							>{d.subject?.trim() || soortVan(d)}</a
						>
						<div class="rij__regel">
							<span class="rij__uitkomst"
								><UitkomstTeken tone={outcomeShape(u)} woord={UITKOMST_LABEL[u]} />{tally
									? `, ${tally}`
									: ''}{#if s}<span class="rij__stem">{faction} <StemTeken keuze={s} /></span
									>{/if}</span
							>
							{#if isMotie(d)}
								<!-- The researcher's reading, quiet: three words, the chosen one in ink;
								     a second click clears it. -->
								<span
									class="rij__strekking"
									role="group"
									aria-label={`Strekking ten opzichte van ${topicName}`}
								>
									{#each STREKKINGEN as r (r)}
										<button
											type="button"
											class="keus"
											aria-pressed={coding[d.key] === r}
											onclick={() => onStrekking(d, coding[d.key] === r ? null : r)}
											>{STREKKING_LABEL[r]}</button
										>
									{/each}
									<!-- Only where the motie has a dictum (the decision's own `dictum`, null
									     for a motie without text): the rule of Actueel (UX-toets 10 Oct). -->
									{#if d.dictum}
										<button
											type="button"
											class="keus keus--dictum"
											aria-expanded={dictumOpen.has(d.key)}
											onclick={() => toggleDictum(d.key)}>Dictum</button
										>
									{/if}
								</span>
							{/if}
						</div>
						{#if isMotie(d) && d.dictum && dictumOpen.has(d.key)}
							<p class="rij__dictum">{d.dictum}</p>
						{/if}
					</div>
				</li>
			{/each}
		{:else if kind === 'amendementen'}
			{#each amendments as a (a.id)}
				<li class="rij">
					<span class="rij__datum">{korteDatum(a.datum)}</span>
					<div class="rij__tekst">
						<span class="rij__soort"
							>Amendement{a.dossier ? `, ${a.dossier}` : ''}{a.papieren.length > 1
								? `, ${formatCount(a.papieren.length)} stukken`
								: ''}</span
						>
						<a class="rij__titel" href={buildOpenHref(null, a.id)}
							>{a.titel || `Amendement nr. ${a.nummer}`}</a
						>
						{#if a.uitkomst}
							<div class="rij__regel">
								<span class="rij__uitkomst"
									><UitkomstTeken tone={outcomeShape(a.uitkomst)} woord={a.uitkomst} /></span
								>
							</div>
						{/if}
					</div>
				</li>
			{/each}
		{:else}
			{#each feedItems as i (i.id)}
				<li class="rij">
					<span class="rij__datum">{korteDatum(i.date)}</span>
					<div class="rij__tekst">
						<span class="rij__soort"
							>{SOORT_LABEL[i.kind] ?? i.kind}{i.dossier?.number
								? `, ${dossierLabel(i.dossier)}`
								: ''}</span
						>
						<a class="rij__titel" href={feedHref(i)}>{i.title}</a>
					</div>
				</li>
			{/each}
		{/if}
	</ol>
	{#if more}
		<p class="volgende">
			{#if more.loading}Laden…{:else}<TekstLink onclick={more.onclick}>{more.label}</TekstLink>{/if}
		</p>
	{/if}
	{#if error}
		<p class="status stil" role="alert">{failureText('De lijst', error)}</p>
	{:else if loading}<p class="status stil">Laden…</p>{/if}
</section>

<style>
	.lijst {
		margin-top: var(--s-7);
	}
	.lijst h2 {
		margin: 0;
		font-size: var(--t-h3);
		font-weight: 800;
		color: var(--ink);
	}
	.lijst__kop {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-2) var(--s-3);
		margin-bottom: var(--s-2);
		padding-bottom: var(--s-2);
		border-bottom: 1px solid var(--rule-strong);
	}
	.lijst__rechts {
		margin-left: auto;
	}
	.aantal {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* What is chosen in the grid, and the way back: one line over the list. */
	.selectie {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-3);
		margin: 0 0 var(--s-2);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.menu-regel {
		white-space: nowrap;
	}
	.rijen {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* As a row of Bladeren (IndexRow): its lead column, gap and inset, so the titles start
	   where they start in every list. */
	.rij {
		display: grid;
		grid-template-columns: var(--row-lead) minmax(0, 1fr);
		gap: var(--s-5);
		padding: var(--s-3) var(--s-2);
		border-bottom: 1px solid var(--rule);
	}
	.rij__datum,
	.rij__soort {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.rij__datum {
		padding-top: 2px;
	}
	.rij__tekst {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		min-width: 0;
	}
	.rij__titel {
		color: var(--ink);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		text-decoration: none;
		overflow-wrap: anywhere;
	}
	.rij__titel:hover {
		text-decoration: underline;
	}
	/* The outcome left, the coding right on the same line; it wraps under on a phone. */
	.rij__regel {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-1) var(--s-4);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.rij__uitkomst :global(.uk) {
		font-weight: 600;
	}
	.rij__stem {
		margin-left: var(--s-3);
	}
	.rij__strekking {
		display: inline-flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-3);
		margin-left: auto;
	}
	.keus {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: var(--ink-3);
		cursor: pointer;
	}
	.keus:hover {
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.keus[aria-pressed='true'] {
		color: var(--ink);
		font-weight: 600;
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 3px;
	}
	.keus--dictum {
		margin-left: var(--s-2);
		color: var(--ink-2);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 2px;
	}
	.rij__dictum {
		margin: var(--s-1) 0 0;
		padding-left: var(--s-3);
		border-left: 2px solid var(--rule);
		font-style: italic;
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.volgende {
		margin: var(--s-4) 0 0;
		font-size: var(--t-meta);
		color: var(--ink-3);
		text-align: center;
	}

	@media (max-width: 640px) {
		.rij {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--s-1);
		}
		.rij__strekking {
			margin-left: 0;
		}
	}
</style>
