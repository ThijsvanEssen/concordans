<script lang="ts">
	import { judgmentCite, paragraphCite } from '$lib/text/judgment-cite';
	import BronLink from '$lib/bron/BronLink.svelte';
	import CiteMenu from '$lib/components/ui/CiteMenu.svelte';
	import { citeItems } from '$lib/components/ui/cite';
	// Reader for judgments: header, summary, participants and the numbered body.
	// Text restructuring lives in judgment-text.ts.
	import { getJudgmentDetail } from '$lib/api/judgments';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import CitedText from '$lib/components/articles/CitedText.svelte';
	import { page } from '$app/state';
	import { anchorOfHash, landOn, permalink } from '$lib/bron/anchor';
	import { tick } from 'svelte';
	import ReaderFrame from './ReaderFrame.svelte';
	import ReaderHead from './ReaderHead.svelte';
	import {
		headingId,
		judgmentParticipants,
		forParties,
		partiesByRole,
		normalizeParagraphText,
		signatureStart,
		splitBodyParagraph,
		splitSummary
	} from './judgment-text';
	import { formatDate, textProp } from './_shared';
	import { sourceName } from '../law-head';

	let { selection }: { selection: GraphNode | null } = $props();

	type View =
		| { kind: 'empty' }
		| { kind: 'loading' }
		| { kind: 'error'; message: string }
		| { kind: 'loaded'; data: Schema<'JudgmentDetailResponse'> };

	let view = $state<View>({ kind: 'empty' });

	const ecli = $derived(selection ? String(selection.raw?.props?.ecli ?? selection.key) : null);

	// The anchor of an overweging: `paragraph_id` for the first sub-paragraph split out of
	// an API paragraph, else built from its number — a later split shares one `paragraph_id`
	// with the first and needs its own anchor.
	const ecliKey = (e: string) => e.toLowerCase().replaceAll(':', '_');

	const rov = (number: string, id?: string | null) => id || `rov-${number}`;

	// Citeren van een overweging, parallel aan `citeArticle` voor een lid.
	// Kort: HR 19 juli 2019, r.o. 3.1 (EHRM …, § 9); voluit with the ECLI. The date is in both.
	function citeOverweging(
		num: string,
		ecliStr: string | null,
		date: string | null,
		court: string | null,
		id: string
	) {
		if (!ecliStr) return null;
		const { short, full } = judgmentCite(ecliStr, date, court);
		const at = paragraphCite(ecliStr, num);
		return {
			kort: `${short}, ${at}`,
			voluit: `${full}, ${at}`,
			link: permalink(page.url, id)
		};
	}

	/** The articles outside the dataset named in the head; the rest are counted. */
	const OUTSIDE_SHOWN = 6;

	let menuFor = $state<string | null>(null);

	let root = $state<HTMLElement | null>(null);
	const anchor = $derived(anchorOfHash(page.url.hash));
	$effect(() => {
		if (view.kind !== 'loaded' || !anchor || !root) return;
		const container = root;
		void tick().then(() => landOn(container, anchor));
	});

	// Raised by Opnieuw, to load the bron again after an error.
	let attempt = $state(0);

	$effect(() => {
		void attempt;
		if (!ecli) {
			view = { kind: 'empty' };
			return;
		}
		let stale = false;
		view = { kind: 'loading' };
		getJudgmentDetail(ecli)
			.then((data) => {
				if (!stale) view = { kind: 'loaded', data };
			})
			.catch(() => {
				if (!stale) view = { kind: 'error', message: 'Uitspraak kon niet geladen worden.' };
			});
		return () => (stale = true);
	});

	// The participants table shows this many rows before "Alle N partijen tonen".
	const PARTIES_PREVIEW = 6;
	let showAllParties = $state(false);
	$effect(() => {
		void selection?.key;
		showAllParties = false;
	});
</script>

<ReaderFrame
	onRetry={() => attempt++}
	status={view.kind === 'loaded' ? 'ready' : view.kind}
	message={view.kind === 'error' ? view.message : ''}
