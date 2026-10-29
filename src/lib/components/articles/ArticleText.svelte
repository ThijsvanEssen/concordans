<script lang="ts">
	import Coverage from '$lib/components/ui/Coverage.svelte';
	import { bewaarItem } from '$lib/map/map';
	// The text of an article as its aanhef, leden and onderdelen. Every part has an
	// anchor, so a reference can point at it and the address can be shared. Nothing stands
	// beside the text: a place's own marker ("1.", "a.") is its menu (PlaatsMenu), and so is
	// a click on its text, the innermost place clicked (concept 21, variant B, Thijs 10 Oct).
	import PlaatsMenu, { placeMarker } from './PlaatsMenu.svelte';
	import { blockClick, gewoneKlik } from '$lib/actions/klik';
	import { kaart } from '$lib/map/map.svelte';
	import { citeItems } from '$lib/components/ui/cite-items';
	import { page } from '$app/state';
	import { landOn, permalink } from '$lib/bron/landing';
	import {
		markerAnchor,
		articleMarkers,
		articleNotes,
		listedNotes,
		withNotes,
		type FootnoteMark,
		type Note,
		type NoteMarker
	} from '$lib/text/voetnoten';
	import { setNoteJump } from '$lib/text/voetnoten.svelte';
	import type { Schema } from '$lib/api/types';
	import { markerOf, partsOf, placeOf, walkParts, type ArticlePart } from '$lib/text/article-parts';
	import { placeCitation, type ArticleCitation } from '$lib/text/cite';
	import { citationRecord } from '$lib/text/citation-record';
	import type { ProposedText } from '$lib/verbonden/proposed-text';
	import CitedText from './CitedText.svelte';
	import Aantekening from '$lib/map/Aantekening.svelte';
	import TextTable from './TextTable.svelte';
	import { blocksOf, type Table } from '$lib/text/tables';
	import { withHeadings, type Heading } from '$lib/text/headings';
	import { spansWithin } from '$lib/text/spans';
	import { definitiesOp, type Begrip, type Definitie } from '$lib/text/begrippen';
	import { delegatiesWithin, type Delegatie, type Gedelegeerd } from '$lib/text/delegaties';
	import {
		namesOwnDivision,
		referenceSpans,
		type Crumb,
		type Reference
	} from '$lib/text/references';
	import { lawDivisions } from '$lib/bron/law-articles';
	import { report } from '$lib/api/errors';
	import { anchorLabel } from '$lib/text/anchor';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import type { Fragment } from '$lib/map/map';
	import {
		WHOLE_ARTICLE,
		articlePlaces,
		fragmentOf,
		placeText,
		resolve,
		type Places
	} from '$lib/text/fragment';
	import { draw, shadingAt, shadingsOf, type Shading } from '$lib/text/shading';
	import type { AnchorState } from '$lib/text/coverage';
	import {
		PLACE,
		carry,
		clearSelection,
		rangeOf,
		selection,
		walkText,
		wordsUp,
		type TextSelection
	} from '$lib/actions/selection';
	import { readHere } from '$lib/reading/panel.svelte';

	// A reference to an article in the text opens the Leespaneel beside it (BronLink).
	readHere();

	let {
		text,
		parts: apiParts = null,
		tables: apiTables = [],
		headings = [],
		footnoteMarks = [],
		footnotes = [],
		footnoteReferences = [],
		citations = [],
		references = [],
		law = null,
		begrippen = [],
		definities = [],
		delegaties = [],
		grondslag = null,
		counts = new Map(),
		tellend = false,
		lidHref,
		citation = null,
		proposed = null,
		onCloseProposed,
		lidNotes = new Map(),
		mark = '.',
		bewaar = null,
		gemarkeerd = null,
		alleen = null,
		ankers = true,
		adres = null,
		earlier = null,
		compareKept = null
	}: {
		text: string | null | undefined;
		/** The parts the API delivers (0.5); without them they are read from the text. */
		parts?: Schema<'ArticlePartSpanDTO'>[] | null;
		/** The tables in the text (`tables`), laid out by TextTable. */
		tables?: Table[] | null;
		/** The headings in the text on a line of their own (`headings`: of a bijlage, a
		 *  tussenkop), set apart from the paragraphs. */
		headings?: Heading[] | null;
		/** Where the markers of its footnotes stood (`footnote_marks`): each a superscript
		 *  linked to its note, a line of the text that opens with its number or one of
		 *  `footnotes` (its `footnote`). */
		footnoteMarks?: FootnoteMark[] | null;
		/** The footnotes not in the text (`footnotes`, API 0.81): listed under it. */
		footnotes?: Schema<'FootnoteDTO'>[] | null;
		/** The references in them (`footnote_references`), each by its `footnote`. */
		footnoteReferences?: Reference[] | null;
		citations?: Schema<'ArticleCitationSpan'>[];
		/** Every reference the text makes (`references`): each mention a link where its
		 *  target is known, besides the one citation per target. */
		references?: Reference[];
		/** The law of the article (BWB id), for a reference to a division of it. */
		law?: string | null;
		/** The terms the text uses that its regulation defines (`term_spans`). */
		begrippen?: Begrip[];
		/** The definitions they name (`definitions`). */
		definities?: Definitie[];
		/** The delegation formulas of the text (`delegations`). */
		delegaties?: Delegatie[];
		/** The regulations issued under the article, asked when a formula is first pointed at. */
		grondslag?: (() => Promise<Gedelegeerd | null>) | null;
		/** Verbindingen per lid; a lid without an entry shows no count. */
		counts?: Map<string, number>;
		/** The counts are still on their way: a lid's menu says so. */
		tellend?: boolean;
		/** The address that filters the panel Verbonden to a lid. */
		lidHref?: (lid: string) => string;
		/** What is needed to cite the article; without it Citeer is not offered. */
		citation?: ArticleCitation | null;
		/** The wording a wetsvoorstel proposes for one lid, shown next to the current one. */
		proposed?: ProposedText | null;
		onCloseProposed?: () => void;
		/** Per lid, when it got its present wording, and the link to its history. */
		lidNotes?: Map<string, { label: string; href: string }>;
		/** The mark after an onderdeel's letter or number: `a.` in Dutch law, `a)` in EU law. */
		mark?: '.' | ')';
		/** The article as Bundels keeps it: its id, its law and the day its text on screen took
		 *  effect; each lid then has Bewaar. */
		bewaar?: { id: string; groep: string; wet: string | null; versie?: string | null } | null;
		/** A place marked as kept, whatever the active map (Bundels shows its own items). */
		gemarkeerd?: string | null;
		/** Only the lid or onderdeel at this anchor, and what it holds; all where none matches. */
		alleen?: string | null;
		/** Anchors on the places; off where an article stands more than once on a page. */
		ankers?: boolean;
		/** The article's own address, where the page is not its reader (a map): the link Citeer
		 *  copies points there. */
		adres?: string | null;
		/** The text of an earlier tekstversie by the day it took effect: an arcering kept in it
		 *  is followed into the text on screen (besluit 23). */
		earlier?:
			| ((day: string) => Promise<{
					text?: string | null;
					parts?: Schema<'ArticlePartSpanDTO'>[] | null;
					tables?: Table[] | null;
			  } | null>)
			| null;
		/** Where the text kept and the text on screen are compared, by the day of the one kept. */
		compareKept?: ((day: string) => string) | null;
	} = $props();

	const source = $derived(text ?? '');

	// The divisions of the law, asked only for a text that names one of its own.
	let divisions = $state.raw<Crumb[]>([]);
	$effect(() => {
		const bwb = law;
		divisions = [];
		if (!bwb || !namesOwnDivision([...references, ...(footnoteReferences ?? [])], bwb)) return;
		lawDivisions(bwb).then(
			(d) => {
				if (bwb === law) divisions = d;
			},
			(e) => report('Indeling van de wet', e)
		);
	});
	const links = $derived(
		referenceSpans(
			citations,
			references.filter((r) => r.footnote == null),
			{ ownLaw: law, crumbs: divisions }
		)
	);
	const perRef = $derived(definitiesOp(definities));
	const tables = $derived(apiTables ?? []);
	const parts = $derived(partsOf(source, apiParts, tables));
	/** The notes the markers refer to, by their number. */
	const notes = $derived(articleNotes(source, footnoteMarks, tables));
	/** The notes of their own (`footnotes`), listed under the text. */
	const listed = $derived(
		listedNotes(
			footnotes,
			footnoteMarks,
			[...notes.values()].map((n) => n.anchor)
		)
	);
	/** The links in a listed note: its references, as those of the text. */
	const noteLinks = (index: number) =>
		referenceSpans(
			[],
			(footnoteReferences ?? []).filter((r) => r.footnote === index),
			{ ownLaw: law, crumbs: divisions }
		);
	const hasNotes = $derived(notes.size > 0 || listed.length > 0);
	/** Each note by its anchor, as its marker's card shows it: its words and their links. */
	const cards = $derived.by(() => {
		const out = new Map<string, Note>();
		for (const n of notes.values()) {
			const raw = source.slice(n.body, n.end);
			const from = n.body + raw.length - raw.trimStart().length;
			out.set(n.anchor, {
				id: n.anchor,
				label: n.number,
				text: source.slice(from, n.end),
				citations: spansWithin(links, from, n.end - from)
			});
		}
		for (const n of listed)
			out.set(n.anchor, {
				id: n.anchor,
				label: n.number,
				text: n.text.trim(),
				citations: noteLinks(n.index)
			});
		return out;
	});
	/** The markers in `text[start, end]`, each with the note its card shows. */
	const markersIn = (start: number, end: number): NoteMarker[] =>
		articleMarkers(footnoteMarks, notes, start, end, ankers, listed).map((m) => ({
			...m,
			note: m.href ? (cards.get(decodeURIComponent(m.href.slice(1))) ?? null) : null
		}));
	const marker = (number: string) => markerOf(number, mark);
	/** Every part, for the place a citation names: a definition by its term. */
	const allParts = $derived([...walkParts(parts)]);
	/** The place `alleen` names: a lid with its onderdelen (`lid-2-onder-a` is in `lid-2`). */
	const holds = (part: ArticlePart, at: string) =>
		!!part.id && (at === part.id || at.startsWith(`${part.id}-`));
	const shown = $derived.by(() => {
		const at = alleen;
		const deel = at ? parts.filter((p) => holds(p, at)) : [];
		return deel.length ? deel : parts;
	});
	/** The listed notes of what is shown: all for the whole text, else those a marker in it
	 *  refers to. */
	const shownNotes = $derived.by(() => {
		if (shown === parts) return listed;
		const from = shown[0]?.start ?? 0;
		const to = shown.at(-1)?.end ?? 0;
		const inside = new Set(
			(footnoteMarks ?? []).filter((m) => m.at >= from && m.at <= to).map((m) => m.footnote)
		);
		return listed.filter((n) => inside.has(n.index));
	});
	const isKept = (part: ArticlePart) =>
		!!part.id &&
		(part.id === gemarkeerd ||
			(!!bewaar && kaart.heeft({ id: bewaar.id, at: part.id })) ||
			resolved.some((a) => 'start' in a.hit && a.hit.place === part.id));

	/** What the text `[start, end)` marks, offsets relative to `start`. */
	const marks = (start: number, end: number) => ({
		citations: spansWithin(links, start, end - start),
		begrippen: spansWithin(begrippen, start, end - start),
		delegaties: delegatiesWithin(delegaties, start, end - start)
	});

	/** A part's own text: its paragraphs (trimmed, none empty), its headings, its tables and
	 *  its footnotes. */
	const piecesBetween = (start: number, end: number) =>
		withNotes(
			source,
			blocksOf(source, start, end, tables).flatMap((piece) =>
				piece.table ? [{ ...piece, heading: false }] : withHeadings(source, piece, headings ?? [])
			),
			notes
		);
	type Pieces = ReturnType<typeof piecesBetween>;
	const own = (part: ArticlePart) => piecesBetween(part.textStart, part.textEnd);
	/** What a part says after its last child: the slotzin of a lid after its onderdelen (B10,
	 *  Drinkwaterbesluit art. 47 lid 1), which stands where the law prints it. */
	const tail = (part: ArticlePart) =>
		part.children.length > 0
			? piecesBetween(Math.max(...part.children.map((c) => c.end)), part.end)
			: [];

	/** A footnote marker (FootnoteLink) or a note's number goes to the other in place: the reader
	 *  lands there, as on an address with its anchor. */
	setNoteJump((id) => {
		if (box) landOn(box, id);
	});
	$effect(() => {
		const el = box;
		if (!el || !hasNotes) return;
		const jump = (e: MouseEvent) => {
			const link = (e.target as Element | null)?.closest<HTMLAnchorElement>('a.voetnoot__terug');
			const id = link?.hash.slice(1);
			if (!id || !link || !gewoneKlik(e) || !el.contains(link)) return;
			e.preventDefault();
			landOn(el, decodeURIComponent(id));
		};
		el.addEventListener('click', jump);
		return () => el.removeEventListener('click', jump);
	});

	/** The place's text with its onderdelen, as Kopieer tekst puts it on the clipboard; the
	 *  article's whole text when the place is the article. */
	const fullText = (part: ArticlePart | null) =>
		part ? source.slice(part.textStart, part.end).trim() : source.trim();

	/** A part is keyed by the place it is cited as: text without an anchor of its own is its
	 *  lid's, or the article's (an article without leden). */
	const keyOf = (part: ArticlePart) => placeOf(parts, part)?.id ?? 'artikel';

	/** The place whose menu is open (null: the article), and the marker it hangs from; words
	 *  selected in it (`words`, their fragment where they can be kept) or an arcering clicked,
	 *  with where the menu hangs then. */
	type Menu = {
		part: ArticlePart | null;
		anker: HTMLElement;
		words?: { exact: string; fragment: Fragment | null };
		shading?: Shading;
		rect?: () => DOMRect;
		below?: boolean;
	};
	let menu = $state<Menu | null>(null);
	const menuFor = $derived(
		menu && !menu.words && !menu.shading ? (menu.part?.id ?? 'artikel') : null
	);
	function openMenu(part: ArticlePart, anker: HTMLElement) {
		menu = menuFor === keyOf(part) ? null : { part: placeOf(parts, part), anker };
	}
	/** A click on a place's text opens its menu, at its marker (blockClick: the innermost); a
	 *  click on an arcering the arcering's. */
	const onText = (part: ArticlePart) => (e: MouseEvent) => {
		// A note under the place is no text of it: its own button opens its menu.
		if (e.target instanceof Element && e.target.closest('[data-geen-tekst]')) return;
		const at = shadingAt(e.clientX, e.clientY, drawn);
		if (at && 'start' in at.shading.hit) {
			const { range, shading } = at;
			const place = at.shading.hit.place;
			menu = {
				part: partAt(place),
				anker: ownMarker(place) ?? (e.currentTarget as HTMLElement),
				shading,
				rect: () => range.getBoundingClientRect()
			};
			return;
		}
		const anker = placeMarker(e, '.lid, .part');
		if (anker) openMenu(part, anker);
	};

	// ── Arceren (O4) ────────────────────────────────────────────────────────
	/** The text as places: what a fragment is anchored in and found again in. */
	const places = $derived(articlePlaces(source, parts));
	const partAt = (place: string) => allParts.find((p) => p.id === place) ?? null;
	let box = $state<HTMLElement | null>(null);
	/** The element of a place on the page: the text as a whole for the article. */
	const placeEl = (place: string): HTMLElement | null =>
		box?.getAttribute(PLACE) === place
			? box
			: ([...(box?.querySelectorAll<HTMLElement>(`[${PLACE}]`) ?? [])].find(
					(el) => el.getAttribute(PLACE) === place
				) ?? null);
	/** A place's own marker (`2.`, `a.`), where its menu returns the focus. */
	const ownMarker = (place: string) =>
		placeEl(place)?.querySelector<HTMLElement>(':scope > .plaats-marker') ?? null;

	/** Words selected: the menu of the smallest place that holds them, by the words. */
	function selected(s: TextSelection) {
		const p = s.place;
		const fragment = (() => {
			if (!p) return null;
			const own = placeText(places, p.id);
			const at = own === null ? null : carry(p.walk.text, own, p.start, p.end);
			return at ? fragmentOf(places, p.id, at[0], at[1]) : null;
		})();
		const part = p && p.id !== WHOLE_ARTICLE ? partAt(p.id) : null;
		const range = s.range.cloneRange();
		// On a phone the menu opens below the words, past the phone's own bar under them: the
		// words go up first where the menu would find too little room there.
		if (s.touch) wordsUp(range, box!);
		menu = {
			below: s.touch,
			part,
			anker: (p && ownMarker(p.id)) ?? p?.el ?? box!,
			words: { exact: fragment?.exact ?? s.text.trim(), fragment },
			rect: () => range.getBoundingClientRect()
		};
	}

	/** The arceringen of the bundels in this article. */
	const shadings = $derived(bewaar ? shadingsOf(kaart.listed, bewaar.id) : []);
	/** Earlier tekstversies asked, by their day: an arcering kept in one is followed from it. */
	let earlierTexts = $state<Record<string, Places | null>>({});
	const asked = new Set<string>();
	const since = $derived(bewaar?.versie ?? null);
	/** Each arcering where its words are now. */
	const resolved = $derived(
		shadings.map((a): Shading => {
			const day = a.item.versie;
			const old = day && since && day !== since ? earlierTexts[day] : null;
			return {
				...a,
				hit: resolve(places, a.annotation.fragment, old && since ? { places: old, since } : null)
			};
		})
	);
	$effect(() => {
		const load = earlier;
		const now = since;
		if (!load || !now) return;
		for (const a of resolved) {
			const day = a.item.versie;
			if (a.hit.state !== 'lost' || !day || day === now || asked.has(day)) continue;
			asked.add(day);
			load(day).then(
				(d) => {
					const t = d?.text ?? '';
					earlierTexts = {
						...earlierTexts,
						[day]: t ? articlePlaces(t, partsOf(t, d?.parts, d?.tables ?? [])) : null
					};
				},
				(e) => report('Eerdere tekstversie', e)
			);
		}
	});

	/** What is drawn, each range with its arcering: a click on one opens its menu. */
	let drawn: { range: Range; shading: Shading }[] = [];
	const owner = {};
	/** The arceringen drawn in the text as it stands; again when its text changes (a link
	 *  that comes, a definition marked). */
	function drawAll() {
		const out: typeof drawn = [];
		for (const shading of resolved) {
			const hit = shading.hit;
			if (!('start' in hit)) continue;
			const el = placeEl(hit.place);
			const own = placeText(places, hit.place);
			if (!el || own === null) continue;
			const walk = walkText(el);
			const at = carry(own, walk.text, hit.start, hit.end);
			const range = at && rangeOf(walk, at[0], at[1]);
			if (range) out.push({ range, shading });
		}
		drawn = out;
		draw(
			owner,
			out.map((d) => d.range)
		);
	}
	$effect(() => {
		const el = box;
		void shown;
		// Nothing to draw: no observer either.
		if (!el || !resolved.length) {
			drawn = [];
			draw(owner, []);
			return;
		}
		drawAll();
		let frame = 0;
		const changes = new MutationObserver(() => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(drawAll);
		});
		changes.observe(el, { childList: true, subtree: true, characterData: true });
		return () => {
			cancelAnimationFrame(frame);
			changes.disconnect();
			draw(owner, []);
		};
	});

	/** The notes of the arceringen whose words stand where they were kept, by their place: each
	 *  under it at rest (O4 step 6). A note of one that moved or lost its words stands under its
	 *  line (anchorLines). */
	const notesAt = $derived.by(() => {
		const out = new Map<string, Shading[]>();
		for (const a of resolved) {
			if (!a.annotation.tekst || a.hit.state !== 'found') continue;
			out.set(a.hit.place, [...(out.get(a.hit.place) ?? []), a]);
		}
		return out;
	});
	/** A note clicked opens the menu of its arcering, at the note; again closes it. */
	function openNote(a: Shading, anker: HTMLElement) {
		if (menu?.shading?.annotation.id === a.annotation.id && menu.anker === anker) {
			menu = null;
			return;
		}
		menu = { part: partAt(a.hit.place), anker, shading: a };
	}

	/** A place as a line names it: `lid 3`, `lid 2, onder a`; the article itself. */
	const placeName = (place: string) => anchorLabel(place) ?? 'het artikel';
	/** The arceringen whose words no longer stand where they were kept, by the top part their
	 *  line stands under (the whole article: at the end of the text). */
	const stale = $derived.by(() => {
		const out = new Map<string, { a: Shading; state: AnchorState; quote: boolean }[]>();
		for (const a of resolved) {
			const t = a.hit;
			if (t.state === 'found') continue;
			const state: AnchorState =
				t.state === 'moved'
					? { state: 'moved', place: placeName(t.place) }
					: t.state === 'changed' || t.state === 'lapsed'
						? { state: t.state, since: t.since }
						: { state: 'lost' };
			const top =
				shown.find((p) => p.id && (t.place === p.id || t.place.startsWith(`${p.id}-`)))?.id ??
				WHOLE_ARTICLE;
			const list = out.get(top) ?? [];
			list.push({ a, state, quote: !('start' in t) });
			out.set(top, list);
		}
		return out;
	});
	/** The place as the menu names it: its short citation, else `Lid 2`. */
	const placeTitle = (part: ArticlePart | null) =>
		formsOf(part)?.short ??
		(part?.kind === 'lid'
			? `Lid ${part.number}`
			: part?.term
				? `Definitie van '${part.term}'`
				: part?.number
					? `Onder ${part.number}`
					: 'Artikel');

	/** The citation of a place; null is the article itself. A definition without a letter
	 *  (a dash item, a definition paragraph) is named by its term, and so is what it holds. */
	const formsOf = (part: ArticlePart | null) =>
		citation
			? citationRecord({
					...citation,
					...placeCitation(part?.id ?? null, allParts),
					kind: 'article'
				})
			: null;
