<script lang="ts">
	import { ecliKey } from '$lib/bron/leesbaar';
	import { capitalize, textOf } from '$lib/text/words';
	import { bewaarItem } from '$lib/map/map';
	import { bevindingen, strekking } from './uitkomst';
	import { keyEcli } from '$lib/bron/leesbaar';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import {
		authorCite,
		conclusieNaam,
		judgmentCite,
		overwegingCitaat,
		paragraphCite,
		zaakNaam
	} from '$lib/text/judgment-cite';
	import BronLink from '$lib/bron/BronLink.svelte';
	import CiteMenu from '$lib/components/ui/CiteMenu.svelte';
	import PlaatsMenu from '$lib/components/articles/PlaatsMenu.svelte';
	import { kaart } from '$lib/map/map.svelte';
	import { citeItems } from '$lib/components/ui/cite';
	// Reader for judgments: header, summary, participants and the numbered body.
	// Text restructuring lives in judgment-text.ts.
	import { getJudgmentDetail } from '$lib/api/judgments';
	import type { GraphNode } from '$lib/graph/types';
	import CitedText from '$lib/components/articles/CitedText.svelte';
	import { page } from '$app/state';
	import { anchorOfHash, landOn, permalink } from '$lib/bron/anchor';
	import { untrack } from 'svelte';
	import { afterTick } from '$lib/util/after-tick';
	import ReaderFrame from './ReaderFrame.svelte';
	import ReaderHead from './ReaderHead.svelte';
	import {
		judgmentParticipants,
		forParties,
		partiesByRole,
		signatureStart,
		bodyItems,
		splitSummary
	} from './judgment-text';
	import { sourceName } from '../law-head';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import { getNodeGraph, neighborsOf } from '$lib/api/nodes';
	import { getNodeFirst, once } from '$lib/api/records';
	import { conclusieVan, type Laag } from '$lib/bron/behoort';
	import { paragraphNumber } from '$lib/text/anchor';
	import { korteDatum, langeDatum } from '$lib/text/datum';
	import { samenhangVan, type Samenhang } from './samenhang';
	import Voetnoten from '$lib/components/articles/Voetnoten.svelte';
	import { kantlijn } from '$lib/actions/kantlijn';
	import { isNootAnker, uitspraakNoten, type Noot, type NootMarker } from '$lib/text/voetnoten';
	import { zetNootStand } from '$lib/text/voetnoten.svelte';
	import { markeringVoor } from '$lib/bron/markering.svelte';
	import { load } from '$lib/util/load.svelte';
	import { report } from '$lib/api/errors';

	let { node }: { node: GraphNode } = $props();

	const ecli = $derived(String(node.raw?.props?.ecli ?? node.key));
	const judgment = load(
		() => ecli,
		(e) => getJudgmentDetail(e),
		'Uitspraak'
	);
	const loaded = $derived(judgment.state.status === 'ready' ? judgment.state.data : null);

	// The anchor of an overweging: `paragraph_id` for the first sub-paragraph split out of
	// an API paragraph, else built from its number — a later split shares one `paragraph_id`
	// with the first and needs its own anchor.

	/** The articles outside the dataset named in the head; the rest are counted. */
	const OUTSIDE_SHOWN = 6;

	// The menu of an overweging (concept 21, variant B, as a lid's): its number opens it, and a
	// click on its text, not on a link or a selection.
	let menu = $state<{ id: string; anker: HTMLElement } | null>(null);
	const menuFor = $derived(menu?.id ?? null);
	function openMenu(id: string, anker: HTMLElement) {
		menu = menu?.id === id ? null : { id, anker };
	}
	function opTekst(e: MouseEvent, id: string) {
		const t = e.target as HTMLElement;
		if (t.closest('a, button, input, textarea, summary, [role="button"]')) return;
		if (window.getSelection()?.toString()) return;
		const anker = (e.currentTarget as HTMLElement)
			.closest('.reader-para-block')
			?.querySelector<HTMLElement>('.plaats-marker');
		if (anker) openMenu(id, anker);
	}

	let root = $state<HTMLElement | null>(null);
	const anchor = $derived(anchorOfHash(page.url.hash));
	// The footnotes: a marker opens its note in place; an anchor to a note (`#fn-35`) opens
	// it, with the words a row or a card came for marked (markering).
	const noten = zetNootStand();
	$effect(() => {
		if (!loaded || !anchor || !root) return;
		const container = root;
		if (isNootAnker(anchor)) {
			const m = markeringVoor(`judgments/${loaded.judgment.key}`, anchor);
			noten.toon(anchor, { doel: m?.doel, bereik: m?.bereik });
		}
		afterTick(() => landOn(container, anchor));
	});
	const nootVan = (alle: Map<string, Noot>, markers: NootMarker[] | undefined) =>
		(markers ?? []).flatMap((m) => alle.get(m.id) ?? []);

	// The connected cases (API 0.78): the sentence that ties each is on the edge of the node
	// response, asked only for a judgment that has any.
	let samenhang = $state<Samenhang[]>([]);
	$effect(() => {
		samenhang = [];
		if (!loaded) return;
		const j = loaded.judgment;
		const related = loaded.related_to ?? [];
		if (related.length === 0) return;
		let stale = false;
		samenhang = samenhangVan([], related);
		once(`nodes/judgments/${j.key}`, () => getNodeGraph('judgments', j.key, { limit: 50 }))
			.then((response) => {
				if (!stale) samenhang = samenhangVan(neighborsOf(response), related);
			})
			.catch((e) => report('Samenhangende zaken', e));
		return () => (stale = true);
	});

	// The conclusie of the A-G or P-G before API 0.79.43 gave it in the detail: from the light
	// node the band has asked already (one request for both).
	// Kept per judgment: the reader's node is replaced under the same id (its head, its light
	// node, the canvas's), and the line would lose it and get it back each time.
	let conclusieVoor = $state<{ id: string; laag: Laag | null } | null>(null);
	const selectieId = $derived(node.id);
	$effect(() => {
		const id = selectieId;
		const { collection, key } = untrack(() => node);
		let stale = false;
		getNodeFirst(collection, key)
			.then((r) => {
				if (!stale) conclusieVoor = { id, laag: conclusieVan(r) };
			})
			.catch((e) => report('Conclusie bij de uitspraak', e));
		return () => (stale = true);
	});
	const conclusie = $derived(conclusieVoor?.id === selectieId ? conclusieVoor.laag : null);

	// The participants table shows this many rows before "Alle N partijen tonen".
	const PARTIES_PREVIEW = 6;
	let showAllParties = $state(false);
	$effect(() => {
		void node.key;
		showAllParties = false;
	});
