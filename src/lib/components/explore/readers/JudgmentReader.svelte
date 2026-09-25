<script lang="ts">
	import { bronHref } from '$lib/bron/href';
	// Reader for judgments: header, summary, participants and the numbered body.
	// Text restructuring lives in judgment-text.ts.
	import { menu } from '$lib/actions/menu';
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
		headingId,
		judgmentParticipants,
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

	// The anchor of an overweging: `paragraph_id` for the first sub-paragraph split out of
	// an API paragraph, else built from its number — a later split shares one `paragraph_id`
	// with the first and needs its own anchor.
	const rov = (number: string, id?: string | null) => id || `rov-${number}`;

	// Citeren van een overweging, parallel aan `citeArticle` voor een lid.
	function citeOverweging(
		num: string,
		ecliStr: string | null,
		dateLabel: string | null,
		id: string
	) {
		if (!ecliStr) return null;
		const short = formatEcliLabel(ecliStr);
		return {
			kort: `${short}, r.o. ${num}`,
			voluit: `${ecliStr}, r.o. ${num}`,
			metDatum: `${short}, r.o. ${num}${dateLabel ? ` (${dateLabel})` : ''}`,
			link: permalink(page.url, id)
		};
	}

	let menuFor = $state<string | null>(null);
	/** What the last copy did, on the button that did it and in the live region. */
	let copied = $state<{ key: string; ok: boolean } | null>(null);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;
	async function copyText(text: string, key: string) {
		let ok = true;
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			// The clipboard is unavailable in some contexts.
			ok = false;
		}
		copied = { key, ok };
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => (copied = null), 2000);
		menuFor = null;
	}
	const copyLabel = (key: string, idle: string) =>
		copied?.key === key ? (copied.ok ? 'Gekopieerd' : 'Kopiëren mislukt') : idle;
	const copyLink = (id: string) => copyText(permalink(page.url, id), `share:${id}`);

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
		{@const participants = judgmentParticipants(j)}
		{@const hasSummary = !!j.summary?.trim()}
		<ReaderHead
			collection="judgments"
			juris={textProp(j.props?.court)}
			title={(j.ecli ? formatEcliLabel(j.ecli) : (j.display_name ?? 'Uitspraak')) +
				(j.names?.length ? ` (${j.names.join(', ')})` : '')}
		>
			<div class="reader-meta-row">
				{#if j.decision_kind}
					<span class="reader-meta-item"
						>{j.decision_kind.charAt(0).toUpperCase() + j.decision_kind.slice(1)}</span
					>
				{/if}
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
			{#if j.translation_of}
				<p class="reader-translation">
					Vertaling van
					<a
						href={bronHref({
							collection: 'judgments',
							key: j.translation_of.toLowerCase().replaceAll(':', '_')
						})}
						data-sveltekit-noscroll>{j.translation_of}</a
					>. De samenvatting hieronder is die van het origineel.
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
			<table class="reader-parties" id="parties">
				<tbody>
					{#each participants as p, i (i)}
						<tr>
							<th
								class="reader-parties-role"
								title={p.stated === false ? 'Rol afgeleid uit rechtsgebied en kop' : undefined}
							>
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
					{@const hid = headingId(clean)}
					<h3 class="reader-heading" id={hid}>
						<span class="reader-heading__text">{clean}</span>
						<button
							type="button"
							class="reader-heading__link"
							onclick={() => copyLink(hid)}
							aria-label="Kopieer link naar {clean}">{copyLabel(`share:${hid}`, 'Deel')}</button
						>
					</h3>
				{:else}
					{#each splitBodyParagraph(para.text, para.citations) as seg, i (i)}
						{#if seg.kind === 'heading'}
							{@const hid = headingId(seg.text)}
							<h3 class="reader-heading" id={hid}>
								<span class="reader-heading__text">{seg.text}</span>
								<button
									type="button"
									class="reader-heading__link"
									onclick={() => copyLink(hid)}
									aria-label="Kopieer link naar {seg.text}"
									>{copyLabel(`share:${hid}`, 'Deel')}</button
								>
							</h3>
						{:else if seg.num || (i === 0 && para.number)}
							{@const num = String(seg.num ?? para.number)}
							{@const rovId = rov(num, i === 0 ? para.paragraph_id : null)}
							{@const forms = citeOverweging(num, j.ecli ?? null, judgmentDate, rovId)}
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
											<span
												class="menu"
												use:menu={{ open: menuFor === rovId, close: () => (menuFor = null) }}
											>
												<button
													type="button"
													class="btn reader-para-btn"
													aria-haspopup="menu"
													aria-expanded={menuFor === rovId}
													onclick={() => (menuFor = menuFor === rovId ? null : rovId)}
													>{copyLabel(`cite:${rovId}`, 'Citeer')}</button
												>
												{#if menuFor === rovId}
													<div class="pop" role="menu" aria-label="Citeer overweging {num}">
														<div class="pop__label">Kopieer als</div>
														<button
															type="button"
															role="menuitem"
															class="pop__item"
															onclick={() => copyText(forms.kort, `cite:${rovId}`)}
															><span>{forms.kort}</span><span class="pop__k">kort</span></button
														>
														<button
															type="button"
															role="menuitem"
															class="pop__item"
															onclick={() => copyText(forms.voluit, `cite:${rovId}`)}
															><span>{forms.voluit}</span><span class="pop__k">voluit</span></button
														>
														<button
															type="button"
															role="menuitem"
															class="pop__item"
															onclick={() => copyText(forms.metDatum, `cite:${rovId}`)}
															><span>{forms.metDatum}</span><span class="pop__k">met datum</span
															></button
														>
														<button
															type="button"
															role="menuitem"
															class="pop__item"
															onclick={() => copyText(forms.link, `cite:${rovId}`)}
															><span class="pop__link">{forms.link}</span><span class="pop__k"
																>link</span
															></button
														>
													</div>
												{/if}
											</span>
										{/if}
										<button
											type="button"
											class="btn reader-para-btn"
											onclick={() => copyLink(rovId)}>{copyLabel(`share:${rovId}`, 'Deel')}</button
										>
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
			{#if paragraphs.length === 0 && !hasSummary}
				<p class="reader-empty-text">Geen tekst beschikbaar.</p>
			{/if}
		</div>
	{/if}
</ReaderFrame>
<p class="visually-hidden" aria-live="polite">
	{copied ? (copied.ok ? 'Gekopieerd' : 'Kopiëren mislukt') : ''}
</p>

<style>
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

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

	.reader-meta-item--mono {
		font-variant-numeric: tabular-nums;
	}

	.reader-source-link {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
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
	.reader-parties {
		width: 100%;
		max-width: var(--measure);
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
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
		text-align: left;
		white-space: nowrap;
		padding: 6px 12px 6px var(--s-4);
		vertical-align: top;
		width: 7em;
	}

	.reader-parties-name {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
		padding: 6px var(--s-4) 6px 0;
		vertical-align: top;
	}

	.reader-parties-party {
		display: block;
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
		gap: 8px;
		font-family: var(--font-serif);
		font-size: 1em;
		font-weight: 600;
		line-height: var(--lh-snug);
		color: var(--ink);
		margin: 2.2em 0 0.5em;
		padding: 1.4em 8px 3px;
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
	.reader-heading__link {
		flex: none;
		opacity: 0;
		padding: 2px 8px;
		border: 0;
		background: none;
		font-family: var(--font-sans);
		font-size: 11.5px;
		font-weight: 400;
		color: var(--ink-3);
		cursor: pointer;
	}

	.reader-heading__link:hover {
		color: var(--accent);
	}

	.reader-heading:hover .reader-heading__link,
	.reader-heading:focus-within .reader-heading__link {
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
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-variant-numeric: tabular-nums;
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
		gap: 4px;
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
		.reader-heading__link,
		.reader-para-actions {
			opacity: 1;
		}
	}

	.reader-para-btn {
		padding: 2px 8px;
		font-size: 11.5px;
	}

	.menu {
		position: relative;
	}

	.pop {
		position: absolute;
		right: 0;
		top: calc(100% + 6px);
		z-index: var(--z-float);
		width: 320px;
		padding: 8px 0;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		box-shadow: var(--shadow-modal);
		font-family: var(--font-sans);
		font-size: 12.5px;
		text-align: left;
	}

	.pop__label {
		padding: 2px 12px 6px;
		font-size: 11.5px;
		color: var(--ink-3);
	}

	.pop__item {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		width: 100%;
		padding: 6px 12px;
		border: 0;
		background: none;
		font: inherit;
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}

	.pop__item:hover {
		background: var(--paper-2);
	}

	.pop__k {
		flex: none;
		font-size: 11.5px;
		color: var(--ink-3);
	}

	.pop__link {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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

	.reader-translation {
		margin: var(--s-2) 0 0;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
</style>
