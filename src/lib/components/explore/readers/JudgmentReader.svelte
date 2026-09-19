<script lang="ts">
	// Reader for judgments: header, summary, subjects, participants and the
	// numbered body. Text restructuring lives in judgment-text.ts.
	import { getJudgmentDetail } from '$lib/api/judgments';
	import type { JudgmentDetailResponse } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import { formatEcliLabel } from '$lib/graph/types';
	import LidText from '$lib/components/articles/LidText.svelte';
	import ReaderFrame from './ReaderFrame.svelte';
	import ReaderHead from './ReaderHead.svelte';
	import {
		extractParticipants,
		extractPartyInfo,
		normalizeParagraphText,
		parseSubjects,
		splitBodyParagraph,
		splitSummary
	} from './judgment-text';

	let {
		selection,
		onNavigate
	}: {
		selection: GraphNode | null;
		onNavigate?: (collection: string, key: string) => void;
	} = $props();

	type View =
		| { kind: 'empty' }
		| { kind: 'loading' }
		| { kind: 'error'; message: string }
		| { kind: 'loaded'; data: JudgmentDetailResponse };

	let view = $state<View>({ kind: 'empty' });
	let subjectsOpen = $state(false);
	let token = 0;

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

	function textParagraphs(text: string): string[] {
		return text.split(/\r?\n\s*\r?\n+/).filter((p) => p.trim().length > 0);
	}

	$effect(() => {
		const node = selection;
		const t = ++token;
		subjectsOpen = false;
		if (!node) {
			view = { kind: 'empty' };
			return;
		}

		const props = node.raw?.props as Record<string, unknown> | undefined;
		const ecli = String(props?.['ecli'] ?? node.key);
		view = { kind: 'loading' };
		getJudgmentDetail(ecli.startsWith('ECLI:') ? ecli : `ECLI:${ecli}`)
			.then((data) => {
				if (t === token) view = { kind: 'loaded', data };
			})
			.catch(() => {
				if (t === token) view = { kind: 'error', message: 'Uitspraak kon niet geladen worden.' };
			});
	});
</script>

<ReaderFrame
	status={view.kind === 'loaded' ? 'ready' : view.kind}
	message={view.kind === 'error' ? view.message : ''}
