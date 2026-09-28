<script lang="ts">
	// Reader for a document (memorie van toelichting, verslag, nota, amendement, motie, ...):
	// its text. Opened as the toelichting of an article, it lands on the passage for it.
	import ReaderFrame from './ReaderFrame.svelte';
	import { api, unwrap } from '$lib/api/client';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import GlossaryPill from './GlossaryPill.svelte';
	import { page } from '$app/state';
	import { landOn, permalink } from '$lib/bron/anchor';
	import { findPassage } from '$lib/text/find-passage';
	import { tick } from 'svelte';
	import { formatDate } from './_shared';

	let {
		node,
		article = null
	}: {
		node: Pick<GraphNode, 'key'>;
		/** The article whose toelichting is wanted; the reader opens at its passage. */
		article?: { lawId: string; articleNumber: string } | null;
	} = $props();

	type State =
		| { kind: 'loading' }
		| { kind: 'error'; message: string }
		| { kind: 'loaded'; document: Schema<'DocumentTextResponse'> };

	let view = $state<State>({ kind: 'loading' });
	/** Raised by Opnieuw: the load runs again. */
	let attempt = $state(0);

	$effect(() => {
		void attempt;
		const key = node.key;
		const ac = new AbortController();
		view = { kind: 'loading' };
		unwrap(api.GET('/api/documents/{key}', { params: { path: { key } }, signal: ac.signal }))
			.then((document) => {
				if (!ac.signal.aborted) view = { kind: 'loaded', document };
			})
			.catch(() => {
				if (!ac.signal.aborted)
					view = { kind: 'error', message: 'Document kon niet geladen worden.' };
			});
		return () => ac.abort();
	});

	// The source gives a paragraph per line. Each keeps its place in the text, so that
	// a passage can be found back.
	const paragraphs = $derived.by(() => {
		if (view.kind !== 'loaded' || !view.document.text) return [];
		const text = view.document.text;
		const out: { start: number; text: string }[] = [];
		for (const m of text.matchAll(/[^\n]+/g)) {
			if (m[0].trim()) out.push({ start: m.index, text: m[0].trim() });
		}
		return out;
	});

	// The headings of the paper (API 0.5): algemeen deel, artikelsgewijze toelichting per
	// artikel, ... Rendered as the same anchored, leden-like structure ArticleText gives
	// an article, instead of one long run of paragraphs.
	type Section = Schema<'SectionDTO'>;
	const sections = $derived<Section[]>(
		view.kind === 'loaded' ? (view.document.sections ?? []) : []
	);
	const headingTexts = $derived(new Set(sections.map((s) => s.heading.trim().toLowerCase())));

	type Entry =
		| { type: 'heading'; start: number; section: Section }
		| { type: 'para'; start: number; para: { start: number; text: string } };
	const entries = $derived.by<Entry[]>(() => {
		const out: Entry[] = sections.map((section) => ({
			type: 'heading',
			start: section.char_start,
			section
		}));
		for (const para of paragraphs) {
			// The heading's own line is already drawn as the heading; skip its duplicate.
			if (headingTexts.has(para.text.trim().toLowerCase())) continue;
			out.push({ type: 'para', start: para.start, para });
		}
		return out.sort((a, b) => a.start - b.start || (a.type === 'heading' ? -1 : 1));
	});

	// The passage for the article: from `/passages` (API 0.5), else a text match.
	// TODO(backend B5): `findPassage` goes when every document answers on `passages`.
	let apiPassage = $state<{ start: number; end: number; derived: boolean } | null | undefined>();
	$effect(() => {
		const key = node.key;
		const wanted = article;
		apiPassage = undefined;
		if (!wanted) return;
		const ac = new AbortController();
		api
			.GET('/api/documents/{key}/passages', {
				params: { path: { key }, query: { bwb_id: wanted.lawId, article: wanted.articleNumber } },
				signal: ac.signal
			})
			.then(({ data, response }) => {
				if (ac.signal.aborted) return;
				const first = response.ok ? data?.items[0] : undefined;
				apiPassage = first
					? { start: first.char_start, end: first.char_end, derived: first.confidence < 1 }
					: null;
			})
			.catch(() => {
				if (!ac.signal.aborted) apiPassage = null;
			});
		return () => ac.abort();
	});
	const passage = $derived(
		view.kind !== 'loaded' || !article
			? null
			: apiPassage === undefined
				? null
				: (apiPassage ?? findPassage(view.document.text ?? '', article.articleNumber))
	);
	// The paragraph the passage starts in; when it starts on a heading (a section of the
	// API), the first paragraph under it.
	const passageEntryIndex = $derived.by(() => {
		if (!passage) return -1;
		const containing = entries.findLastIndex(
			(e) =>
				e.type === 'para' &&
				e.start <= passage.start &&
				passage.start < e.start + e.para.text.length
		);
		if (containing >= 0) return containing;
		const inside = entries.findIndex(
			(e) => e.type === 'para' && e.start >= passage.start && e.start < passage.end
		);
		return inside >= 0
			? inside
			: entries.findLastIndex((e) => e.type === 'para' && e.start <= passage.start);
	});
	// Every entry of the passage: the one it lands on and all that start within it. A
	// section of the API spans all its leden and their headings; a text match ends in its
	// own line, so it stays one paragraph.
	const passageEntries = $derived.by(() => {
		const inPassage = new Set<number>();
		if (!passage || passageEntryIndex < 0) return inPassage;
		inPassage.add(passageEntryIndex);
		entries.forEach((e, i) => {
			if (e.start >= passage.start && e.start < passage.end) inPassage.add(i);
		});
		return inPassage;
	});
	const passageFirst = $derived(Math.min(...passageEntries));
	// The heading the passage falls under: the section with the latest start at or
	// before it, the way ArticleText marks the lid a citation lands in.
	const activeSectionId = $derived.by(() => {
		if (!passage) return null;
		let best: Section | null = null;
		for (const s of sections) {
			if (s.char_start <= passage.start && passage.start < s.char_end) {
				if (!best || s.char_start > best.char_start) best = s;
			}
		}
		return best?.id ?? null;
	});

	let root = $state<HTMLElement | null>(null);
	$effect(() => {
		if (passageEntryIndex < 0 || !root) return;
		const container = root;
		void tick().then(() => landOn(container, 'passage'));
	});

	/** What the last copy did, on the button that did it and in the live region. */
	let copied = $state<{ id: string; ok: boolean } | null>(null);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;
	async function copyLink(id: string) {
		let ok = true;
		try {
			await navigator.clipboard.writeText(permalink(page.url, id));
		} catch {
			// The clipboard is unavailable in some contexts.
			ok = false;
		}
		copied = { id, ok };
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => (copied = null), 2000);
	}

	// The kind is the source's own wording; where a glossary term exists the kicker links to it.
	function glossaryTerm(kind: string | null | undefined): string | null {
		const k = kind?.toLowerCase();
		if (!k) return null;
		if (k.includes('memorie') || k === 'mvt') return 'MvT';
		if (k.includes('verslag')) return 'Verslag';
		if (k.includes('nota')) return 'Nota';
		if (k.includes('amendement')) return 'Amendement';
		if (k.includes('motie')) return 'Motie';
		return null;
	}