</script>

{#snippet cited(start: number, end: number)}
	{@const m = marks(start, end)}
	<CitedText
		text={source.slice(start, end)}
		citations={m.citations}
		begrippen={m.begrippen}
		definities={perRef}
		delegaties={m.delegaties}
		{grondslag}
		noten={hasNotes ? markersIn(start, end) : []}
	/>
{/snippet}

{#snippet note(a: Shading)}
	<div class="noot" data-geen-tekst>
		<Aantekening
			tekst={a.annotation.tekst}
			bij={`"${a.annotation.fragment.exact}"`}
			bundel={a.map.naam}
			onOpen={(button) => openNote(a, button)}
		/>
	</div>
{/snippet}

{#snippet annotationsOf(place: string)}
	{#each notesAt.get(place) ?? [] as a (a.annotation.id)}{@render note(a)}{/each}
{/snippet}

{#snippet anchorLines(place: string)}
	{#each stale.get(place) ?? [] as r (r.a.annotation.id)}
		{@const href =
			r.state.state === 'changed' && r.a.item.versie && compareKept
				? compareKept(r.a.item.versie)
				: null}
		<p class="anchor-line" data-geen-tekst>
			{#if r.quote}<q class:struck={r.state.state === 'lapsed'}>{r.a.annotation.fragment.exact}</q
				>{/if}
			{#if href}<a {href} data-sveltekit-noscroll><Coverage anchor={r.state} /></a>{:else}<Coverage
					anchor={r.state}
				/>{/if}
		</p>
		{#if r.a.annotation.tekst}{@render note(r.a)}{/if}
	{/each}
{/snippet}

{#snippet tekst(pieces: Pieces)}
	{#each pieces as piece (piece.start)}
		{#if piece.table}
			<TextTable text={source} table={piece.table} cell={cited} />
		{:else if piece.heading}
			<p class="tussenkop">{@render cited(piece.start, piece.end)}</p>
		{:else if piece.note}
			{@const n = piece.note.number}
			<p class="voetnoot" id={ankers ? piece.note.anchor : undefined}>
				{#if ankers}<a
						class="voetnoot__terug"
						href="#{markerAnchor(n)}"
						aria-label="Terug naar de tekst bij voetnoot {n}">{n}</a
					>{:else}{n}{/if}{@render cited(piece.note.body, piece.end)}
			</p>
		{:else}
			<p>{@render cited(piece.start, piece.end)}</p>
		{/if}
	{/each}
{/snippet}

{#snippet render(part: ArticlePart, top: boolean)}
	{@const showProposed = proposed && part.kind === 'lid' && proposed.lid === part.number}
	{#if top}
		<div
			class="lid lid--{part.kind}"
			id={ankers ? part.id : undefined}
			data-plaats={part.id ?? undefined}
			class:is-open={menuFor === keyOf(part)}
			class:plaats-bewaard={isKept(part)}
		>
			<!-- The number is the lid's menu: citeren, bewaren, verbindingen. -->
			<button
				type="button"
				class="lid__no plaats-marker"
				aria-haspopup="menu"
				aria-expanded={menuFor === keyOf(part)}
				aria-label="{placeTitle(placeOf(parts, part))}: citeren, bewaren"
				onclick={(e) => openMenu(part, e.currentTarget)}
				>{part.kind === 'lid' ? `${part.number}.` : part.number ? marker(part.number) : ''}</button
			>
			<div class="lid__body" class:lid__body--pair={showProposed}>
				<div class="lid__text" use:blockClick={onText(part)}>
					{@render tekst(own(part))}
					{#each part.children as child (child.start)}
						{@render render(child, false)}
					{/each}
					{@render tekst(tail(part))}
				</div>
				{#if part.id}{@render annotationsOf(part.id)}{@render anchorLines(part.id)}{/if}
				{#if showProposed && proposed}
					<div class="lid__proposed" data-geen-tekst>
						<div class="lid__proposed-head">
							<span class="proposed">voorgesteld</span>
							<span class="lid__proposed-source">{proposed.source}</span>
							{#if onCloseProposed}
								<IconButton label="Sluiten" onclick={onCloseProposed}>×</IconButton>
							{/if}
						</div>
						<p>{proposed.text}</p>
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<div
			class="part part--{part.kind}"
			id={ankers ? part.id : undefined}
			data-plaats={part.id ?? undefined}
			class:is-open={!!part.id && menuFor === part.id}
			class:plaats-bewaard={isKept(part)}
		>
			{#if part.number && part.id}
				<button
					type="button"
					class="part__number plaats-marker"
					aria-haspopup="menu"
					aria-expanded={menuFor === part.id}
					aria-label="{placeTitle(part)}: citeren, bewaren"
					onclick={(e) => openMenu(part, e.currentTarget)}>{marker(part.number)}</button
				>
			{/if}
			<div class="part__body" use:blockClick={onText(part)}>
				{@render tekst(own(part))}
				{#each part.children as child (child.start)}
					{@render render(child, false)}
				{/each}
				{@render tekst(tail(part))}
				{#if part.id}{@render annotationsOf(part.id)}{/if}
			</div>
		</div>
	{/if}
{/snippet}

{#if parts.length === 0}
	<p class="article-text__empty"><Coverage noText /></p>
{:else}
	<!-- The text measures its own width: in a narrow column (beside the network) the margin
	     folds under each lid, as it does on a phone. -->
	<div class="article-text-box">
		<div
			class="article-text"
			bind:this={box}
			data-plaats={shown === parts ? WHOLE_ARTICLE : undefined}
			use:selection={{ open: selected, close: () => (menu = null) }}
		>
			{#each shown as part (part.start)}
				{@render render(part, true)}
			{/each}
			{#if proposed && !parts.some((p) => p.kind === 'lid' && p.number === proposed!.lid)}
				<div class="lid lid--proposed-only" data-geen-tekst>
					<span class="lid__no"></span>
					<div class="lid__body">
						<div class="lid__proposed">
							<div class="lid__proposed-head">
								<span class="proposed">voorgesteld</span>
								<span class="lid__proposed-source"
									>{proposed.source}{proposed.lid ? `, lid ${proposed.lid}` : ''}</span
								>
								{#if onCloseProposed}
									<IconButton label="Sluiten" onclick={onCloseProposed}>×</IconButton>
								{/if}
							</div>
							<p>{proposed.text}</p>
						</div>
					</div>
				</div>
			{/if}
			{@render annotationsOf(WHOLE_ARTICLE)}
			{@render anchorLines(WHOLE_ARTICLE)}
			{#if shownNotes.length}
				<!-- The notes of their own, under the text, the number back to its marker. -->
				<div class="voetnoten" data-geen-tekst>
					{#each shownNotes as n (n.anchor)}
						<p class="voetnoot voetnoot--eigen" id={ankers ? n.anchor : undefined}>
							{#if n.number}{#if ankers && n.back}<a
										class="voetnoot__terug"
										href="#{n.back}"
										aria-label="Terug naar de tekst bij voetnoot {n.number}">{n.number}</a
									>{:else}<span class="voetnoot__nummer">{n.number}</span>{/if}{/if}<CitedText
								text={n.text}
								citations={noteLinks(n.index)}
							/>
						</p>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}

{#if menu}
	{@const m = menu}
	{@const p = m.part}
	{@const forms = formsOf(p)}
	{@const plain = !m.words && !m.shading}
	{@const lid = plain && p?.kind === 'lid' ? p.number : null}
	{@const count = lid ? counts.get(lid) : undefined}
	{@const across = !!m.words && !m.words.fragment}
	{@const place =
		bewaar && forms
			? bewaarItem(
					bewaar.id,
					{ at: p?.id, kort: forms.short, voluit: forms.full },
					{ groep: bewaar.groep, wet: bewaar.wet, versie: bewaar.versie }
				)
			: null}
	{@const fragment = m.words?.fragment ?? null}
	{@const a = m.shading ?? null}
	<PlaatsMenu
		anker={m.anker}
		title={placeTitle(p)}
		cite={forms && !across
			? citeItems(forms, permalink(adres ? new URL(adres, page.url) : page.url, p?.id ?? ''))
			: []}
		tekst={() => m.words?.exact ?? a?.annotation.fragment.exact ?? fullText(p)}
		bewaar={across ? null : a ? a.item : place}
		fragment={m.words
			? {
					exact: m.words.exact,
					shade:
						place && fragment
							? (note) => {
									kaart.shade(place, fragment, note);
									clearSelection();
								}
							: null
				}
			: null}
		shading={a
			? {
					exact: a.annotation.fragment.exact,
					note: a.annotation.tekst ?? null,
					annotate: (note) => kaart.annotate(a.annotation.id, note, a.map.id),
					remove: () => kaart.unshade(a.annotation.id, a.map.id)
				}
			: null}
		rect={m.rect ?? null}
		below={m.below ?? false}
		verbindingen={lid && count != null && lidHref
			? { n: count, href: lidHref(lid) }
			: lid && tellend
				? 'tellend'
				: null}
		geschiedenis={lid ? (lidNotes.get(lid) ?? null) : null}
		onClose={() => (menu = null)}
	/>
{/if}

<style>
	.article-text-box {
		container-type: inline-size;
	}
	.article-text {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink);
		/* The number of a lid hangs in the frame's margin, its text at the column's edge
		   (ReaderFrame); a narrow column takes it in (below). */
		/* No further than the frame's margin: beside the network it is 32, not 64 (the
		   numbers were cut off there), as the judgment's numbers do (--rov-hang). */
		margin-left: calc(-1 * min(var(--s-7), var(--reader-pad-left, var(--s-6))));
		/* The column of a lid's number. */
		--lid-no: 36px;
	}

	/* A lid: 36px for the number (in the frame's margin), the text to the column's right
	   edge, its count and actions under it (Thijs, 9 Oct: "de artikelen oprekken" to the
	   width of the reader). */
	/* Nothing beside the text: the number is the lid's menu (variant B, Thijs 10 Oct). */
	.lid {
		position: relative;
		display: grid;
		grid-template-columns: var(--lid-no) minmax(0, 1fr);
		gap: 0 var(--s-3);
		align-items: start;
		padding: var(--s-1) var(--s-3) var(--s-1) 0;
		border-radius: var(--r-1);
		scroll-margin: 20vh;
		transition: background var(--dur-2) var(--ease);
	}
	.lid:has(> .lid__no:focus-visible),
	.lid.is-open {
		background: var(--paper-2);
	}
	.lid:global(.is-landed) {
		background: var(--wassing);
	}
	/* The number as the law prints it (1.), in the letter and on the line of the text. */
	.lid__no {
		padding: 0;
		border: 0;
		background: none;
		cursor: default;
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink-3);
		text-align: right;
		/* A number wider than the column grows to the left, into the margin. */
		justify-self: end;
	}
	.lid__body {
		min-width: 0;
	}
	.lid__body--pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--s-4);
	}
	.lid__body p {
		margin: 0;
	}
	.lid__proposed {
		padding-left: var(--s-3);
		border-left: 2px solid var(--wassing);
	}
	.lid__proposed-head {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		margin-bottom: var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.proposed {
		color: var(--ink);
		/* In ink, as everything at rest but "nee" (Thijs, 10 Oct); the weight keeps it seen. */
		font-weight: 600;
	}
	.lid__proposed-source {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* Onderdelen inside a lid keep their number in the text. */
	.part {
		position: relative;
		display: flex;
		align-items: baseline;
		gap: 0.6em;
		margin: 0.4em 0 0;
		scroll-margin: 20vh;
		border-radius: var(--r-1);
	}
	.part:global(.is-landed) {
		background: var(--wassing);
	}
	/* The onderdeel whose menu is open (and the one the pointer is on, below): a tinted block
	   with a bar at the left, a few pixels beyond the text on every side. */
	.part.is-open {
		background: var(--paper-2);
		box-shadow:
			0 0 0 4px var(--paper-2),
			-3px 0 0 3px var(--ink);
	}
	/* A place's marker is its menu: a quiet button, underlined with ▾ while the place is
	   pointed at or focused, so it is clear what the menu acts on. */
	.plaats-marker {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		text-align: inherit;
		cursor: pointer;
	}
	.lid.is-open > .lid__no,
	.part.is-open > .part__number,
	.plaats-marker:focus-visible {
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.lid.is-open > .lid__no::after,
	.part.is-open > .part__number::after,
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
	/* The text of a place opens its menu too. */
	.lid__text,
	.part__body {
		cursor: pointer;
	}
	.part__number {
		flex: none;
		color: var(--ink-3);
	}
	/* The lid or onderdeel the pointer is on, and not one inside it, as the one whose menu is
	   open; only for a pointer that hovers: on a phone a tap leaves its hover on what comes
	   under the finger after it (a jump to a note), which would mark the next onderdeel. */
	@media (hover: hover) {
		.lid:hover:not(:has(.part--onderdeel:hover)) {
			background: var(--paper-2);
		}
		.part--onderdeel:hover:not(:has(.part--onderdeel:hover)) {
			background: var(--paper-2);
			box-shadow:
				0 0 0 4px var(--paper-2),
				-3px 0 0 3px var(--ink);
		}
		.lid:hover:not(:has(.part--onderdeel:hover)) > .lid__no,
		.part--onderdeel:hover:not(:has(.part--onderdeel:hover)) > .part__number,
		.part__number:hover {
			color: var(--ink);
			text-decoration: underline;
			text-underline-offset: 3px;
		}
		.lid:hover:not(:has(.part--onderdeel:hover)) > .lid__no::after,
		.part--onderdeel:hover:not(:has(.part--onderdeel:hover)) > .part__number::after {
			content: ' ▾';
			font-size: 0.7em;
			color: var(--ink-3);
			text-decoration: none;
		}
		.voetnoot__terug:hover {
			color: var(--ink);
		}
	}
	.part__body {
		flex: 1;
		min-width: 0;
	}
	.part__body p {
		margin: 0;
	}
	/* A heading in the text (a tussenkop, the heading of a part of a bijlage): the head of
	   what follows, as a division heads its articles. */
	.lid__body p.tussenkop,
	.part__body p.tussenkop {
		margin-top: var(--s-3);
		font-weight: 600;
		color: var(--ink);
	}

	/* A footnote: a line of the text that opens with its number, in the letter of a note; the
	   number goes back to its marker. */
	.lid__body p.voetnoot,
	.part__body p.voetnoot,
	.voetnoten p.voetnoot {
		margin-top: var(--s-2);
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
		color: var(--ink-2);
		border-radius: var(--r-1);
		scroll-margin: 20vh;
	}
	.voetnoot:global(.is-landed) {
		background: var(--wassing);
	}
	/* The notes of their own, under the text: in its column, past the numbers of the leden. */
	.voetnoten {
		margin-top: var(--s-3);
		padding-left: calc(var(--lid-no) + var(--s-3));
	}
	.voetnoten p.voetnoot {
		margin-bottom: 0;
		white-space: pre-line;
	}
	.voetnoot__terug,
	.voetnoot__nummer {
		margin-right: var(--s-1);
		color: inherit;
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 2px;
	}
	/* The note of an arcering under its place, its words' own (Aantekening). */
	.noot {
		margin-bottom: var(--s-1);
	}
	/* An arcering whose words no longer stand where they were kept (besluit 23): its line under
	   the place, the words kept as a quote where none stands now. */
	.anchor-line {
		margin: var(--s-1) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.anchor-line q {
		margin-right: var(--s-2);
		font-style: normal;
		color: var(--ink-2);
	}
	.anchor-line q.struck {
		text-decoration: line-through;
	}
	.anchor-line a {
		color: inherit;
		text-decoration-color: var(--rule-strong);
	}
	.article-text__empty {
		font-style: italic;
		color: var(--ink-3);
		font-family: var(--font-serif);
		font-size: var(--t-body);
	}

	/* Narrow: the numbers inside the text column. From 580 they hang in the reader's margin:
	   the article column is 590 at 1440 since the contents take the network's width (one
	   title column, 10 Oct), and its numbers hang there as at 1920. */
	@container (max-width: 579px) {
		/* A narrower column for a lid's number (the lid's grid: minmax(0, …), the text wraps,
		   not widens the column past the screen). */
		.article-text {
			margin-left: 0;
			--lid-no: 28px;
		}
		/* A table of a lid takes the column's whole width: from under the number to the
		   lid's right edge (a bijlage's table of three columns was pressed into 290 px). */
		.lid__text > :global(.text-table) {
			max-width: none;
			margin-right: calc(-1 * var(--s-3));
			margin-left: calc(-1 * (var(--lid-no) + var(--s-3)));
		}
		.lid__body--pair {
			grid-template-columns: 1fr;
		}
	}
</style>
