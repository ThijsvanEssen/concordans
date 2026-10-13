<script lang="ts">
	import { eigenSoort, naamVan } from '$lib/bron/menselijk';
	import { getDocument } from '$lib/api/records';
	import CiteMenu from '$lib/components/ui/CiteMenu.svelte';
	import { citeItems } from '$lib/components/ui/cite';
	// Reader for a document (memorie van toelichting, verslag, nota, amendement, motie, ...):
	// its text. Opened as the toelichting of an article, it lands on the passage for it.
	import ReaderFrame from './ReaderFrame.svelte';
	import { api } from '$lib/api/client';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import GlossaryPill from './GlossaryPill.svelte';
	import { termOfKind } from '$lib/glossary';
	import { page } from '$app/state';
	import { landOn, permalink } from '$lib/bron/anchor';
	import { findPassage } from '$lib/text/find-passage';
	import { tick } from 'svelte';
	import { formatDate } from './_shared';
	import SubmitterLine from '$lib/bron/SubmitterLine.svelte';
	import StemmingUitslag from '$lib/components/parliamentary/StemmingUitslag.svelte';
	import Vervanging from '$lib/components/parliamentary/Vervanging.svelte';
	import { eigenUitslag, vervanging } from '$lib/components/parliamentary/vervanging';
	import { fromDocument } from '$lib/bron/submitters';
	import ReaderHead from './ReaderHead.svelte';
	import Bijlagen from './Bijlagen.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import BronLink from '$lib/bron/BronLink.svelte';
	import { getNodeFirst } from '$lib/api/records';
	import type { NodeGraph } from '$lib/api/nodes';
	import { kamerstukCitation } from '$lib/components/parliamentary/kamerstuk';
	import { dossierLabel } from '$lib/bron/dossier-naam';
	import { ensureInstrumentName, instrumentMetaStore } from '$lib/api/instrument-cache';

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

	// The key, not the node: the node is drawn anew with the same key once its
	// neighbourhood loads, and the record is not asked again for that.
	const bronKey = $derived(node.key);

	// The light node (the band asks it too, one request): the vergaderjaar and the dossier for
	// the citation, the count of the bijlagen.
	let licht = $state<NodeGraph | null>(null);
	$effect(() => {
		const key = bronKey;
		licht = null;
		let stale = false;
		getNodeFirst('documents', key)
			.then((r) => {
				if (!stale) licht = r;
			})
			.catch(() => {});
		return () => (stale = true);
	});
	const lichtProps = $derived((licht?.node.props ?? {}) as Record<string, unknown>);
	const tekstVan = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
	const bijlagen = $derived(
		licht?.neighbors.buckets?.find(
			(b) =>
				b.relation === 'ACCOMPANIES' && b.direction === 'inbound' && b.collection === 'documents'
		)?.total ?? 0
	);

	// The articles a memorie explains (`explains`), per law: the reverse of the Toelichting on
	// an article (concept 21). The laws' names are asked once each.
	const toegelicht = $derived.by(() => {
		if (view.kind !== 'loaded') return [];
		const perWet = new Map<string, { key: string; nummer: string }[]>();
		for (const e of view.document.explains ?? []) {
			if (e.collection !== 'articles' || !e.bwb_id || !e.article_number) continue;
			const rij = perWet.get(e.bwb_id) ?? [];
			rij.push({ key: e.key, nummer: e.article_number });
			perWet.set(e.bwb_id, rij);
		}
		// In the order of the law: 54a before 138c.
		const op = (a: { nummer: string }, b: { nummer: string }) =>
			a.nummer.localeCompare(b.nummer, 'nl', { numeric: true });
		return [...perWet].map(([bwbId, artikelen]) => ({ bwbId, artikelen: artikelen.sort(op) }));
	});
	$effect(() => {
		for (const w of toegelicht) ensureInstrumentName(w.bwbId);
	});

	$effect(() => {
		void attempt;
		const key = bronKey;
		const ac = new AbortController();
		view = { kind: 'loading' };
		getDocument(key)
			.then((document) => {
				if (!ac.signal.aborted) view = { kind: 'loaded', document };
			})
			.catch(() => {
				if (!ac.signal.aborted)
					view = { kind: 'error', message: 'Document kon niet worden geladen.' };
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

	// The passage for the article: from `/passages` (API 0.5), else a text match. Its
	// confidence is measured (API 0.70, 0.3 to 0.95): below 0.6 the passage reads as a
	// possible link, with what the match rests on (`explanation`) on hover.
	// TODO(backend B5): `findPassage` goes when every document answers on `passages`.
	let apiPassage = $state<
		{ start: number; end: number; possible: boolean; why: string | null } | null | undefined
	>();
	$effect(() => {
		const key = bronKey;
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
					? {
							start: first.char_start,
							end: first.char_end,
							possible: first.confidence < 0.6,
							why: first.explanation ?? null
						}
					: null;
			})
			.catch(() => {
				if (!ac.signal.aborted) apiPassage = null;
			});
		return () => ac.abort();
	});
	// A heading found in the text is a guess as well.
	const fromText = (p: { start: number; end: number } | null) =>
		p ? { start: p.start, end: p.end, possible: true, why: null } : null;
	const passage = $derived(
		view.kind !== 'loaded' || !article
			? null
			: apiPassage === undefined
				? null
				: (apiPassage ?? fromText(findPassage(view.document.text ?? '', article.articleNumber)))
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

	// The kind is the source's own wording; where a glossary term exists the kicker links to it.
	const glossaryTerm = termOfKind;
</script>

<ReaderFrame>
	<div class="r-document" aria-busy={view.kind === 'loading'}>
		{#if view.kind === 'loading'}
			<p class="loading stil">Laden…</p>
		{:else if view.kind === 'error'}
			<p class="error">
				{view.message}
				<button type="button" class="btn is-text" onclick={() => attempt++}>Opnieuw</button>
			</p>
		{:else}
			{@const doc = view.document}
			{@const term = glossaryTerm(doc.kind)}
			<!-- Without the group of kinds the source files it under (#58): "Amendement". -->
			{@const kind = eigenSoort(doc.kind)}
			{@const cite = kamerstukCitation({
				chamber: doc.chamber,
				session_year: tekstVan(lichtProps.session_year),
				dossier_number: tekstVan(lichtProps.dossier_number) ?? doc.dossier_numbers?.[0],
				dossier_suffix: tekstVan(lichtProps.dossier_suffix),
				number: doc.number
			})}
			{@const naam = cite ?? doc.title ?? naamVan('documents', doc)}
			<!-- The kind of the case the stuk is in, where it adds to the stuk's own: a motie is in
			     a case of the kind Motie, which "Motie, 7 sep. 2026, Motie" said twice. -->
			{@const caseKinds = (doc.case_kinds ?? []).filter(
				(k) => !doc.kind?.toLowerCase().startsWith(k.toLowerCase())
			)}
			<ReaderHead
				collection="documents"
				title={doc.title ?? naamVan('documents', doc)}
				acties={{
					bewaar: {
						id: `documents/${doc.key}`,
						at: '',
						kort: naam,
						voluit: cite && kind ? `${cite} (${kind})` : naam,
						groep: doc.dossier_numbers?.[0]
							? dossierLabel({ number: doc.dossier_numbers[0] })
							: naam
					},
					cite: cite
						? citeItems(
								{ kort: cite, voluit: doc.title ? `${cite}, ${doc.title}` : cite },
								permalink(page.url, '')
							)
						: [],
					naam,
					bron: doc.tk_url ? { label: 'tweedekamer.nl', href: doc.tk_url } : null,
					tekst: doc.text ? () => doc.text ?? '' : undefined
				}}
			>
				{#snippet soort()}
					<!-- Running text, the comma against the word before it. -->
					<span
						>{#if term}<GlossaryPill {term} label={kind ?? term} />{:else}{kind ??
								'Document'}{/if}{#if doc.date}, {formatDate(doc.date)}{/if}{#if caseKinds.length},
							{caseKinds.join(', ')}{/if}</span
					>
				{/snippet}
				{#snippet onderTitel()}
					{#if doc.submitters?.length}
						<p class="submitted"><SubmitterLine submitters={fromDocument(doc.submitters)} /></p>
					{/if}
				{/snippet}
				<!-- The stuk as it is cited, the chain of an amended amendment or motion (from the
				     document's replaces and replaced_by, the direct step only) and its bijlagen. -->
				{#snippet status()}
					{#if cite}<span>{cite}.</span>{/if}
					<Vervanging zinnen={vervanging(doc)} />
					{#if bijlagen > 0}<Bijlagen
							collection="documents"
							bronKey={doc.key}
							aantal={bijlagen}
						/>{/if}
				{/snippet}
			</ReaderHead>

			{#if toegelicht.length > 0}
				<Sectie titel="Licht toe" soort="articles" aantal={doc.explains?.length ?? 0}>
					<ul class="toegelicht">
						{#each toegelicht as w (w.bwbId)}
							{@const wet = $instrumentMetaStore.get(w.bwbId)}
							<li>
								<span class="wet">{wet?.shortTitle ?? wet?.title ?? w.bwbId}</span>
								{#each w.artikelen as a, i (a.key)}{i > 0 ? ', ' : ' art. '}<BronLink
										ref={{ collection: 'articles', key: a.key }}>{a.nummer}</BronLink
									>{/each}
							</li>
						{/each}
					</ul>
				</Sectie>
			{/if}

			<!-- A replaced stuk has no outcome of its own: the stuk that replaced it came to the vote. -->
			<StemmingUitslag decisions={eigenUitslag(doc) ? (doc.decisions ?? []) : []} />

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
								<!-- A heading for a screen reader, Citeer beside it (UX-toets 10 Oct, #21). -->
								<svelte:element this={`h${Math.min(s.level, 3) + 2}`} class="heading__text"
									>{s.heading}{#if s.kind === 'article' && s.article_refs?.length}
										<span class="heading__badge"
											>{s.article_refs.map((r) => r.number).join(', ')}</span
										>{/if}</svelte:element
								>
								<CiteMenu
									items={citeItems(null, permalink(page.url, s.id))}
									name={s.heading}
									buttonClass="heading__link"
								/>
							</div>
						{:else if passageEntries.has(i)}
							<p
								class="body-para body-para--passage in-passage"
								class:in-passage--cont={i > passageFirst}
								id={i === passageEntryIndex ? 'passage' : undefined}
								title={i === passageEntryIndex ? (passage?.why ?? undefined) : undefined}
							>
								{entry.para.text}{#if i === passageEntryIndex && passage?.possible}<span
										class="derived"
										title={passage.why ?? undefined}>mogelijk verband</span
									>{/if}
							</p>
						{:else}
							<p class="body-para">{entry.para.text}</p>
						{/if}
					{/each}
				</div>
			{:else}
				<p class="empty">Tekst niet in de gegevens.</p>
			{/if}

			{#if doc.file_url}
				<!-- The page at the Tweede Kamer is in Citeer; the file the text came from here. -->
				<footer class="foot">
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

<style>
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
		background: var(--ink);
	}
	.in-passage--cont::before {
		top: calc(-1 * var(--s-4));
	}
	/* A heading already stands 8px out into the margin. */
	.heading.in-passage::before {
		left: -6px;
	}
	.derived {
		margin-left: var(--s-2);
		font-family: var(--font-serif);
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
		margin: var(--s-4) calc(-1 * var(--s-2)) 2px;
		padding: var(--s-1) var(--s-2);
	}
	.heading:global(.is-landed),
	.heading--active {
		background: var(--paper-2);
	}
	.heading__text {
		flex: 1;
		min-width: 0;
		/* A heading element with the line's own type: no margin or size of its own. */
		margin: 0;
		font: inherit;
	}
	.heading--lvl1 .heading__text {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
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
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	/* Hidden by opacity, not visibility: Tab still reaches the link, and shows it. */
	:global(.heading__link) {
		flex: none;
		opacity: 0;
		padding: 2px var(--s-2);
		border: 0;
		background: none;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
		cursor: pointer;
	}
	:global(.heading__link):hover {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	.heading:hover :global(.heading__link),
	.heading:focus-within :global(.heading__link) {
		opacity: 1;
	}
	@media (hover: none) {
		:global(.heading__link) {
			opacity: 1;
		}
	}
	.r-document {
		display: flex;
		flex-direction: column;
		/* Its step between blocks, which the head subtracts from its own (ReaderHead). */
		--lezer-stap: var(--s-3);
		gap: var(--lezer-stap);
		color: var(--ink-2);
	}
	.loading,
	.error,
	.empty {
		margin: 0;
	}
	/* Who submitted a motie or amendement, under its title. */
	.submitted {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.toegelicht {
		margin: 0;
		padding: 0;
		list-style: none;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.toegelicht li {
		padding: var(--s-1) 0;
	}
	.wet {
		color: var(--ink);
	}
	.submitted :global(a) {
		color: var(--ink);
		text-decoration: none;
		border-bottom: 1px solid var(--rule-strong);
	}
	.submitted :global(a:hover) {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
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
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-2);
		text-decoration: none;
	}
	.full-link:hover {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
</style>