</script>

<ReaderFrame state={judgment.state} what="Uitspraak" retry={judgment.retry}>
	{#snippet children(data)}
		{@const j = data.judgment}
		{@const paragraphs = j.paragraphs ?? []}
		{@const caseNumber = textOf(j.props?.case_number)}
		{@const judgmentDate = langeDatum(textOf(j.props?.date))}
		<!-- The judgment on its official site, named by it as a law is (API 0.71):
		     uitspraken.rechtspraak.nl, hudoc.echr.coe.int. -->
		{@const deeplink =
			j.official_url ??
			(j.source === 'rechtspraak' && j.ecli
				? `https://deeplink.rechtspraak.nl/uitspraak?id=${encodeURIComponent(j.ecli)}`
				: null)}
		{@const participants = judgmentParticipants(j)}
		{@const hasSummary = !!j.summary?.trim()}
		{@const signed = signatureStart(paragraphs)}
		{@const voetnoten = uitspraakNoten(j.footnotes)}
		{@const items = bodyItems(paragraphs.slice(0, signed), voetnoten.perAlinea)}
		<!-- A note no paragraph before the signature refers to closes the text. -->
		{@const geplaatst = new Set(
			items.flatMap((it) =>
				(it.kind === 'rov' || it.kind === 'prose' ? (it.noten ?? []) : []).map((m) => m.id)
			)
		)}
		{@const losseNoten = [...voetnoten.noten.values()].filter((n) => !geplaatst.has(n.id))}
		<!-- With numbers, all text stands in one column and the numbers hang left of it. -->
		{@const numbered = items.some((it) => it.kind === 'rov')}
		{@const conclusion = j.decision_kind === 'conclusie'}
		{@const replacedBy = j.same_as ?? null}
		<!-- A replacement the dataset lacks: named, without a link (`replaced_by`, API 0.72). -->
		{@const replacedOutside = replacedBy ? null : (j.replaced_by ?? null)}
		<!-- The A-G of a conclusion, as it is cited: Conclusie A-G Hartlief 8 mei 2020. -->
		{@const author = authorCite(
			j.advocate_general,
			paragraphs.filter((p) => p.kind === 'signature').map((p) => p.text)
		)}
		{@const alsoAs = data.same_as ?? []}
		{@const outside = j.unresolved_citations ?? []}
		<!-- The status in one sentence: kind, date, case number; the conclusie after it. -->
		{@const statusWoorden = [
			j.decision_kind && !conclusion ? capitalize(j.decision_kind) : null,
			judgmentDate,
			caseNumber
		].filter(Boolean)}
		<!-- The conclusies by their A-G or P-G and day from the judgment's own detail, so they
		     stand with the text (API 0.79.43, #507); before it, from the light node. -->
		{@const conclusies = data.conclusions
			? data.conclusions.map((c) => ({
					ref: { collection: 'judgments' as const, key: ecliKey(c.ecli) },
					naam: conclusieNaam(c),
					strekking: strekking(c.outcome)
				}))
			: conclusie
				? [{ ...conclusie, strekking: null }]
				: []}
		<!-- How it ended, in its own words (API 0.79.55): what a conclusie proposes, what the
		     ECHR found per article; nothing while the data says none. -->
		{@const eigenStrekking = conclusion ? strekking(j.conclusion_outcome) : null}
		{@const echr = bevindingen(j.echr_findings)}
		{@const kop = j.ecli
			? judgmentCite(j.ecli, textOf(j.props?.date), textOf(j.props?.court), author)
			: null}
		{@const ro = paragraphNumber(anchor)}
		{@const naamKort = kop?.short ?? j.display_name ?? 'Uitspraak'}
		<ReaderHead
			collection="judgments"
			kind={conclusion ? 'Conclusie' : null}
			juris={textOf(j.props?.court)}
			title={(kop ? kop.full : (j.display_name ?? 'Uitspraak')) +
				(j.names?.length ? ` (${j.names.join(', ')})` : '')}
			acties={{
				// Bewaar follows the overweging chosen (#rov-5.7.1), else the whole judgment.
				bewaar: bewaarItem(
					node.id,
					{
						at: ro && kop && j.ecli ? anchor! : '',
						kort: ro && kop && j.ecli ? `${kop.short}, ${paragraphCite(j.ecli, ro)}` : naamKort,
						voluit:
							ro && kop && j.ecli
								? `${kop.full}, ${paragraphCite(j.ecli, ro)}`
								: (kop?.full ?? naamKort)
					},
					{ groep: zaakNaam(naamKort, j.names) }
				),
				wat: ro && kop ? `r.o. ${ro}` : '',
				cite: kop ? citeItems({ kort: kop.short, voluit: kop.full }, permalink(page.url, '')) : [],
				naam: naamKort,
				bron: deeplink ? { label: sourceName(deeplink) ?? 'Officiële tekst', href: deeplink } : null
			}}
		>
			{#snippet statusLine()}
				{#if statusWoorden.length || conclusies.length || eigenStrekking || echr}
					<p>
						{#if statusWoorden.length || eigenStrekking}{[...statusWoorden, eigenStrekking]
								.filter(Boolean)
								.join(', ')}.{/if}
						{#if echr}{capitalize(echr)}.{/if}
						{#if conclusies.length}{conclusies.length > 1 ? 'Conclusies' : 'Conclusie'}: {#each conclusies as c, i (c.naam)}{i >
								0
									? '; '
									: ''}{#if c.ref}<BronLink ref={c.ref}>{c.naam}</BronLink
									>{:else}{c.naam}{/if}{#if c.strekking}, {c.strekking}{/if}{/each}{/if}
					</p>
				{/if}
			{/snippet}
			{#if j.translation_of}
				<p class="reader-translation">
					Vertaling van
					<BronLink
						ref={{
							collection: 'judgments',
							key: ecliKey(j.translation_of)
						}}>{j.translation_of}</BronLink
					>. De samenvatting hieronder is die van het origineel.
				</p>
			{/if}
			{#if replacedBy}
				<p class="reader-translation">
					Vervangen publicatie. De uitspraak staat onder
					<BronLink ref={{ collection: 'judgments', key: ecliKey(replacedBy) }}
						>{replacedBy}</BronLink
					>.
				</p>
			{:else if replacedOutside}
				<p class="reader-translation">
					Vervangen publicatie. De publicatie die haar vervangt, {replacedOutside}, staat niet in de
					gegevens.
				</p>
			{:else if alsoAs.length > 0}
				<p class="reader-translation">
					Ook gepubliceerd als {#each alsoAs as other, i (other.key)}{i > 0 ? ', ' : ''}<BronLink
							ref={{ collection: 'judgments', key: other.key }}
							>{other.ecli ?? keyEcli(other.key) ?? 'Uitspraak'}</BronLink
						>{/each}.
				</p>
			{/if}
			{#if outside.length > 0}
				<!-- Articles of laws the dataset lacks (API 0.70): each to the place it is first cited. -->
				<p class="reader-translation">
					Haalt ook aan, niet in de gegevens: {#each outside.slice(0, OUTSIDE_SHOWN) as c, i (`${c.law}_${c.article_number}`)}{i >
						0
							? ', '
							: ''}{#if c.paragraph_ids?.[0]}<a href="#{c.paragraph_ids[0]}"
								>art. {c.article_number} {c.law}</a
							>{:else}art. {c.article_number} {c.law}{/if}{/each}{outside.length > OUTSIDE_SHOWN
						? ` en ${outside.length - OUTSIDE_SHOWN} meer`
						: ''}.
				</p>
			{/if}
		</ReaderHead>

		{#if hasSummary}
			<div class="reader-summary-block" id="summary">
				{#each splitSummary(j.summary!) as para, i (i)}
					<p class="reader-summary-para">{para}</p>
				{/each}
			</div>
		{/if}

		{#if participants.length > 0}
			<!-- One row per role: pseudonymised parties counted, the named ones listed. -->
			{@const roles = partiesByRole(participants)}
			<table class="reader-parties" id="parties">
				<tbody>
					{#each roles as g (g.role)}
						{@const named = showAllParties ? g.named : g.named.slice(0, PARTIES_PREVIEW)}
						<tr>
							<th class="reader-parties-role">
								{g.role}
								{#if g.derived}
									<span
										class="reader-parties-derived"
										title="De uitspraak noemt deze rol niet; afgeleid uit rechtsgebied en kop"
										>afgeleid</span
									>
								{/if}
							</th>
							<td class="reader-parties-name">
								{#each named as p, i (i)}
									<span class="reader-party"
										>{p.name}{#if p.alias}<span class="reader-parties-party">({p.alias})</span
											>{/if}{#if p.alsoAs?.length}<span class="reader-parties-party"
												>ook {p.alsoAs.map((r) => r.toLowerCase()).join(', ')}</span
											>{/if}{#if p.place}<span class="reader-parties-party">te {p.place}</span
											>{/if}{#if p.capacity}<span class="reader-parties-party">{p.capacity}</span
											>{/if}{#if p.party}<span class="reader-parties-party"
												>voor {forParties(p.party)}</span
											>{/if}</span
									>
								{/each}
								{#if named.length < g.named.length}
									<TekstLink onclick={() => (showAllParties = true)}
										>en {g.named.length - named.length} meer</TekstLink
									>
								{/if}
								{#if g.anonymous.length > 0}
									<span class="reader-parties-count"
										>{g.named.length ? 'en ' : ''}{g.anonymous.length} geanonimiseerde {g.anonymous
											.length === 1
											? 'partij'
											: 'partijen'}</span
									>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}

		{#if samenhang.length > 0}
			<Sectie titel="Samenhangende zaken" soort="judgments" aantal={samenhang.length}>
				<ul class="samenhang">
					{#each samenhang as z (z.key)}
						<li>
							<p class="samenhang-kop">
								<BronLink ref={{ collection: 'judgments', key: z.key }}>{z.titel}</BronLink>
								{#if z.instantie || z.datum}<span class="samenhang-meta"
										>{[z.instantie, korteDatum(z.datum)].filter(Boolean).join(', ')}</span
									>{/if}
							</p>
							{#each z.zinnen as zin (zin.text)}
								<blockquote class="samenhang-zin">
									<p>{zin.text}</p>
									<footer>Inhoudsindicatie van {zin.van} uitspraak</footer>
								</blockquote>
							{/each}
						</li>
					{/each}
				</ul>
			</Sectie>
		{/if}

		<div class="reader-body" class:reader-body--numbered={numbered} bind:this={root} use:kantlijn>
			{#each items as item, k (k)}
				{#if item.kind === 'subheading'}
					<p class="reader-subheading">{item.text}</p>
				{:else if item.kind === 'heading'}
					<!-- Citeer beside the heading, not in it: its name is its words (UX-toets 10 Oct, #21). -->
					<div class="reader-heading" id={item.id}>
						<h3 class="reader-heading__text">{item.text}</h3>
						<CiteMenu
							items={citeItems(null, permalink(page.url, item.id))}
							name={item.text}
							buttonClass="reader-heading__link"
						/>
					</div>
				{:else if item.kind === 'rov'}
					<!-- Cited and kept as a map's item offers it too (overwegingCitaat, MapInhoud). -->
					{@const forms = overwegingCitaat(
						j,
						item.num,
						item.id,
						permalink(page.url, item.id),
						node.id
					)}
					{@const bewaarItem = forms?.bewaar ?? null}
					<!-- Every number in one column, whatever its depth; the number is the
					     overweging's menu, so the text is as wide as the prose around it. -->
					<div
						id={item.id}
						class="reader-para-block"
						class:is-open={menuFor === item.id}
						class:plaats-bewaard={!!bewaarItem && kaart.heeft(bewaarItem)}
					>
						<div class="reader-para-num">
							{#if forms}
								<button
									type="button"
									class="plaats-marker"
									aria-haspopup="menu"
									aria-expanded={menuFor === item.id}
									aria-label="{conclusion ? 'Punt' : 'Overweging'} {item.num}: citeren, bewaren"
									onclick={(e) => openMenu(item.id, e.currentTarget)}>{item.num}</button
								>
							{:else}
								<span>{item.num}</span>
							{/if}
						</div>
						{#if menu && menu.id === item.id && forms}
							<PlaatsMenu
								anker={menu.anker}
								titel={forms.kort}
								cite={citeItems(forms, forms.link)}
								tekst={() => item.body}
								bewaar={bewaarItem}
								onClose={() => (menu = null)}
							/>
						{/if}
						<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
						<div
							class="reader-para-inner"
							class:is-klikbaar={!!forms}
							onclick={(e) => forms && opTekst(e, item.id)}
						>
							{#if item.subTitle}
								<p class="reader-para-subtitle">{item.subTitle}</p>
							{/if}
							<p class="reader-para">
								<CitedText text={item.body} citations={item.citations} noten={item.noten} />
							</p>
							<Voetnoten noten={nootVan(voetnoten.noten, item.noten)} />
						</div>
					</div>
				{:else}
					<!-- An unnumbered paragraph is still a target: its positional id (`p-21`).
					     Under an overweging it continues it, in the same column. -->
					{#if item.noten?.length}
						<div
							class="reader-para reader-para--prose reader-para--noten"
							class:reader-para--within={item.within}
							id={item.id}
						>
							<p class="reader-para">
								<CitedText text={item.body} citations={item.citations} noten={item.noten} />
							</p>
							<Voetnoten noten={nootVan(voetnoten.noten, item.noten)} />
						</div>
					{:else}
						<p
							class="reader-para reader-para--prose"
							class:reader-para--within={item.within}
							id={item.id}
						>
							<CitedText text={item.body} citations={item.citations} />
						</p>
					{/if}
				{/if}
			{/each}
			{#if signed < paragraphs.length}
				<p class="reader-signature">
					{#each paragraphs.slice(signed) as line, k (k)}{#if k > 0}<br
							/>{/if}{line.text.trim()}{/each}
				</p>
			{/if}
			<Voetnoten noten={losseNoten} marge={false} kop="Voetnoten" />
			{#if paragraphs.length === 0 && !hasSummary && !replacedBy && !replacedOutside}
				<p class="reader-empty-text">Tekst niet in de gegevens.</p>
			{/if}
			<!-- The terms of HUDOC ask for the source under a text of the Court. -->
			{#if j.source === 'echr' && paragraphs.length > 0}
				<p class="reader-attribution">Tekst: © ECHR-CEDH, uit HUDOC.</p>
			{/if}
		</div>
	{/snippet}
</ReaderFrame>

<style>
	.samenhang {
		margin: 0 0 var(--s-6);
		padding: 0;
		list-style: none;
	}
	.samenhang li + li {
		margin-top: var(--s-3);
	}
	.samenhang-kop {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-1) var(--s-2);
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body);
		color: var(--ink);
	}
	.samenhang-meta {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.samenhang-zin {
		margin: var(--s-1) 0 0;
		padding-left: var(--s-3);
		border-left: 1px solid var(--rule);
	}
	.samenhang-zin p {
		margin: 0;
		font-style: italic;
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.samenhang-zin footer {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}

	.reader-attribution {
		margin: var(--s-6) 0 0;
		padding-top: var(--s-3);
		border-top: 1px solid var(--rule);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}

	/* Summary */
	.reader-summary-block {
		margin: 0 0 var(--s-5);
		padding: var(--s-4) var(--s-5);
		background: var(--paper-2);
		border-left: 3px solid var(--indigo);
	}

	.reader-summary-para {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: var(--t-body-2);
		line-height: var(--lh-body);
		color: var(--ink-2);
		margin: 0 0 0.7em;
	}

	.reader-summary-para:last-child {
		margin-bottom: 0;
	}

	/* Participants table */
	/* No box: the role column is the edge the names line up against. */
	.reader-parties {
		width: 100%;
		border-collapse: collapse;
		margin: 0 0 var(--s-6);
	}

	.reader-parties-role {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
		text-align: left;
		white-space: nowrap;
		padding: var(--s-1) var(--s-2) var(--s-1) 0;
		vertical-align: baseline;
		/* The role in the term column (ReaderFrame), like the terms of Behoort bij. */
		box-sizing: border-box;
		width: var(--reader-term);
	}

	.reader-parties-name {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
		padding: var(--s-1) 0;
		vertical-align: baseline;
	}
	.reader-party {
		display: block;
	}
	.reader-parties-count {
		display: block;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}

	.reader-parties-party {
		margin-left: var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 400;
		color: var(--ink-3);
		margin-top: 1px;
	}

	/* Body */
	.reader-body {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink);
	}

	.reader-heading {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-body);
		font-weight: 600;
		line-height: var(--lh-snug);
		color: var(--ink);
		margin: 2.2em 0 0.5em;
		padding: 1.4em var(--s-2) var(--s-1);
		margin-left: calc(-1 * var(--s-2));
		margin-right: calc(-1 * var(--s-2));
		border-top: 1px solid var(--rule);
		border-radius: var(--r-1);
		scroll-margin: 20vh;
	}

	.reader-heading:first-child {
		margin-top: 0;
		padding-top: var(--s-1);
		border-top: 0;
	}

	.reader-heading:global(.is-landed) {
		background: var(--wassing);
	}

	.reader-heading__text {
		flex: 1;
		min-width: 0;
		/* A heading element with the line's own type: no margin or size of its own. */
		margin: 0;
		font: inherit;
	}

	/* Hidden by opacity, not visibility: Tab still reaches the link, and shows it. */
	:global(.reader-heading__link) {
		flex: none;
		opacity: 0;
		padding: 2px var(--s-2);
		border: 0;
		background: none;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 400;
		color: var(--ink-3);
		cursor: pointer;
	}

	:global(.reader-heading__link):hover {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}

	.reader-heading:hover :global(.reader-heading__link),
	.reader-heading:focus-within :global(.reader-heading__link) {
		opacity: 1;
	}

	.reader-subheading {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 0.9em;
		color: var(--ink-3);
		margin: 0 0 1.1em;
	}

	.reader-para {
		margin: 0 0 1.3em;
		hyphens: auto;
		overflow-wrap: break-word;
	}

	/* The number of an overweging hangs left of the text; every paragraph of a judgment
	   with numbers stands in the text column, so an overweging and what continues it
	   start at one edge. */
	.reader-body {
		--rov-num: 3.4em;
		--rov-gap: var(--s-3);
	}
	/* On a desktop the number hangs in the frame's margin and the text of an overweging
	   starts at the column's edge, like all running text (ReaderFrame); as far as the margin
	   reaches: in a narrow frame (32 px) the text gives way, so "2.3.2" is never cut off. */
	@media (min-width: 769px) {
		.reader-body {
			--rov-num: 3em;
			--rov-hang: min(var(--rov-num) + var(--rov-gap), var(--reader-pad-left, var(--s-6)));
		}
		.reader-body.reader-body--numbered .reader-para--prose {
			margin-left: 0;
		}
		/* What continues an overweging keeps to its text, also where the number cannot hang
		   all the way. */
		.reader-body.reader-body--numbered .reader-para--within {
			margin-left: calc(var(--rov-num) + var(--rov-gap) - var(--rov-hang));
		}
		.reader-body .reader-para-block {
			margin-left: calc(-1 * var(--rov-hang));
		}
	}
	.reader-body--numbered .reader-para--prose {
		margin-left: calc(var(--rov-num) + var(--rov-gap) - var(--s-2));
	}

	.reader-para:last-child {
		margin-bottom: 0;
	}
	/* A paragraph with notes: its notes under it, or in the margin beside it. */
	.reader-para--noten {
		position: relative;
	}
	.reader-para--noten > .reader-para {
		margin: 0;
	}

	.reader-para-block {
		display: grid;
		grid-template-columns: var(--rov-num) minmax(0, 1fr);
		gap: 0 var(--rov-gap);
		margin-bottom: 1.3em;
		/* The hover background reaches beyond the text on the right, so the text keeps the
		   column's right edge. */
		padding: 2px var(--s-2) 2px 0;
		margin-left: calc(-1 * var(--s-2));
		margin-right: calc(-1 * var(--s-2));
	}

	.reader-para-block {
		position: relative;
		scroll-margin: 20vh;
		border-radius: var(--r-1);
	}
	/* A kept overweging: the ink bar at the block's own edge, inside the frame even where the
	   number hangs in its margin. */
	.reader-para-block.plaats-bewaard::before {
		left: 0;
	}

	.reader-para-block:hover,
	.reader-para-block:focus-within,
	.reader-para-block.is-open {
		background: var(--paper-2);
	}

	.reader-para-block:global(.is-landed) {
		background: var(--wassing);
		box-shadow:
			-6px 0 0 var(--wassing),
			6px 0 0 var(--wassing);
	}

	/* The number, and under it Citeer. */
	.reader-para-num {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink-3);
		padding-top: 0.25em;
		text-align: right;
		line-height: var(--lh-body);
		user-select: none;
		flex-shrink: 0;
	}

	.reader-para-inner {
		min-width: 0;
	}

	/* The number is the overweging's menu: underlined with ▾ while the overweging is pointed
	   at or focused (as a lid's number, ArticleText). */
	.plaats-marker {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: inherit;
		text-align: inherit;
		cursor: pointer;
	}
	.reader-para-block:hover .plaats-marker,
	.reader-para-block.is-open .plaats-marker,
	.plaats-marker:focus-visible {
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.reader-para-block:hover .plaats-marker::after,
	.reader-para-block.is-open .plaats-marker::after,
	.plaats-marker:focus-visible::after {
		content: ' ▾';
		font-size: 0.7em;
		color: var(--ink-3);
		text-decoration: none;
	}
	.plaats-marker:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	.is-klikbaar {
		cursor: pointer;
	}
	@media (hover: none) {
		:global(.reader-heading__link) {
			opacity: 1;
		}
	}

	.reader-para-subtitle {
		font-family: var(--font-serif);
		font-weight: 600;
		font-size: var(--t-body-2);
		color: var(--ink-2);
		margin: 0 0 0.5em;
	}

	.reader-para-block .reader-para {
		margin: 0;
	}

	.reader-empty-text {
		font-style: italic;
		color: var(--ink-3);
		margin: 0;
	}

	/* The lines the Parket signs a conclusion with, under the text. */
	.reader-signature {
		margin: var(--s-6) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}

	.reader-translation {
		margin: var(--s-2) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}

	.reader-parties-derived {
		display: block;
		font-weight: 400;
		font-style: italic;
		color: var(--ink-3);
	}
</style>
