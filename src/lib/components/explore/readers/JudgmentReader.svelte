<script lang="ts">
	// Reader for judgments: header, summary, participants and the numbered body.
	// Text restructuring lives in judgment-text.ts.
	import { getJudgmentDetail } from '$lib/api/judgments';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import { formatEcliLabel } from '$lib/graph/types';
	import CitedText from '$lib/components/articles/CitedText.svelte';
	import { page } from '$app/state';
	import { anchorOfHash, landOn, permalink } from '$lib/bron/anchor';
	import { tick } from 'svelte';
	import ReaderFrame from './ReaderFrame.svelte';
	import ReaderHead from './ReaderHead.svelte';
	import {
		extractParticipants,
		extractPartyInfo,
		normalizeParagraphText,
		splitBodyParagraph,
		splitSummary
	} from './judgment-text';
	import { formatDate, textProp } from './_shared';

	let { selection }: { selection: GraphNode | null } = $props();

	type View =
		| { kind: 'empty' }
		| { kind: 'loading' }
		| { kind: 'error'; message: string }
		| { kind: 'loaded'; data: Schema<'JudgmentDetailResponse'> };

	let view = $state<View>({ kind: 'empty' });

	const ecli = $derived(selection ? String(selection.raw?.props?.ecli ?? selection.key) : null);

	function headingId(text: string): string {
		return (
			'h-' +
			text
				.toLowerCase()
				.replace(/\s+/g, '-')
				.replace(/[^a-z0-9-]/g, '')
				.slice(0, 40)
		);
	}

	// The anchor of an overweging: `paragraph_id` (API 0.5), else built from its number.
	// TODO(backend B7): the fallback goes when every paragraph carries the id.
	const rov = (number: string, id?: string | null) => id || `rov-${number}`;
	const copy = (id: string) => navigator.clipboard?.writeText(permalink(page.url, id));

	let root = $state<HTMLElement | null>(null);
	const anchor = $derived(anchorOfHash(page.url.hash));
	$effect(() => {
		if (view.kind !== 'loaded' || !anchor || !root) return;
		const container = root;
		void tick().then(() => landOn(container, anchor));
	});

	$effect(() => {
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
</script>

<ReaderFrame
	status={view.kind === 'loaded' ? 'ready' : view.kind}
	message={view.kind === 'error' ? view.message : ''}
>
	{#if view.kind === 'loaded'}
		{@const j = view.data.judgment}
		{@const paragraphs = j.paragraphs ?? []}
		{@const caseNumber = textProp(j.props?.case_number)}
		{@const judgmentDate = formatDate(textProp(j.props?.date))}
		{@const deeplink =
			j.source === 'rechtspraak' && j.ecli
				? `https://deeplink.rechtspraak.nl/uitspraak?id=${encodeURIComponent(j.ecli)}`
				: null}
		{@const firstSubheading = paragraphs.find((p) => p.kind === 'subheading')}
		{@const partyLines = firstSubheading ? extractPartyInfo(firstSubheading.text) : null}
		{@const participants = extractParticipants(paragraphs, partyLines)}
		{@const hasSummary = !!j.summary?.trim()}
		<ReaderHead
			collection="judgments"
			juris={textProp(j.props?.court)}
			title={j.ecli ? formatEcliLabel(j.ecli) : (j.display_name ?? 'Uitspraak')}
		>
			<div class="reader-meta-row">
				{#if judgmentDate}<span class="reader-meta-item">{judgmentDate}</span>{/if}
				{#if caseNumber}
					<span class="reader-meta-item reader-meta-item--mono">{caseNumber}</span>
				{/if}
				{#if deeplink}
					<a href={deeplink} target="_blank" rel="noopener noreferrer" class="reader-source-link"
						>Rechtspraak.nl ↗</a
					>
				{/if}
			</div>
		</ReaderHead>

		{#if hasSummary}
			<div class="reader-summary-block">
				{#each splitSummary(j.summary!) as para, i (i)}
					<p class="reader-summary-para">{para}</p>
				{/each}
			</div>
		{/if}

		{#if participants.length > 0}
			<table class="reader-parties">
				<tbody>
					{#each participants as p, i (i)}
						<tr>
							<th class="reader-parties-role">
								{p.role}
								{#if p.party}
									<span class="reader-parties-party">{p.party}</span>
								{/if}
							</th>
							<td class="reader-parties-name">{p.name}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}

		<div class="reader-body" bind:this={root}>
			{#each paragraphs as para, paraIdx (paraIdx)}
				{#if para.kind === 'subheading'}
					<!-- The first subheading is replaced by the participants table above. -->
					{#if para !== firstSubheading}
						<p class="reader-subheading">{normalizeParagraphText(para.text)}</p>
					{/if}
				{:else if para.kind === 'heading'}
					{@const clean = normalizeParagraphText(para.text)}
					<h3 class="reader-heading" id={headingId(clean)}>{clean}</h3>
				{:else}
					{#each splitBodyParagraph(para.text, para.citations) as seg, i (i)}
						{#if seg.kind === 'heading'}
							<h3 class="reader-heading" id={headingId(seg.text)}>{seg.text}</h3>
						{:else if seg.num || (i === 0 && para.number)}
							{@const num = String(seg.num ?? para.number)}
							<div
								id={rov(num, i === 0 ? para.paragraph_id : null)}
								class="reader-para-block"
								class:reader-para-block--sub={seg.depth > 0}
								style={seg.depth > 1 ? `padding-left:${(seg.depth - 1) * 1.2}em` : ''}
							>
								<a
									class="reader-para-num"
									href="#{rov(num, i === 0 ? para.paragraph_id : null)}"
									aria-label="Kopieer link naar overweging {num}"
									onclick={() => copy(rov(num, i === 0 ? para.paragraph_id : null))}>{num}</a
								>
								<div class="reader-para-inner">
									{#if seg.subTitle}
										<p class="reader-para-subtitle">{seg.subTitle}</p>
									{/if}
									<p class="reader-para">
										<CitedText text={seg.body} citations={seg.citations} />
									</p>
								</div>
							</div>
						{:else}
							<p class="reader-para reader-para--prose">
								<CitedText text={seg.body} citations={seg.citations} />
							</p>
						{/if}
					{/each}
				{/if}
			{/each}
			{#if paragraphs.length === 0 && !hasSummary}
				<p class="reader-empty-text">Geen tekst beschikbaar.</p>
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
		font-size: 12px;
		color: var(--ink-3);
	}

	.reader-meta-item--mono {
		font-family: var(--font-mono);
		font-size: 11px;
	}

	.reader-source-link {
		font-family: var(--font-sans);
		font-size: 12px;
		font-weight: 500;
		color: var(--ink-2);
		text-decoration: none;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		padding: 2px 8px;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
		white-space: nowrap;
		margin-left: auto;
	}

	.reader-source-link:hover {
		background: var(--ink);
		color: var(--paper);
		border-color: var(--ink);
	}

	/* Summary */
	.reader-summary-block {
		margin: 0 0 var(--s-5);
		padding: var(--s-4) var(--s-5);
		background: color-mix(in srgb, var(--indigo) 3%, var(--paper));
		border-left: 3px solid color-mix(in srgb, var(--indigo) 35%, transparent);
		max-width: 68ch;
	}

	.reader-summary-para {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 15px;
		line-height: 1.58;
		color: var(--ink-2);
		margin: 0 0 0.7em;
	}

	.reader-summary-para:last-child {
		margin-bottom: 0;
	}

	/* Participants table */
	.reader-parties {
		width: 100%;
		max-width: 68ch;
		border-collapse: collapse;
		margin: 0 0 var(--s-6);
		border: 1px solid var(--rule);
		background: var(--paper-2);
	}

	.reader-parties tr + tr {
		border-top: 1px solid var(--rule);
	}

	.reader-parties-role {
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-4);
		text-align: left;
		white-space: nowrap;
		padding: 6px 12px 6px var(--s-4);
		vertical-align: top;
		width: 7em;
	}

	.reader-parties-name {
		font-family: var(--font-serif);
		font-size: 14px;
		color: var(--ink);
		padding: 6px var(--s-4) 6px 0;
		vertical-align: top;
	}

	.reader-parties-party {
		display: block;
		font-size: 9px;
		font-weight: 400;
		letter-spacing: 0.04em;
		text-transform: none;
		color: var(--ink-4);
		margin-top: 1px;
	}

	/* Body */
	.reader-body {
		font-family: var(--font-serif);
		font-size: 17px;
		line-height: 1.68;
		color: var(--ink);
	}

	.reader-heading,
	.reader-subheading {
		max-width: 68ch;
	}

	.reader-heading {
		font-family: var(--font-serif);
		font-size: 1em;
		font-weight: 600;
		letter-spacing: 0.01em;
		line-height: 1.35;
		color: var(--ink);
		margin: 2.2em 0 0.5em;
		padding-top: 1.4em;
		border-top: 1px solid var(--rule);
	}

	.reader-heading:first-child {
		margin-top: 0;
		padding-top: 0;
		border-top: 0;
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
		max-width: 68ch;
	}

	.reader-para:last-child {
		margin-bottom: 0;
	}

	.reader-para-block {
		display: grid;
		grid-template-columns: 2.8em 1fr;
		gap: 0 var(--s-3);
		margin-bottom: 1.4em;
		max-width: calc(68ch + 2.8em + var(--s-3));
	}

	.reader-para-block {
		scroll-margin: 20vh;
		border-radius: 2px;
	}

	.reader-para-block:global(.is-landed) {
		background: var(--accent-soft);
		box-shadow:
			-6px 0 0 var(--accent-soft),
			6px 0 0 var(--accent-soft);
	}

	a.reader-para-num {
		text-decoration: none;
	}

	a.reader-para-num:hover {
		color: var(--accent);
	}

	.reader-para-block--sub {
		margin-bottom: 1em;
	}

	.reader-para-num {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-4);
		padding-top: 0.25em;
		text-align: right;
		line-height: 1.68;
		user-select: none;
		flex-shrink: 0;
	}

	.reader-para-block--sub .reader-para-num {
		font-size: 10px;
		opacity: 0.7;
	}

	.reader-para-inner {
		min-width: 0;
	}

	.reader-para-subtitle {
		font-family: var(--font-serif);
		font-weight: 600;
		font-size: 0.88em;
		letter-spacing: 0.01em;
		color: var(--ink-2);
		margin: 0 0 0.5em;
	}

	.reader-para-block .reader-para {
		margin: 0;
	}

	.reader-empty-text {
		font-style: italic;
		color: var(--fg-3);
		margin: 0;
	}
</style>
