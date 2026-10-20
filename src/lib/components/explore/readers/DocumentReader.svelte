<script lang="ts">
	import { ownKind } from '$lib/text/document-kind';
	import { NL } from '$lib/text/collator';
	import { korteDatum } from '$lib/text/datum';
	import { naamVan } from '$lib/bron/menselijk';
	import {
		citePaper,
		paperParagraphCite,
		paperSectionCite
	} from '$lib/components/parliamentary/paper-cite';
	import {
		paperBlocks,
		paperParagraphs,
		parseAnchor,
		paperSectionOf,
		type PaperBlock
	} from '$lib/text/anchor';
	import PlaatsMenu, { placeMarker } from '$lib/components/articles/PlaatsMenu.svelte';
	import { blockClick } from '$lib/actions/klik';
	import { kaart } from '$lib/map/map.svelte';
	import { getDocument } from '$lib/api/records';
	import { citeItems } from '$lib/components/ui/cite-items';
	// Reader for a document (memorie van toelichting, verslag, nota, amendement, motie, ...):
	// its text. Opened as the toelichting of an article, it lands on the passage for it.
	import ReaderFrame from './ReaderFrame.svelte';
	import { getDocumentPassages } from '$lib/api/documents';
	import { ifExists, report } from '$lib/api/errors';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import GlossaryPill from './GlossaryPill.svelte';
	import { termOfKind } from '$lib/glossary';
	import { page } from '$app/state';
	import { anchorOfHash, landOn, permalink } from '$lib/bron/landing';
	import CitedText from '$lib/components/articles/CitedText.svelte';
	import TextBlocks from '$lib/components/articles/TextBlocks.svelte';
	import Voetnoten from '$lib/components/articles/Voetnoten.svelte';
	import { kantlijn } from '$lib/actions/kantlijn';
	import { isNootAnker, regelVan, stukNoten, type Bereik } from '$lib/text/voetnoten';
	import { zetNootStand } from '$lib/text/voetnoten.svelte';
	import { markeringVoor } from '$lib/bron/markering.svelte';
	import { findPassage } from '$lib/text/find-passage';
	import { afterTick } from '$lib/util/after-tick';
	import SubmitterLine from '$lib/bron/SubmitterLine.svelte';
	import StemmingUitslag from '$lib/components/parliamentary/StemmingUitslag.svelte';
	import Vervanging from '$lib/components/parliamentary/Vervanging.svelte';
	import { eigenUitslag, vervanging } from '$lib/components/parliamentary/vervanging';
	import { fromDocument } from '$lib/bron/submitters';
	import ReaderHead from './ReaderHead.svelte';
	import DocumentAttachments from './DocumentAttachments.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import BronLink from '$lib/bron/BronLink.svelte';
	import { getNodeFirst } from '$lib/api/records';
	import type { NodeGraph } from '$lib/api/nodes';
	import { ensureInstrumentName, instrumentMetaStore } from '$lib/api/instrument-cache';
	import { load } from '$lib/util/load.svelte';

	let {
		node,
		article = null
	}: {
		node: Pick<GraphNode, 'key'>;
		/** The article whose toelichting is wanted; the reader opens at its passage. */
		article?: { lawId: string; articleNumber: string } | null;
	} = $props();

	// The key, not the node: the node is drawn anew with the same key once its
	// neighbourhood loads, and the record is not asked again for that.
	const bronKey = $derived(node.key);
	const record = load(
		() => bronKey,
		(key) => getDocument(key),
		'Document'
	);
	const loaded = $derived(record.state.status === 'ready' ? record.state.data : null);

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
			.catch((e) => report('Lichte bron van het document', e));
		return () => (stale = true);
	});
	const lichtProps = $derived((licht?.node.props ?? {}) as Record<string, unknown>);
	const bijlagen = $derived(
		licht?.neighbors.buckets?.find(
			(b) =>
				b.relation === 'ACCOMPANIES' && b.direction === 'inbound' && b.collection === 'documents'
		)?.total ?? 0
	);

	// The articles a memorie explains (`explains`), per law: the reverse of the Toelichting on
	// an article (concept 21). The laws' names are asked once each.
	const toegelicht = $derived.by(() => {
		const perWet = new Map<string, { key: string; nummer: string }[]>();
		for (const e of loaded?.explains ?? []) {
			if (e.collection !== 'articles' || !e.bwb_id || !e.article_number) continue;
			const rij = perWet.get(e.bwb_id) ?? [];
			rij.push({ key: e.key, nummer: e.article_number });
			perWet.set(e.bwb_id, rij);
		}
		// In the order of the law: 54a before 138c.
		const op = (a: { nummer: string }, b: { nummer: string }) => NL.compare(a.nummer, b.nummer);
		return [...perWet].map(([bwbId, artikelen]) => ({ bwbId, artikelen: artikelen.sort(op) }));
	});
	$effect(() => {
		for (const w of toegelicht) ensureInstrumentName(w.bwbId);
	});

	// The source gives a paragraph per line (paperParagraphs): each keeps its place in the text,
	// so that a passage can be found back; an alinea its number and anchor as the API gives
	// them (`paragraphs`: `4`, `p-360a090c`), the head of the stuk and a motie's formula none.
	const paragraphs = $derived(paperParagraphs(loaded ?? {}));
	// An alinea with a table (its title and its rows) is one block, the table laid out
	// (TextBlocks); every other line its own.
	const blocks = $derived(paperBlocks(paragraphs, loaded ?? {}));
	/** The words of an alinea, a table's every line: what Kopieer tekst copies. */
	const alineaText = (at: string | null) =>
		paragraphs
			.filter((p) => p.at === at)
			.map((p) => p.text)
			.join('\n');

	// The menu of a place (as an overweging's, a lid's), by its anchor: of an alinea its marker
	// in the margin opens it, and a click on its text, not on a link or a selection; of a
	// passage (a section: the toelichting on an article) its heading.
	let menu = $state<{ at: string; marker: HTMLElement } | null>(null);
	function openMenu(at: string, marker: HTMLElement) {
		menu = menu?.at === at ? null : { at, marker };
	}
	const onText = (at: string) => (e: MouseEvent) => {
		const marker = placeMarker(e, '.body-para');
		if (marker) openMenu(at, marker);
	};

	// The headings of the paper (API 0.5): algemeen deel, artikelsgewijze toelichting per
	// artikel, ... Rendered as the same anchored, leden-like structure ArticleText gives
	// an article, instead of one long run of paragraphs.
	type Section = Schema<'SectionDTO'>;
	const sections = $derived<Section[]>(loaded?.sections ?? []);
	const headingTexts = $derived(new Set(sections.map((s) => s.heading.trim().toLowerCase())));

	type Entry =
		| { type: 'heading'; start: number; section: Section }
		| { type: 'para'; start: number; end: number; block: PaperBlock };

	// The footnotes (API 0.79.55): a marker in the paragraph that refers to a note, the note
	// under it or in the margin; one without a marker at the end of its section, else of the stuk.
	const voetnoten = $derived(stukNoten(loaded?.footnotes ?? [], paragraphs, sections));
	const noten = zetNootStand();
	const nootLijst = (ids: readonly string[] | undefined) =>
		(ids ?? []).flatMap((id) => voetnoten.noten.get(id) ?? []);

	// An anchor in the address: a section, a note (`#fn-71`) opened, with the words a row or a
	// card came for marked; in the text, the paragraph that holds them.
	const anchor = $derived(anchorOfHash(page.url.hash));
	const markering = $derived(markeringVoor(`documents/${bronKey}`, anchor));
	const tekstBereik = $derived.by<{ i: number; bereik: Bereik } | null>(() => {
		const b = markering?.bereik;
		if (!b || isNootAnker(anchor)) return null;
		const i = regelVan(paragraphs, b.start);
		if (i < 0) return null;
		const p = paragraphs[i];
		return { i, bereik: { start: b.start - p.start, end: b.end - p.start } };
	});
	/** The note markers of a block's lines, `at` in its text. */
	const blockMarkers = (b: PaperBlock) => {
		const all = b.lines.flatMap((l) =>
			(voetnoten.markers.get(l.i) ?? []).map((m) => ({
				...m,
				at: m.at === null ? null : m.at + l.start - b.start
			}))
		);
		return all.length ? all : undefined;
	};
	/** The marked words where they fall in a block, offsets in its text. */
	const markedIn = (b: PaperBlock): Bereik | null => {
		const l = tekstBereik ? b.lines.find((x) => x.i === tekstBereik.i) : undefined;
		if (!l || !tekstBereik) return null;
		const shift = l.start - b.start;
		return { start: tekstBereik.bereik.start + shift, end: tekstBereik.bereik.end + shift };
	};
	const entries = $derived.by<Entry[]>(() => {
		const out: Entry[] = sections.map((section) => ({
			type: 'heading',
			start: section.char_start,
			section
		}));
		for (const block of blocks) {
			// The heading's own line is already drawn as the heading; skip its duplicate.
			if (block.lines.length === 1 && headingTexts.has(block.line.text.trim().toLowerCase()))
				continue;
			out.push({ type: 'para', start: block.start, end: block.start + block.text.length, block });
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
		ifExists(
			getDocumentPassages(key, { bwb_id: wanted.lawId, article: wanted.articleNumber }, ac.signal)
		)
			.then((data) => {
				if (ac.signal.aborted) return;
				const first = data?.items[0];
				apiPassage = first
					? {
							start: first.char_start,
							end: first.char_end,
							possible: first.confidence < 0.6,
							why: first.explanation ?? null
						}
					: null;
			})
			.catch((e) => {
				// The passage is then found in the text, as a guess.
				report('Passage', e);
				if (!ac.signal.aborted) apiPassage = null;
			});
		return () => ac.abort();
	});
	// A heading found in the text is a guess as well.
	const fromText = (p: { start: number; end: number } | null) =>
		p ? { start: p.start, end: p.end, possible: true, why: null } : null;
	const passage = $derived(
		!loaded || !article
			? null
			: apiPassage === undefined
				? null
				: (apiPassage ?? fromText(findPassage(loaded.text ?? '', article.articleNumber)))
	);
	// The paragraph the passage starts in; when it starts on a heading (a section of the
	// API), the first paragraph under it.
	const passageEntryIndex = $derived.by(() => {
		if (!passage) return -1;
		const containing = entries.findLastIndex(
			(e) => e.type === 'para' && e.start <= passage.start && passage.start < e.end
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
		afterTick(() => landOn(container, 'passage'));
	});
	$effect(() => {
		if (!loaded || article || !anchor || !root) return;
		const container = root;
		if (isNootAnker(anchor)) noten.toon(anchor, { bereik: markering?.bereik });
		// A section by its id; an old anchor (`s-24`, before #831) at its place (paperSectionOf).
		const doelwit = tekstBereik
			? 'markering'
			: parseAnchor(anchor)?.kind === 'section'
				? (paperSectionOf(sections, anchor)?.id ?? anchor)
				: anchor;
		afterTick(() => landOn(container, doelwit));
	});
</script>

<ReaderFrame state={record.state} what="Document" retry={record.retry}>
	{#snippet children(doc)}
		{@const term = termOfKind(doc.kind)}
		<!-- Without the group of kinds the source files it under (#58): "Amendement". -->
		{@const kind = ownKind(doc.kind)}
		<!-- The paper as it is cited and kept, and each alinea after it (paper-cite). -->
		{@const paper = citePaper(doc, lichtProps)}
		{@const cite = paper.citation}
		{@const naam = paper.name}
		{@const paragraphCite = paperParagraphCite(paper)}
		{@const sectionCite = paperSectionCite(paper)}
		<!-- The kind of the case the stuk is in, where it adds to the stuk's own: a motie is in
			     a case of the kind Motie, which "Motie, 7 sep. 2026, Motie" said twice. -->
		{@const caseKinds = (doc.case_kinds ?? []).filter(
			(k) => !doc.kind?.toLowerCase().startsWith(k.toLowerCase())
		)}
		<div class="r-document">
			<ReaderHead
				collection="documents"
				title={doc.title ?? naamVan('documents', doc)}
				acties={{
					bewaar: paper.item,
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
				{#snippet kindLine()}
					<!-- Running text, the comma against the word before it. -->
					<span
						>{#if term}<GlossaryPill {term} label={kind ?? term} />{:else}{kind ??
								'Document'}{/if}{#if doc.date}, {korteDatum(doc.date)}{/if}{#if caseKinds.length},
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
				{#snippet statusLine()}
					{#if cite}<span>{cite}.</span>{/if}
					<Vervanging zinnen={vervanging(doc)} />
					{#if bijlagen > 0}<DocumentAttachments
							collection="documents"
							bronKey={doc.key}
							aantal={bijlagen}
						/>{/if}
				{/snippet}
			</ReaderHead>

			{#if toegelicht.length > 0}
				<Sectie title="Licht toe" collection="articles" aantal={doc.explains?.length ?? 0}>
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
				<div class="body" bind:this={root} use:kantlijn>
					{#each entries as entry, i (entry.type === 'heading' ? entry.section.id : `p${entry.start}`)}
						{#if entry.type === 'heading'}
							{@const s = entry.section}
							{@const forms = sectionCite(s, permalink(page.url, s.id))}
							<!-- A heading opens the passage under it (the toelichting on an article) as a
							     place: its menu (PlaatsMenu), as an alinea's; a heading for a screen reader. -->
							<div
								class="heading heading--lvl{Math.min(s.level, 3)}"
								class:heading--active={s.id === activeSectionId}
								class:in-passage={passageEntries.has(i)}
								class:in-passage--cont={passageEntries.has(i) && i > passageFirst}
								class:is-open={menu?.at === s.id}
								class:plaats-bewaard={kaart.heeft(forms.bewaar)}
								id={s.id}
							>
								<svelte:element this={`h${Math.min(s.level, 3) + 2}`} class="heading__text"
									><button
										type="button"
										class="heading__knop"
										aria-haspopup="menu"
										aria-expanded={menu?.at === s.id}
										onclick={(e) => openMenu(s.id, e.currentTarget)}
										>{s.heading}{#if s.kind === 'article' && s.article_refs?.length}
											<span class="heading__badge"
												>{s.article_refs.map((r) => r.number).join(', ')}</span
											>{/if}</button
									></svelte:element
								>
								{#if menu && menu.at === s.id}
									<PlaatsMenu
										anker={menu.marker}
										title={forms.kort}
										cite={citeItems(forms, forms.link)}
										tekst={() => (doc.text ?? '').slice(s.char_start, s.char_end).trim()}
										bewaar={forms.bewaar}
										onClose={() => (menu = null)}
									/>
								{/if}
							</div>
						{:else}
							{@const b = entry.block}
							{@const p = b.line}
							{@const markers = blockMarkers(b)}
							{@const sluit = voetnoten.naSectie.get(b.lines[b.lines.length - 1].i)}
							{@const bereik = markedIn(b)}
							{@const n = p.n}
							{@const at = p.at}
							{@const forms =
								n === null || at === null ? null : paragraphCite(n, at, permalink(page.url, at))}
							<!-- A paragraph with notes or marked words: its words set as a judgment's are. -->
							{#snippet woorden()}{#if markers || bereik}<CitedText
										text={p.text}
										noten={markers ?? []}
										{bereik}
									/>{:else}{p.text}{/if}{/snippet}
							<!-- An alinea is a place, as a lid or an overweging: its menu (PlaatsMenu) from the
							     marker in the margin (its number) or a click on its text; its anchor the lasting id
							     of its first line (`p-360a090c`), a table one alinea. The head of the stuk, a
							     heading and a motie's formula are no place, nor a line the API has not numbered. -->
							<div
								class="body-para"
								class:body-para--passage={passageEntries.has(i)}
								class:in-passage={passageEntries.has(i)}
								class:in-passage--cont={passageEntries.has(i) && i > passageFirst}
								class:body-para--plaats={!!forms}
								class:is-open={at !== null && menu?.at === at}
								class:plaats-bewaard={!!forms && kaart.heeft(forms.bewaar)}
								id={i === passageEntryIndex
									? 'passage'
									: bereik
										? 'markering'
										: (p.id ?? undefined)}
								title={i === passageEntryIndex ? (passage?.why ?? undefined) : undefined}
							>
								{#if forms && at && p.first}
									<button
										type="button"
										class="plaats-marker"
										aria-haspopup="menu"
										aria-expanded={menu?.at === at}
										aria-label="Alinea {n}: citeren, bewaren"
										onclick={(e) => openMenu(at, e.currentTarget)}>{n}</button
									>
								{/if}
								<div
									class="body-para__tekst"
									class:is-klikbaar={!!forms}
									use:blockClick={forms && at ? onText(at) : null}
								>
									{#snippet possibleLink()}{#if i === passageEntryIndex && passage?.possible}<span
												class="derived"
												title={passage.why ?? undefined}>mogelijk verband</span
											>{/if}{/snippet}
									{#if b.tables.length}
										<!-- A table and its title: one alinea, one block. -->
										<TextBlocks
											text={b.text}
											tables={b.tables}
											notes={markers ?? []}
											marked={bereik}
										/>
										{#if i === passageEntryIndex && passage?.possible}<p>
												{@render possibleLink()}
											</p>{/if}
									{:else}
										<p>{@render woorden()}{@render possibleLink()}</p>
									{/if}
									<Voetnoten noten={nootLijst(markers?.map((m) => m.id))} />
									<Voetnoten noten={nootLijst(sluit)} marge={false} />
								</div>
								{#if forms && p.first && menu && menu.at === at}
									<PlaatsMenu
										anker={menu.marker}
										title={forms.kort}
										cite={citeItems(forms, forms.link)}
										tekst={() => alineaText(at)}
										bewaar={forms.bewaar}
										onClose={() => (menu = null)}
									/>
								{/if}
							</div>
						{/if}
					{/each}
					<Voetnoten noten={nootLijst(voetnoten.los)} marge={false} kop="Voetnoten" />
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
		</div>
	{/snippet}
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
	/* An alinea stands 16px out into the margin, for its marker. */
	.body-para.in-passage::before {
		left: 2px;
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
	/* The heading is the menu of the passage under it: underlined with ▾ while it is pointed at,
	   open or focused, as a lid's number. */
	.heading__knop {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: inherit;
		text-align: inherit;
		cursor: pointer;
	}
	.heading:hover .heading__knop,
	.heading.is-open .heading__knop,
	.heading__knop:focus-visible {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.heading:hover .heading__knop::after,
	.heading.is-open .heading__knop::after,
	.heading__knop:focus-visible::after {
		content: ' ▾';
		font-size: 0.7em;
		color: var(--ink-3);
		text-decoration: none;
	}
	.heading__knop:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	.heading {
		position: relative;
	}
	.heading.is-open {
		background: var(--paper-2);
	}
	/* A kept passage: the ink bar at its heading, where an in-passage rule stands. */
	.heading.plaats-bewaard::before {
		left: -6px;
	}
	.r-document {
		display: flex;
		flex-direction: column;
		/* Its step between blocks, which the head subtracts from its own (ReaderHead). */
		--lezer-stap: var(--s-3);
		gap: var(--lezer-stap);
		color: var(--ink-2);
	}
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

	/* A line of the text: its notes under it, or in the margin beside it. An alinea stands 16px
	   out into the margin, its text at the column's edge, its number in the margin; on a phone
	   16px out on either side, to the edges of the screen. */
	.body-para {
		position: relative;
		margin: 0 0 0 calc(-1 * var(--s-4));
		padding-left: var(--s-4);
		border-radius: var(--r-1);
		scroll-margin: 20vh;
	}
	@media (max-width: 768px) {
		.body-para {
			margin: 0 calc(-1 * var(--s-4));
			padding: 0 var(--s-4);
			border-radius: 0;
		}
	}
	.body-para p {
		margin: 0;
	}
	.body-para--plaats:hover,
	.body-para--plaats:focus-within,
	.body-para.is-open {
		background: var(--paper-2);
	}
	.body-para:global(.is-landed) {
		background: var(--wassing);
	}
	/* A kept alinea: the ink bar at its own edge, in the margin it stands out into. */
	.body-para.plaats-bewaard::before {
		left: 0;
	}
	.body-para__tekst.is-klikbaar {
		cursor: pointer;
	}
	/* The marker is the alinea's menu: its number, nothing at rest; while the alinea is
	   pointed at, open or focused its number with ▾ under it (as a lid's number), in the
	   margin 4px before its text: one column as wide as the number, in the letter of a count,
	   so four figures fit in the 32px of the narrowest margin and the text never moves. */
	.plaats-marker {
		position: absolute;
		top: 0;
		right: calc(100% - var(--s-3));
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		font-size: var(--t-label);
		line-height: calc(var(--lh-body) * var(--t-body));
		color: transparent;
		white-space: nowrap;
		user-select: none;
		cursor: pointer;
	}
	.body-para:hover > .plaats-marker,
	.body-para.is-open > .plaats-marker,
	.plaats-marker:focus-visible {
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.body-para:hover > .plaats-marker::after,
	.body-para.is-open > .plaats-marker::after,
	.plaats-marker:focus-visible::after {
		content: '▾';
		font-size: var(--t-meta);
		line-height: 1;
		color: var(--ink-3);
		text-decoration: none;
	}
	.plaats-marker:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	/* On a phone there is no margin to hang it in: the number of an open alinea stands over
	   its first line, as a tab of its grey, in the space between the alineas. */
	@media (max-width: 768px) {
		.plaats-marker {
			top: auto;
			right: auto;
			bottom: 100%;
			left: var(--s-4);
			padding: 0 var(--s-1);
			border-radius: var(--r-1) var(--r-1) 0 0;
			font-size: var(--t-label);
			line-height: var(--s-3);
		}
		.body-para.is-open > .plaats-marker,
		.plaats-marker:focus-visible {
			background: var(--paper-2);
		}
		.plaats-marker::after {
			display: none;
		}
		/* Room for that tab under a heading too. */
		.heading + .body-para {
			margin-top: var(--s-3);
		}
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