>
	{#if view.kind === 'loaded'}
		{@const j = view.data.judgment}
		{@const meta = j.judgment_metadata}
		{@const judgmentDate = meta?.date
			? new Date(meta.date).toLocaleDateString('nl-NL', {
					day: 'numeric',
					month: 'short',
					year: 'numeric'
				})
			: null}
		{@const firstSubheading = j.paragraphs?.find((p) => p.kind === 'subheading')}
		{@const partyLines = firstSubheading ? extractPartyInfo(firstSubheading.text) : null}
		{@const participants = extractParticipants(j.paragraphs ?? [], partyLines)}
		{@const hasSummary = !!(j.summary && j.summary.trim() && j.summary.trim() !== 'rechtspraak')}
		<ReaderHead
			sigil="¶"
			tone="judgment"
			kind={meta?.type ?? 'Uitspraak'}
			juris={meta?.court}
			title={j.shorthand ?? (j.ecli ? formatEcliLabel(j.ecli) : null) ?? 'Uitspraak'}
		>
			<div class="reader-meta-row">
				{#if judgmentDate}<span class="reader-meta-item">{judgmentDate}</span>{/if}
				{#if meta?.case_number}
					<span class="reader-meta-item reader-meta-item--mono">{meta.case_number}</span>
				{/if}
				{#if j.ecli}
					<a
						href="https://deeplink.rechtspraak.nl/uitspraak?id={encodeURIComponent(j.ecli)}"
						target="_blank"
						rel="noopener noreferrer"
						class="reader-source-link">Rechtspraak.nl ↗</a
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

		{#if j.subjects && j.subjects.length > 0}
			<div class="reader-subjects-wrap">
				<button
					type="button"
					class="reader-subjects-toggle"
					onclick={() => (subjectsOpen = !subjectsOpen)}
					aria-expanded={subjectsOpen}
				>
					<span class="reader-subjects-label">Onderwerpen</span>
					<span class="reader-subjects-count">{j.subjects.length}</span>
					<span class="reader-subjects-chevron" class:open={subjectsOpen} aria-hidden="true">›</span
					>
				</button>
				{#if subjectsOpen}
					<div class="reader-subjects">
						{#each [...parseSubjects(j.subjects).entries()] as [top, subs], idx (idx)}
							<div class="subject-row">
								<span class="subject-top">{top}</span>
								{#if subs.length > 0}
									<span class="subject-subs">
										{#each subs as sub, i (i)}
											{#if i > 0}<span class="subject-sep" aria-hidden="true">·</span>{/if}
											<span class="subject-sub">{sub}</span>
										{/each}
									</span>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
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

		<div class="reader-body">
			{#if j.paragraphs && j.paragraphs.length > 0}
				{#each j.paragraphs as para, paraIdx (paraIdx)}
					{#if para.kind === 'subheading'}
						<!-- The first subheading is replaced by the participants table above. -->
						{#if paraIdx > 0}
							<p class="reader-subheading">{normalizeParagraphText(para.text)}</p>
						{/if}
					{:else if para.kind === 'heading'}
						{@const clean = normalizeParagraphText(para.text)}
						<h3 class="reader-heading" id={headingId(clean)}>{clean}</h3>
					{:else}
						{#each splitBodyParagraph(para.text) as seg, i (i)}
							{#if seg.kind === 'heading'}
								<h3 class="reader-heading" id={headingId(seg.text)}>{seg.text}</h3>
							{:else if seg.num}
								<div
									class="reader-para-block"
									class:reader-para-block--sub={seg.depth > 0}
									style={seg.depth > 1 ? `padding-left:${(seg.depth - 1) * 1.2}em` : ''}
								>
									<span class="reader-para-num">{seg.num}</span>
									<div class="reader-para-inner">
										{#if seg.subTitle}
											<p class="reader-para-subtitle">{seg.subTitle}</p>
										{/if}
										<p class="reader-para">
											{#if para.citaties && para.citaties.length > 0}
												<LidText text={seg.body} citaties={para.citaties} {onNavigate} />
											{:else}
												{seg.body}
											{/if}
										</p>
									</div>
								</div>
							{:else}
								<p class="reader-para reader-para--prose">
									{#if para.citaties && para.citaties.length > 0}
										<LidText text={para.text} citaties={para.citaties} {onNavigate} />
									{:else}
										{seg.body}
									{/if}
								</p>
							{/if}
						{/each}
					{/if}
				{/each}
			{:else if j.text && j.text.trim().length > 0}
				{#each textParagraphs(j.text) as para, i (i)}
					<p class="reader-para">{para}</p>
				{/each}
			{:else if !hasSummary}
				<p class="reader-empty-text">
					Voor deze uitspraak is nog geen tekst beschikbaar in Concordans.
					{#if j.ecli}
						Bekijk het origineel op
						<a
							href="https://deeplink.rechtspraak.nl/uitspraak?id={encodeURIComponent(j.ecli)}"
							target="_blank"
							rel="noopener noreferrer">rechtspraak.nl</a
						>.
					{/if}
				</p>
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

	/* Summary and subjects */
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

	.reader-subjects-wrap {
		margin: 0 0 var(--s-5);
		border-left: 3px solid color-mix(in srgb, var(--indigo) 40%, transparent);
	}

	.reader-subjects-toggle {
		display: flex;
		align-items: center;
		gap: 7px;
		width: 100%;
		padding: var(--s-2) var(--s-4);
		background: color-mix(in srgb, var(--indigo) 5%, var(--paper));
		border: 0;
		cursor: pointer;
		font-family: var(--font-sans);
		font-size: 11px;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--indigo) 70%, var(--ink));
		text-align: left;
	}

	.reader-subjects-toggle:hover {
		background: color-mix(in srgb, var(--indigo) 10%, var(--paper));
	}

	.reader-subjects-label {
		flex: 1;
	}

	.reader-subjects-count {
		font-family: var(--font-mono);
		font-size: 10px;
		color: color-mix(in srgb, var(--indigo) 60%, transparent);
		letter-spacing: 0;
		text-transform: none;
	}

	.reader-subjects-chevron {
		display: inline-block;
		font-size: 16px;
		line-height: 1;
		transition: transform var(--dur-1) var(--ease);
		letter-spacing: 0;
		text-transform: none;
		color: color-mix(in srgb, var(--indigo) 50%, transparent);
	}

	.reader-subjects-chevron.open {
		transform: rotate(90deg);
	}

	.reader-subjects {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: var(--s-3) var(--s-4) var(--s-4);
		background: color-mix(in srgb, var(--indigo) 3%, var(--paper));
		max-width: 68ch;
	}

	.subject-row {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 6px;
	}

	.subject-top {
		font-family: var(--font-sans);
		font-size: 11px;
		font-weight: 600;
		color: var(--indigo);
		letter-spacing: 0.02em;
	}

	.subject-subs {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 3px 5px;
	}

	.subject-subs::before {
		content: '›';
		font-size: 12px;
		color: color-mix(in srgb, var(--indigo) 40%, transparent);
		line-height: 1;
	}

	.subject-sub {
		font-family: var(--font-sans);
		font-size: 11px;
		color: color-mix(in srgb, var(--indigo) 70%, var(--ink));
	}

	.subject-sep {
		font-size: 10px;
		color: color-mix(in srgb, var(--indigo) 35%, transparent);
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