>
	{#if view.kind === 'loaded'}
		{@const j = view.data.judgment}
		{@const paragraphs = j.paragraphs ?? []}
		{@const caseNumber = textProp(j.props?.case_number)}
		{@const judgmentDate = formatDate(textProp(j.props?.date))}
		<!-- The judgment on its official site, named by it as a law is (API 0.71):
		     uitspraken.rechtspraak.nl, hudoc.echr.coe.int. -->
		{@const deeplink =
			j.official_url ??
			(j.source === 'rechtspraak' && j.ecli
				? `https://deeplink.rechtspraak.nl/uitspraak?id=${encodeURIComponent(j.ecli)}`
				: null)}
		{@const firstSubheading = paragraphs.find((p) => p.kind === 'subheading')}
		{@const participants = judgmentParticipants(j)}
		{@const hasSummary = !!j.summary?.trim()}
		{@const signed = signatureStart(paragraphs)}
		{@const conclusion = j.decision_kind === 'conclusie'}
		{@const replacedBy = j.same_as ?? null}
		<!-- A replacement the dataset lacks: named, without a link. TODO(backend R): read `replaced_by` of the detail, not of `props`, once judgments-r gives it. -->
		{@const replacedOutside = replacedBy ? null : textProp(j.props?.replaced_by)}
		{@const alsoAs = view.data.same_as ?? []}
		{@const outside = j.unresolved_citations ?? []}
		<ReaderHead
			collection="judgments"
			kind={conclusion ? 'Conclusie' : null}
			juris={textProp(j.props?.court)}
			title={(j.ecli
				? judgmentCite(j.ecli, textProp(j.props?.date), textProp(j.props?.court)).full
				: (j.display_name ?? 'Uitspraak')) + (j.names?.length ? ` (${j.names.join(', ')})` : '')}
		>
			<div class="reader-meta-row">
				{#if j.decision_kind && !conclusion}
					<span class="reader-meta-item"
						>{j.decision_kind.charAt(0).toUpperCase() + j.decision_kind.slice(1)}</span
					>
				{/if}
				{#if judgmentDate}<span class="reader-meta-item">{judgmentDate}</span>{/if}
				{#if caseNumber}
					<span class="reader-meta-item">{caseNumber}</span>
				{/if}
				{#if deeplink}
					<a href={deeplink} target="_blank" rel="noopener noreferrer" class="reader-source-link"
						>{sourceName(deeplink) ?? 'Officiële tekst'} ↗</a
					>
				{/if}
			</div>
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
					dataset.
				</p>
			{:else if alsoAs.length > 0}
				<p class="reader-translation">
					Ook gepubliceerd als {#each alsoAs as other, i (other.key)}{i > 0 ? ', ' : ''}<BronLink
							ref={{ collection: 'judgments', key: other.key }}>{other.ecli ?? other.key}</BronLink
						>{/each}.
				</p>
			{/if}
			{#if outside.length > 0}
				<!-- Articles of laws the dataset lacks (API 0.70): each to the place it is first cited. -->
				<p class="reader-translation">
					Haalt ook aan, niet in de dataset: {#each outside.slice(0, OUTSIDE_SHOWN) as c, i (`${c.law}_${c.article_number}`)}{i >
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
											>{/if}{#if p.party}<span class="reader-parties-party"
												>voor {forParties(p.party)}</span
											>{/if}</span
									>
								{/each}
								{#if named.length < g.named.length}
									<button
										type="button"
										class="reader-parties-more"
										onclick={() => (showAllParties = true)}
										>en {g.named.length - named.length} meer</button
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

		<div class="reader-body" bind:this={root}>
			{#each paragraphs.slice(0, signed) as para, paraIdx (paraIdx)}
				{#if para.kind === 'subheading'}
					<!-- The first subheading is replaced by the participants table above. -->
					{#if para !== firstSubheading}
						<p class="reader-subheading">{normalizeParagraphText(para.text)}</p>
					{/if}
				{:else if para.kind === 'heading'}
					{@const clean = normalizeParagraphText(para.text)}
					{@const hid = headingId(clean)}
					<h3 class="reader-heading" id={hid}>
						<span class="reader-heading__text">{clean}</span>
						<CiteMenu
							items={citeItems(null, permalink(page.url, hid))}
							name={clean}
							buttonClass="reader-heading__link"
						/>
					</h3>
				{:else}
					{#each splitBodyParagraph(para.text, para.citations) as seg, i (i)}
						{#if seg.kind === 'heading'}
							{@const hid = headingId(seg.text)}
							<h3 class="reader-heading" id={hid}>
								<span class="reader-heading__text">{seg.text}</span>
								<CiteMenu
									items={citeItems(null, permalink(page.url, hid))}
									name={seg.text}
									buttonClass="reader-heading__link"
								/>
							</h3>
						{:else if seg.num || (i === 0 && para.number)}
							{@const num = String(seg.num ?? para.number)}
							{@const rovId = rov(num, i === 0 ? para.paragraph_id : null)}
							{@const forms = citeOverweging(
								num,
								j.ecli ?? null,
								textProp(j.props?.date),
								textProp(j.props?.court),
								rovId
							)}
							<div
								id={rovId}
								class="reader-para-block"
								class:reader-para-block--sub={seg.depth > 0}
								class:is-open={menuFor === rovId}
								style={seg.depth > 1 ? `padding-left:${(seg.depth - 1) * 1.2}em` : ''}
							>
								<span class="reader-para-num">{num}</span>
								<div class="reader-para-inner">
									{#if seg.subTitle}
										<p class="reader-para-subtitle">{seg.subTitle}</p>
									{/if}
									<p class="reader-para">
										<CitedText text={seg.body} citations={seg.citations} />
									</p>
								</div>
								<div class="reader-para-side">
									<span class="reader-para-actions">
										{#if forms}
											<CiteMenu
												items={citeItems(forms, forms.link)}
												name="{conclusion ? 'punt' : 'overweging'} {num}"
												buttonClass="btn reader-para-btn"
												onToggle={(open) =>
													(menuFor = open ? rovId : menuFor === rovId ? null : menuFor)}
											/>
										{/if}
									</span>
								</div>
							</div>
						{:else}
							<!-- An unnumbered paragraph is still a target: its positional id (`p-21`). -->
							<p
								class="reader-para reader-para--prose"
								id={i === 0 ? para.paragraph_id : undefined}
							>
								<CitedText text={seg.body} citations={seg.citations} />
							</p>
						{/if}
					{/each}
				{/if}
			{/each}
			{#if signed < paragraphs.length}
				<p class="reader-signature">
					{#each paragraphs.slice(signed) as line, k (k)}{#if k > 0}<br
							/>{/if}{line.text.trim()}{/each}
				</p>
			{/if}
			{#if paragraphs.length === 0 && !hasSummary && !replacedBy && !replacedOutside}
				<p class="reader-empty-text">Geen tekst beschikbaar.</p>
			{/if}
			<!-- The terms of HUDOC ask for the source under a text of the Court. -->
			{#if j.source === 'echr' && paragraphs.length > 0}
				<p class="reader-attribution">Tekst: © ECHR-CEDH, uit HUDOC.</p>
			{/if}
		</div>
	{/if}
</ReaderFrame>

<style>
	.reader-meta-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 14px;
		margin-bottom: 10px;
	}

	.reader-meta-item {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}

	.reader-attribution {
		margin: var(--s-6) 0 0;
		padding-top: var(--s-3);
		border-top: 1px solid var(--rule);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.reader-source-link {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-2);
		text-decoration: none;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		padding: 2px var(--s-2);
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
		white-space: nowrap;
		margin-left: auto;
	}

	.reader-source-link:hover {
		background: var(--paper-2);
		color: var(--ink);
	}

	/* Summary */
	.reader-summary-block {
		margin: 0 0 var(--s-5);
		padding: var(--s-4) var(--s-5);
		background: var(--paper-2);
		border-left: 3px solid var(--indigo);
		max-width: var(--measure);
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
		max-width: var(--measure);
		border-collapse: collapse;
		margin: 0 0 var(--s-6);
	}

	.reader-parties-role {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
		text-align: left;
		white-space: nowrap;
		padding: var(--s-1) var(--s-3) var(--s-1) 0;
		vertical-align: baseline;
		width: 8em;
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
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}

	.reader-parties-party {
		margin-left: 6px;
		font-family: var(--font-sans);
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

	.reader-heading,
	.reader-subheading {
		max-width: var(--measure);
	}

	.reader-heading {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		font-family: var(--font-serif);
		font-size: 1em;
		font-weight: 600;
		line-height: var(--lh-snug);
		color: var(--ink);
		margin: 2.2em 0 0.5em;
		padding: 1.4em var(--s-2) 3px;
		margin-left: -8px;
		margin-right: -8px;
		border-top: 1px solid var(--rule);
		border-radius: var(--r-1);
		scroll-margin: 20vh;
	}

	.reader-heading:first-child {
		margin-top: 0;
		padding-top: 3px;
		border-top: 0;
	}

	.reader-heading:global(.is-landed) {
		background: var(--accent-soft);
	}

	.reader-heading__text {
		flex: 1;
		min-width: 0;
	}

	/* Hidden by opacity, not visibility: Tab still reaches the link, and shows it. */
	:global(.reader-heading__link) {
		flex: none;
		opacity: 0;
		padding: 2px var(--s-2);
		border: 0;
		background: none;
		font-family: var(--font-sans);
		font-size: var(--t-label);
		font-weight: 400;
		color: var(--ink-3);
		cursor: pointer;
	}

	:global(.reader-heading__link):hover {
		color: var(--accent);
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

	.reader-para--prose {
		max-width: var(--measure);
	}

	.reader-para:last-child {
		margin-bottom: 0;
	}

	.reader-para-block {
		display: grid;
		grid-template-columns: 2.8em 1fr 130px;
		gap: 0 var(--s-3);
		margin-bottom: 1.4em;
		padding: 2px 6px 2px 0;
		margin-left: -6px;
		max-width: calc(var(--measure) + 2.8em + 130px + 2 * var(--s-3));
	}

	.reader-para-block {
		scroll-margin: 20vh;
		border-radius: var(--r-1);
	}

	.reader-para-block:hover,
	.reader-para-block:focus-within,
	.reader-para-block.is-open {
		background: var(--paper-2);
	}

	.reader-para-block:global(.is-landed) {
		background: var(--accent-soft);
		box-shadow:
			-6px 0 0 var(--accent-soft),
			6px 0 0 var(--accent-soft);
	}

	.reader-para-block--sub {
		margin-bottom: 1em;
	}

	.reader-para-num {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink-3);
		padding-top: 0.25em;
		text-align: right;
		line-height: var(--lh-body);
		user-select: none;
		flex-shrink: 0;
	}

	.reader-para-block--sub .reader-para-num {
		opacity: 0.7;
	}

	.reader-para-inner {
		min-width: 0;
	}

	.reader-para-side {
		display: flex;
		align-items: flex-start;
		padding-top: 0.2em;
	}

	.reader-para-actions {
		opacity: 0;
		display: flex;
		gap: var(--s-1);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
	}

	.reader-para-block:hover .reader-para-actions,
	.reader-para-block:focus-within .reader-para-actions,
	.reader-para-block.is-open .reader-para-actions {
		opacity: 1;
	}

	/* Without hover, as on a touch screen, the actions are always there. */
	@media (hover: none) {
		:global(.reader-heading__link),
		.reader-para-actions {
			opacity: 1;
		}
	}

	:global(.reader-para-btn) {
		padding: 2px var(--s-2);
		font-size: var(--t-label);
	}

	.reader-para-subtitle {
		font-family: var(--font-serif);
		font-weight: 600;
		font-size: 0.88em;
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
		max-width: var(--measure);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}

	.reader-translation {
		margin: var(--s-2) 0 0;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}

	.reader-parties-derived {
		display: block;
		font-weight: 400;
		font-style: italic;
		color: var(--ink-3);
	}
	.reader-parties-more {
		margin: var(--s-1) 0 var(--s-3);
		padding: 0;
		border: 0;
		background: none;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--accent);
		cursor: pointer;
	}
</style>