</script>

<ReaderFrame>
	<div class="r-document" aria-busy={view.kind === 'loading'}>
		{#if view.kind === 'loading'}
			<p class="loading">Laden…</p>
		{:else if view.kind === 'error'}
			<p class="error">
				{view.message}
				<button type="button" class="btn is-text" onclick={() => attempt++}>Opnieuw</button>
			</p>
		{:else}
			{@const doc = view.document}
			{@const term = glossaryTerm(doc.kind)}
			{@const caseKinds = doc.case_kinds ?? []}
			<header class="head">
				<span class="kicker">
					{#if term}<GlossaryPill {term} label={doc.kind ?? term} />{:else}{doc.kind ??
							'Document'}{/if}
					{#if doc.date}<span class="dot">·</span>{formatDate(doc.date)}{/if}
					{#if caseKinds.length}<span class="dot">·</span>{caseKinds.join(', ')}{/if}
				</span>
				<h2 class="title">{doc.title ?? doc.key}</h2>
			</header>

			{#if doc.text}
				<div class="body" bind:this={root}>
					{#each entries as entry, i (entry.type === 'heading' ? entry.section.id : `p${entry.para.start}`)}
						{#if entry.type === 'heading'}
							{@const s = entry.section}
							<div
								class="heading heading--lvl{Math.min(s.level, 3)}"
								class:heading--active={s.id === activeSectionId}
								class:in-passage={passageEntries.has(i)}
								class:in-passage--cont={passageEntries.has(i) && i > passageFirst}
								id={s.id}
							>
								<span class="heading__text"
									>{s.heading}{#if s.kind === 'article' && s.article_refs?.length}
										<span class="heading__badge"
											>{s.article_refs.map((r) => r.number).join(', ')}</span
										>{/if}</span
								>
								<button
									type="button"
									class="heading__link"
									onclick={() => copyLink(s.id)}
									aria-label="Kopieer link naar {s.heading}"
									>{copied?.id === s.id
										? copied.ok
											? 'Gekopieerd'
											: 'Kopiëren mislukt'
										: 'Deel'}</button
								>
							</div>
						{:else if passageEntries.has(i)}
							<p
								class="body-para body-para--passage in-passage"
								class:in-passage--cont={i > passageFirst}
								id={i === passageEntryIndex ? 'passage' : undefined}
							>
								{entry.para.text}{#if i === passageEntryIndex && passage?.derived}<span
										class="derived"
										role="img"
										aria-label="afgeleid">≈</span
									>{/if}
							</p>
						{:else}
							<p class="body-para">{entry.para.text}</p>
						{/if}
					{/each}
				</div>
			{:else}
				<p class="empty">Geen tekst beschikbaar.</p>
			{/if}

			{#if doc.tk_url || doc.file_url}
				<footer class="foot">
					{#if doc.tk_url}
						<a href={doc.tk_url} target="_blank" rel="noopener noreferrer" class="full-link">
							tweedekamer.nl ↗
						</a>
					{/if}
					{#if doc.file_url}
						<a href={doc.file_url} target="_blank" rel="noopener noreferrer" class="full-link">
							Origineel bestand ↗
						</a>
					{/if}
				</footer>
			{/if}
		{/if}
	</div>
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
	.body-para--passage {
		scroll-margin: 20vh;
	}
	/* The passage about the article: one rule in the margin along its paragraphs and
	   headings, carried through the space between them. */
	.in-passage {
		position: relative;
	}
	.in-passage::before {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: -14px;
		width: 2px;
		background: var(--accent);
	}
	.in-passage--cont::before {
		top: calc(-1 * var(--s-4));
	}
	/* A heading already stands 8px out into the margin. */
	.heading.in-passage::before {
		left: -6px;
	}
	.derived {
		margin-left: 6px;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 400;
		color: var(--ink-3);
	}

	/* A heading of the paper: algemeen deel, artikelsgewijze toelichting, per artikel. */
	.heading {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		scroll-margin: 20vh;
		border-radius: var(--r-1);
		margin: var(--s-4) -8px 2px;
		padding: 3px var(--s-2);
	}
	.heading:global(.is-landed),
	.heading--active {
		background: var(--accent-soft);
	}
	.heading__text {
		flex: 1;
		min-width: 0;
	}
	.heading--lvl1 .heading__text {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 600;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		color: var(--ink-3);
	}
	.heading--lvl2 .heading__text {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		font-weight: 600;
		color: var(--ink);
	}
	.heading--lvl3 .heading__text {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		font-weight: 600;
		font-style: italic;
		color: var(--ink-2);
	}
	.heading__badge {
		margin-left: var(--s-2);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
	}
	/* Hidden by opacity, not visibility: Tab still reaches the link, and shows it. */
	.heading__link {
		flex: none;
		opacity: 0;
		padding: 2px var(--s-2);
		border: 0;
		background: none;
		font-family: var(--font-sans);
		font-size: var(--t-label);
		color: var(--ink-3);
		cursor: pointer;
	}
	.heading__link:hover {
		color: var(--accent);
	}
	.heading:hover .heading__link,
	.heading:focus-within .heading__link {
		opacity: 1;
	}
	@media (hover: none) {
		.heading__link {
			opacity: 1;
		}
	}
	.r-document {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
		color: var(--ink-2);
	}
	.loading,
	.error,
	.empty {
		font-family: var(--font-serif);
		font-style: italic;
		color: var(--ink-3);
		margin: 0;
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
	}
	.kicker {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
		display: flex;
		gap: 5px;
		align-items: baseline;
	}
	.dot {
		opacity: 0.6;
	}
	.title {
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 500;
		color: var(--ink);
		margin: 0;
		line-height: var(--lh-snug);
	}
	.body {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink);
		border-top: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
		padding: var(--s-3) 0;
	}

	.body-para {
		margin: 0;
	}
	.body-para + .body-para {
		margin-top: var(--s-3);
	}
	.foot {
		display: flex;
		gap: var(--s-4);
	}
	.full-link {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-2);
		text-decoration: none;
	}
	.full-link:hover {
		color: var(--accent);
	}
</style>
