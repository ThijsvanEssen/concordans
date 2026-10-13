<script lang="ts">
	import { meldNetwerk } from '$lib/stores/netwerk-melding';
	import { goto } from '$app/navigation';
	import { rijen } from '$lib/actions/rijen';
	import { hoeVan, kleineLetter } from './hoe';
	import { itemVanRij } from '$lib/map/rij';
	// The panel Verbonden: the verbindingen of the selected bron, in the groups of the
	// table in groups.ts, under the bronfilter. In the network each group can put its
	// bronnen on the canvas or take them off.
	import { onControl } from '$lib/actions/outside';
	import Caret from '$lib/components/ui/Caret.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import AlleN from '$lib/components/ui/AlleN.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import BronLink from '$lib/bron/BronLink.svelte';
	import RijInhoud from '$lib/components/open/RijInhoud.svelte';
	import { terPlekke } from '$lib/actions/klik';
	import RijActies from '$lib/components/ui/RijActies.svelte';
	import { isOpen, zetOpen } from '$lib/components/ui/dicht.svelte';
	import { page } from '$app/state';
	import { tick } from 'svelte';
	import { bronHref, openHref, refId } from '$lib/bron/href';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import type { GraphStore } from '$lib/graph/graph-store';
	import type { CanvasRow } from '$lib/graph/store/types';
	import type { GraphNode } from '$lib/graph/types';
	import {
		RECHTERS,
		type Rechter,
		kindCount,
		BRON_KIND_NOUN,
		formatCount,
		withKind,
		type VerbondenFilter
	} from './filter';
	import { countLabel, groupCount, type Group } from './groups';
	import { csvName, download, rowsToCsv } from './export';
	import {
		caseNumberOf,
		dossierVanRij,
		mentionRows,
		metaParts,
		repeatedTitles,
		rowKey,
		type Row
	} from './rows';
	import DossierNaam from '$lib/bron/DossierNaam.svelte';
	import { dossierNaamNu } from '$lib/bron/dossier-namen.svelte';
	import type { VerbondenState } from './source';
	import { groupRequest } from './open-group';
	import {
		uitspraakVolgorde,
		wetUitspraakJaar,
		wetUitspraakVolgorde,
		type UitspraakVolgorde,
		type WetVolgorde
	} from './volgorde';
	import Keuze from '$lib/components/ui/Keuze.svelte';
	import { isInhoudGroep, isKernGroep, lazeKernIds } from '$lib/bron/behoort';
	import { get } from 'svelte/store';
	import {
		GROUPINGS,
		allRows,
		countLine,
		filterGroups,
		hiddenLine,
		regroup,
		shownLabel,
		vasteGroepen,
		yearHistogram,
		type Grouping
	} from './view';

	let {
		verbonden,
		selection,
		filter,
		store,
		network = false,
		onFilter,
		onOpenFilter,
		onNaarNetwerk,
		onAddToNetwerk,
		inNetwerk,
		onProposedText,
		tableHref,
		onRetry,
		onMeer,
		onAlles
	}: {
		verbonden: VerbondenState;
		selection: GraphNode;
		filter: VerbondenFilter;
		store: GraphStore;
		/** The canvas is on screen: groups carry their layer control. */
		network?: boolean;
		onFilter: (f: VerbondenFilter) => void;
		onOpenFilter: () => void;
		/** A group was drawn in the network (on a phone: to the Netwerk tab). */
		onNaarNetwerk?: () => void;
		/** Één bron uit de rij in het netwerk zetten. */
		onAddToNetwerk?: (row: Row) => void;
		/** Of de bron van een rij al in het netwerk staat. */
		inNetwerk?: (row: Row) => boolean;
		/** A wetsvoorstel row: show the proposed wording next to the current text. */
		onProposedText?: (row: Row) => void;
		tableHref: string;
		/** Loads the verbindingen again after a failed load; without it no Opnieuw is offered. */
		onRetry?: () => void;
		/** A group is opened: its rows beyond the first few are asked now. */
		onMeer?: (groupId: string) => void | Promise<void>;
		/** Every row, before a copy or an export. */
		onAlles?: () => Promise<void>;
	} = $props();

	const PREVIEW = 3;
	/**
	 * The height a waiting row keeps, as its rows measure (UX-toets e7a2f95, #1 and #36): a
	 * judgment citing an article or a law holds its passage (142 px), one beside a judgment
	 * none (95), an article cited by a judgment a title and a line (77); the rest a title over
	 * two lines and its meta (112).
	 */
	/** "Toelichtingen en wijzigingen", the first word with a capital. */
	const zin = (woorden: string[]) => {
		const z =
			woorden.length > 1 ? `${woorden.slice(0, -1).join(', ')} en ${woorden.at(-1)}` : woorden[0];
		return `${z.charAt(0).toUpperCase()}${z.slice(1)}`;
	};
	// The kind of a waiting row, for its height: what a row of that group holds on this page.
	const wachtSoort = (noun?: string) => {
		const wet = selection.collection === 'articles' || selection.collection === 'instruments';
		if (noun === 'uitspraken') return wet ? 'passage' : 'uitspraak';
		if (noun === 'artikelen')
			return selection.collection === 'judgments' ? 'artikel' : wet ? 'verwijzing' : 'stuk';
		if (wet && (noun === 'stukken' || noun === 'Kamerstukken')) return 'kamerstuk';
		return 'stuk';
	};

	let grouping = $state<Grouping>('soort');
	let expanded = $state(new Set<string>());

	let onCanvas = $state(new Set<string>());
	$effect(() => store.nodes.subscribe((ns) => (onCanvas = new Set(ns.map((n) => n.id)))));

	// "Bekijk in Verbonden" on a cluster bron: the group with most bronnen of its kind,
	// opened and in view.
	let root = $state<HTMLElement | null>(null);
	$effect(() =>
		groupRequest.subscribe((r) => {
			if (!r) return;
			const count = (g: (typeof shown)[number]) =>
				g.rows.filter((row) => row.ref.collection === r.collection).length;
			const best = [...shown].sort((a, b) => count(b) - count(a))[0];
			groupRequest.set(null);
			if (!best || count(best) === 0) return;
			expanded = new Set([...expanded, best.id]);
			// A group closed in this browser opens for it.
			zetOpen(`verbonden:${best.id}`, true);
			// Once its rows are drawn: a smooth scroll is cut off while they render.
			void tick().then(() =>
				root
					?.querySelector(`[data-group="${CSS.escape(best.id)}"]`)
					?.scrollIntoView({ block: 'start' })
			);
		})
	);

	// The year of the bronfilter, for a wet asked of the API itself (BE-51): its judgments
	// of that year are loaded, not filtered out of the first page.
	$effect(() => {
		const jaar = selection.collection === 'instruments' ? filter.jaar : null;
		if (jaar === get(wetUitspraakJaar)) return;
		wetUitspraakJaar.set(jaar);
		onRetry?.();
	});

	// A new bron starts closed; the same bron with more rows (a group opened) stays as it is.
	const bronId = $derived(verbonden.id);
	$effect(() => {
		void bronId;
		expanded = new Set();
	});

	// The kern of the bron (Procesgang, Ingediend bij, Wet, Fractie) stands above its text in
	// the band; Verbonden is the context and leaves those groups out (Thijs, 9 Oct: "dubbelop";
	// docs/hierarchie.md, Kern of context). The table keeps all, and the count is the table's:
	// one number for the head, the link and the table (UX-toets 10 Oct, #15: "0 verbindingen"
	// over "Alle 79 in een tabel" on a fractie).
	// A bron in the kern is not listed again by another relation either: the Rechtbank of a
	// procesgang is no "uitspraak die hier wordt aangehaald" (Thijs, 9 Oct). The instances
	// before the eerdere aanleg come with the band's own cached light nodes.
	let keten = $state<Set<string>>(new Set());
	$effect(() => {
		const { collection, key, id } = selection;
		keten = new Set();
		lazeKernIds(collection, key, (selection.raw?.props ?? {}) as Record<string, unknown>).then(
			(ids) => {
				if (selection.id === id) keten = new Set(ids);
			}
		);
	});
	/** The judgment a translation renders (`translation_of`, an ECLI), as an id. */
	const vertalingVan = (r: Row) => {
		const ecli = r.props?.translation_of;
		return typeof ecli === 'string' && ecli.trim()
			? `judgments/${ecli.trim().toLowerCase().replaceAll(':', '_')}`
			: null;
	};
	const kernIds = $derived(
		new Set([
			...verbonden.groups
				.filter((g) => isKernGroep(selection.collection, g))
				.flatMap((g) => g.rows.map((r) => refId(r.ref))),
			...keten
		])
	);
	const groepen = $derived(
		verbonden.groups
			.filter(
				(g) =>
					!isKernGroep(selection.collection, g) &&
					!isInhoudGroep(
						selection.collection,
						g,
						(selection.raw?.props ?? {}) as Record<string, unknown>
					)
			)
			.map((g) => {
				const rows = g.rows.filter(
					(r) => !kernIds.has(refId(r.ref)) && !kernIds.has(vertalingVan(r) ?? '')
				);
				const weg = g.rows.length - rows.length;
				return weg ? { ...g, rows, total: g.total != null ? g.total - weg : g.total } : g;
			})
	);
	const alleenKern = $derived(
		groepen.every((g) => g.rows.length === 0) &&
			verbonden.groups.some(
				(g) =>
					g.rows.length > 0 &&
					(isKernGroep(selection.collection, g) ||
						isInhoudGroep(
							selection.collection,
							g,
							(selection.raw?.props ?? {}) as Record<string, unknown>
						))
			)
	);
	// A group whose loader is under way keeps its place with "laden…" (VerbondenState.wachtend).
	const filtered = $derived(filterGroups(groepen, filter, new Set(verbonden.wachtend ?? [])));
	// A group whose loader the light node cannot foretell (no counted buckets: Toelichting,
	// Wijzigingen) stands below the counted ones, always, so it never comes in above what stands
	// (UX-toets 0.79.43, #1). One order per page; a group under a heading of its own keeps it.
	const onvoorspelbaar = (g: Group) => !!g.load && !g.bakken && !g.section;
	const voorzien = (g: Group) => !g.laden || verbonden.verwacht?.[g.id] != null;
	const shown = $derived.by(() => {
		const r = regroup(filtered, grouping, selection.collection).filter(voorzien);
		return [...r.filter((g) => !onvoorspelbaar(g)), ...r.filter(onvoorspelbaar)];
	});
	// A group still loading whose rows the node cannot foretell takes no place: it may come
	// empty, and its place going would move what stands below it (UX-toets 0.79.47, #1: the
	// skeleton of Wijzigingen 92 px up when Toelichting came empty). One line under the
	// groups says what is still coming; a group that comes with rows takes its place above it.
	const nogOnderweg = $derived(
		regroup(filtered, grouping, selection.collection)
			.filter((g) => !voorzien(g))
			.map((g) => g.noun ?? g.label.toLowerCase())
	);
	const hidden = $derived(hiddenLine(groepen, filter));
	// What the table lists: the bronfilter applied, as its own count line does.
	// One count, written once it holds (#56): a group still loading counts what the node
	// foretells for it; while one cannot be foretold, the head waits.
	const vast = $derived(
		vasteGroepen(verbonden.groups, verbonden.wachtend ?? [], verbonden.verwacht ?? {})
	);
	const wachtSet = $derived(new Set(verbonden.wachtend ?? []));
	const total = $derived(shownLabel(vast ?? verbonden.groups, filter, wachtSet));

	const rowId = rowKey;

	function toggle(set: Set<string>, id: string) {
		const next = new Set(set);
		if (!next.delete(id)) next.add(id);
		return next;
	}

	const drawable = (rows: Row[]) => rows.filter((r) => r.relation && r.direction);
	/** Whether a group holds all its rows, not the first five of Verbonden's first request. */
	const heel = (g: Group) => g.rows.length >= (g.total ?? 0) || opgehaald.has(g.id);
	/** The groups whose own buckets were asked for a drawing: as whole as the API gives. */
	let opgehaald = $state(new Set<string>());
	$effect(() => {
		void selection.id;
		opgehaald = new Set();
	});
	// On, off and undo act on the whole group, not on the rows loaded (kabinet-Jetten, 10 Oct:
	// 5 of 28 bewindspersonen).
	const isLayerOn = (g: Group) => {
		const rows = drawable(g.rows);
		return heel(g) && rows.length > 0 && rows.every((r) => onCanvas.has(refId(r.ref)));
	};
	/** The group with all its rows, asked first where it holds only the first few. */
	async function heleGroep(g: Group): Promise<Group> {
		if (heel(g) || !onMeer) return g;
		const voor = selection.id;
		await onMeer(g.id);
		await tick();
		if (voor !== selection.id) return g;
		opgehaald = new Set(opgehaald).add(g.id);
		return groepen.find((x) => x.id === g.id) ?? g;
	}

	/**
	 * What the last "toon in netwerk" did, under its group: how many were drawn or taken off,
	 * with a way back (UX 8 Oct: the box changed nothing one could see). Gone after a while.
	 */
	let melding = $state<{ groep: string; tekst: string; terug: (() => void) | null } | null>(null);
	let meldingTimer: ReturnType<typeof setTimeout> | undefined;
	const MELDING_MS = 8000;

	/** `31 bronnen`, `1 bron`: the kind of a row is not always the noun of its group. */
	const telling = (rows: Row[]) => (rows.length === 1 ? '1 bron' : `${rows.length} bronnen`);

	// Another bron: its groups have their own notes, none yet.
	$effect(() => {
		void selection.id;
		melding = null;
	});

	function meld(groep: string, tekst: string, terug: (() => void) | null) {
		clearTimeout(meldingTimer);
		melding = { groep, tekst, terug };
		meldingTimer = setTimeout(() => (melding = null), MELDING_MS);
		// On a phone the network says it too: the Netwerk tab is where the reader goes.
		meldNetwerk(tekst, terug, MELDING_MS);
	}

	async function toggleLayer(eerst: Group) {
		const aan = isLayerOn(eerst);
		const voor = selection.id;
		const g = aan ? eerst : await heleGroep(eerst);
		if (voor !== selection.id) return;
		const rows = drawable(g.rows);
		if (aan) {
			const ids = rows.map((r) => refId(r.ref));
			store.hideRows(ids);
			meld(g.id, `${telling(rows)} uit het netwerk gehaald.`, () =>
				store.showRows(selection.id, rows as CanvasRow[])
			);
			return;
		}
		const nieuw = rows.filter((r) => !onCanvas.has(refId(r.ref)));
		// Before the network has drawn the bron itself there is nothing to draw beside; say so
		// rather than claim it was drawn.
		if (!store.showRows(selection.id, rows as CanvasRow[])) {
			meld(g.id, 'Het netwerk laadt nog; niets getekend.', null);
			return;
		}
		onNaarNetwerk?.();
		if (nieuw.length)
			meld(g.id, `${telling(nieuw)} getekend in het netwerk.`, () =>
				store.hideRows(nieuw.map((r) => refId(r.ref)))
			);
		else meld(g.id, `Alle ${telling(rows)} stonden al in het netwerk.`, null);
	}

	// A row of an in-place group opens beside the selected bron, which stays selected.
	function inPlaceHref(row: Row) {
		const url = new URL(page.url);
		url.searchParams.set('naast', refId(row.ref));
		url.hash = row.at ?? '';
		return `${url.pathname}?${url.searchParams.toString().replaceAll('%2F', '/').replaceAll('%2C', ',')}${url.hash}`;
	}

	// A row opens its bron as every link to a bron does (openHref): in Netwerk, a Kamerstuk on
	// its text; a group read beside the text opens it there.
	const rowHref = (g: Group, row: Row) =>
		g.inPlace ? inPlaceHref(row) : openHref(row.ref, { at: row.at });

	// The r.o. of a passage opens the citing judgment's text there: the row's, or the selected
	// one's where it cites the row's bron.
	const plaatsHref = (g: Group, row: Row, at: string) =>
		row.ref.collection === 'judgments'
			? g.inPlace
				? inPlaceHref({ ...row, at })
				: bronHref(row.ref, { at, keepMode: false, mode: 'read', paneel: 'tekst' })
			: bronHref(selection.id, { at, keepMode: false, mode: 'read', paneel: 'tekst' });

	// The r.o. of a passage is a reference to the judgment at it: its card is the overweging,
	// the words that cite the article marked (OverwegingKaart). The judgment is the row's, or
	// the selected one where it cites the row's article.
	const plaatsRef = (row: Row) =>
		row.ref.collection === 'judgments' ? row.ref : `judgments/${selection.key}`;
	const plaatsDoel = (row: Row) =>
		row.ref.collection === 'judgments'
			? selection.collection === 'articles'
				? selection.key
				: null
			: row.ref.collection === 'articles'
				? row.ref.key
				: null;

	// A Kamerstuk opens in place under its row: its core text (a motie its dictum, an
	// amendement its toelichting, another its opening), as in Actueel, Bronnen and Gemarkeerd
	// (RijInhoud). The stuk is one step further: Lees verder, or the title with a modifier.
	const opentTerPlekke = (row: Row) => row.ref.collection === 'documents' && !row.missing;
	let openRij = $state<string | null>(null);
	const wisselRij = (row: Row) => (openRij = openRij === rowId(row) ? null : rowId(row));

	/** The row whose provenance a tap shows, on touch. */

	// The years of all the group's judgments where the API counts them (a wet, BE-47);
	// else of the rows loaded, which the sentence then says.
	const years = (g: Group) =>
		grouping !== 'soort' || g.rows[0]?.kind !== 'uitspraken'
			? []
			: g.years?.length
				? g.years
				: g.rows.length > 5
					? yearHistogram(g.rows)
					: [];

	// An export holds every row: those not loaded yet are asked first. Verzamel gave way to
	// Gemarkeerd: a row's box keeps it in the map (src/lib/map).
	async function exportCsv() {
		await onAlles?.();
		await tick();
		download(
			csvName(selection.label, selection.key),
			rowsToCsv(mentionRows(allRows(shown)), selection.collection, page.url.origin)
		);
	}
</script>

<aside class="verbonden" aria-label="Verbonden" bind:this={root}>
	<div class="head">
		<h2 class="head__title">Verbonden</h2>
		<!-- A bron without verbindingen says so by its count, not by a sentence (R7, UX-toets
		     0.79.43: "Deze bron heeft geen verbindingen in de gegevens."). -->
		{#if verbonden.groups.length > 0 || (!verbonden.loading && !verbonden.failed && verbonden.id)}
			<span class="head__count">{vast ? countLine(vast, filter, wachtSet) : ''}</span>
		{/if}
	</div>
	<!-- The choose-line of the panel (docs/bediening.md): how grouped, the filter. No menu of
	     the bronnen: the groups below are the kinds chosen, and the presets and kinds are in
	     the filter (Thijs, 11 Oct). -->
	<div class="regel">
		<TekstMenu
			klein
			label="Indeling"
			waarde={grouping}
			opties={GROUPINGS.map((g) => ({ waarde: g.id, label: g.label }))}
			onKies={(id) => (grouping = id)}
		/>
		<button type="button" class="regel__knop" onclick={onOpenFilter}>Filter</button>
	</div>

	<div class="body" use:rijen={'a.row__title'} aria-busy={verbonden.loading}>
		{#if verbonden.failed}
			<p class="note stil">
				De verbindingen konden niet worden geladen.
				{#if onRetry}
					<TekstLink onclick={onRetry}>Opnieuw</TekstLink>
				{/if}
			</p>
		{:else if verbonden.loading && verbonden.groups.length === 0}
			<!-- The heads of the groups to come, with their counts, and rows still being read. -->
			<!-- Each group in its place, with blank rows as many as it will show (#1): what
			     comes fills them in, and nothing below moves. -->
			{#each verbonden.preview?.length ? verbonden.preview : [null] as p, i (p?.id ?? i)}
				{#if p?.section && p.section !== verbonden.preview?.[i - 1]?.section}
					<h3 class="section">{p.section}</h3>
				{/if}
				{#if p}
					<!-- As the group will stand: its head, and its rows as blank rows (#1). -->
					<section class="group group--voorlopig" aria-hidden="true">
						<div class="group__head">
							<!-- The head as the group's own (heading, button, caret), so its text stands
							     where the group's will. -->
							<h3 class="group__label">
								<button type="button" class="group__knop" tabindex="-1"
									>{p.label.replace(/\S+$/, '')}<span class="group__slot"
										>{p.label.match(/\S+$/)?.[0] ?? ''}<Caret open side /></span
									></button
								>
							</h3>
							<span class="group__count">{p.count != null ? formatCount(p.count) : '…'}</span>
						</div>
						{#if p.count && isOpen(`verbonden:${p.id}`, true)}
							{#if p.noun === 'uitspraken' && (p.count > 5 || (p.id === 'judgments' && onRetry && (selection.collection === 'articles' || selection.collection === 'instruments')))}
								<!-- The line of the judgments' order and years, as it will stand. -->
								<div class="group__regel regel--wacht" aria-hidden="true"></div>
							{/if}
							<ul class="rows rows--wacht" data-wacht={wachtSoort(p.noun)} aria-hidden="true">
								{#each { length: Math.min(p.count, PREVIEW) } as _, k (k)}
									<li class="row row--wacht"><span class="wacht-regel"></span></li>
								{/each}
							</ul>
							{#if p.count > PREVIEW}<p class="group__alle wacht-alle" aria-hidden="true">
									&nbsp;
								</p>{/if}
						{/if}
					</section>
				{:else}
					<div class="voorlopig" aria-hidden="true">
						<span class="balk balk--kop"></span>
						<span class="balk"></span>
						<span class="balk balk--kort"></span>
					</div>
				{/if}
			{/each}
			<p class="sr-only" role="status">Verbindingen laden</p>
		{/if}

		{#each shown as g, i (g.id)}
			{@const all = expanded.has(g.id)}
			{@const bars = years(g)}
			{@const count = groupCount(g)}
			{@const toe = !isOpen(`verbonden:${g.id}`, true)}
			{@const begin = g.label.replace(/\S+$/, '')}
			{@const slot = g.label.match(/\S+$/)?.[0] ?? ''}
			{#if g.section && g.section !== shown[i - 1]?.section}
				<h3 class="section">{g.section}</h3>
			{/if}
			<section class="group" data-group={g.id}>
				<div class="group__head" data-rij>
					<!-- The heading opens and closes the group, remembered per group (Sectie's rule). -->
					<!-- The last word keeps the caret with it: an SVG after text wraps alone (Thijs,
					     10 Oct: "de nieuwe regel hier is niet mooi"). The count follows the heading;
					     when the heading wraps, it stands on the first line's right, by the box. -->
					<h3 class="group__label">
						<button
							type="button"
							class="group__knop"
							aria-expanded={!toe}
							onclick={() => zetOpen(`verbonden:${g.id}`, toe)}
							>{begin}<span class="group__slot">{slot}<Caret open={!toe} side /></span></button
						>
					</h3>
					<!-- While its rows come, the count the node foretells, as the skeleton showed it (#1). -->
					<span class="group__count"
						>{g.laden
							? verbonden.verwacht?.[g.id] != null
								? formatCount(verbonden.verwacht[g.id])
								: '…'
							: countLabel(g)}</span
					>
					{#if network && drawable(g.rows).length > 0}
						<span class="group__laag">
							<RijActies
								naam={g.label}
								netwerk={{
									aan: isLayerOn(g),
									voegToe: () => toggleLayer(g),
									haalWeg: () => toggleLayer(g)
								}}
							/>
						</span>
					{/if}
				</div>
				{#if !toe}
					{#if g.laden && verbonden.verwacht?.[g.id]}
						<!-- Its place as it will be: blank rows as many as it will show, so the rows
						     that come do not push down what stands below (#1). -->
						<ul class="rows rows--wacht" data-wacht={wachtSoort(g.noun)} aria-hidden="true">
							{#each { length: Math.min(verbonden.verwacht[g.id], PREVIEW) } as _, k (k)}
								<li class="row row--wacht"><span class="wacht-regel"></span></li>
							{/each}
						</ul>
						{#if verbonden.verwacht[g.id] > PREVIEW}<p
								class="group__alle wacht-alle"
								aria-hidden="true"
							>
								&nbsp;
							</p>{/if}
						<p class="sr-only">
							{g.noun ? `${g.noun.charAt(0).toUpperCase()}${g.noun.slice(1)} laden…` : 'Laden…'}
						</p>
					{/if}
					{#if melding?.groep === g.id}
						<p class="group__melding" role="status">
							{melding.tekst}
							{#if melding.terug}
								<TekstLink
									onclick={() => {
										melding?.terug?.();
										melding = null;
									}}>Ongedaan maken</TekstLink
								>
							{/if}
						</p>
					{/if}
					{@const volgorde =
						g.id === 'judgments' && onRetry
							? selection.collection === 'articles'
								? 'artikel'
								: selection.collection === 'instruments'
									? 'wet'
									: null
							: null}
					{#if volgorde || bars.length > 0}
						<!-- One line of controls under the heading (docs/bediening.md): the order of the
						     judgments, and the year and the court behind one text menu. -->
						<div class="group__regel">
							{#if volgorde === 'artikel'}
								<!-- Newest first, or the most cited first: the standard judgments on top (UX-15). -->
								<Keuze
									label="Volgorde"
									klein
									opties={[
										{ waarde: 'date_desc' as UitspraakVolgorde, label: 'Datum' },
										{ waarde: 'citation_count' as UitspraakVolgorde, label: 'Meest aangehaald' }
									]}
									waarde={$uitspraakVolgorde}
									onKies={(w) => {
										if (w === $uitspraakVolgorde) return;
										uitspraakVolgorde.set(w);
										onRetry?.();
									}}
								/>
							{:else if volgorde === 'wet'}
								<!-- Newest first, or by the number of the law's articles they cite (BE-47). -->
								<Keuze
									label="Volgorde"
									klein
									opties={[
										{ waarde: 'date' as WetVolgorde, label: 'Datum' },
										{ waarde: 'cited' as WetVolgorde, label: 'Meeste artikelen' }
									]}
									waarde={$wetUitspraakVolgorde}
									onKies={(w) => {
										if (w === $wetUitspraakVolgorde) return;
										wetUitspraakVolgorde.set(w);
										onRetry?.();
									}}
								/>
							{/if}
							{#if bars.length > 0}
								{@const rechter = RECHTERS.find((r) => r.id === filter.rechter)}
								<TekstMenu
									klein
									rechts
									label="Jaar en rechter"
									tekst="{filter.jaar ?? 'Alle jaren'}, {rechter?.label.toLowerCase() ??
										'alle rechters'}"
								>
									{#snippet inhoud(sluit)}
										<div class="jaar-rechter">
											<div class="jaar-rechter__lijst" role="group" aria-label="Jaar">
												{#each [{ year: null, count: null }, ...[...bars]
														.reverse()
														.filter((x) => x.count)] as x (x.year ?? 'alle')}
													<button
														type="button"
														role="menuitemradio"
														class="tekstmenu__item jaar-rechter__item"
														aria-checked={(filter.jaar ?? null) === x.year}
														onclick={() => {
															sluit();
															onFilter({ ...filter, jaar: x.year });
														}}
														>{x.year ?? 'Alle jaren'}{#if x.count}<span class="jaar-rechter__tel"
																>{formatCount(x.count)}</span
															>{/if}</button
													>
												{/each}
											</div>
											<div class="jaar-rechter__lijst" role="group" aria-label="Rechter">
												{#each [{ id: null, label: 'Alle rechters' }, ...RECHTERS] as r (r.id ?? 'alle')}
													<button
														type="button"
														role="menuitemradio"
														class="tekstmenu__item jaar-rechter__item"
														aria-checked={(filter.rechter ?? null) === r.id}
														onclick={() => {
															sluit();
															onFilter({ ...filter, rechter: (r.id as Rechter | null) ?? null });
														}}>{r.label}</button
													>
												{/each}
											</div>
										</div>
									{/snippet}
								</TekstMenu>
							{/if}
						</div>
					{/if}
					<ul class="rows">
						{#each all ? g.rows : g.rows.slice(0, PREVIEW) as row (rowId(row))}
							{@const sister = repeatedTitles(g.rows).has(row.title) ? caseNumberOf(row) : null}
							{@const hoe = hoeVan(row, selection.collection)}
							{@const href = rowHref(g, row)}
							{@const dossier = dossierVanRij(row)}
							<li class="row">
								<!-- The row is the way to its bron: a click anywhere on it opens the bron in
								     Netwerk, as its title does. -->
								<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
								<div
									class="row__main"
									data-rij
									class:is-open={openRij === rowId(row)}
									onclick={(e) => {
										if (onControl(e) || row.missing) return;
										if (window.getSelection()?.toString()) return;
										if (opentTerPlekke(row)) wisselRij(row);
										else goto(href, { noScroll: true });
									}}
								>
									<KindGlyph
										collection={row.ref.collection}
										vorm={row.kind === 'wetsvoorstellen' ? 'voorstel' : undefined}
										size={11}
									/>
									<span class="row__text">
										{#if row.missing}
											<span class="row__title row__title--missing">{row.title}</span>
										{:else}
											<a
												class="row__title"
												{href}
												data-sveltekit-noscroll
												aria-expanded={opentTerPlekke(row) ? openRij === rowId(row) : undefined}
												onclick={(e) => opentTerPlekke(row) && terPlekke(e, () => wisselRij(row))}
												>{#if dossier}<DossierNaam
														{dossier}
														vorm="naam"
													/>{:else}{row.title}{/if}{#if sister}<span class="row__case"
														>, {sister}</span
													>{/if}</a
											>
										{/if}
										{#if hoe && (hoe.werkwoord || hoe.rest)}
											<span class="row__hoe" class:is-afgeleid={hoe.afgeleid}
												>{#if hoe.werkwoord}<b>{hoe.werkwoord}</b
													>{/if}{#if hoe.rest}{hoe.werkwoord && !/^[,:]/.test(hoe.rest)
														? ' '
														: ''}{#if hoe.plaats}{@const i = hoe.rest.indexOf(
															hoe.plaats.text
														)}{hoe.rest.slice(0, i)}<BronLink
															ref={plaatsRef(row)}
															at={hoe.plaats.at}
															doel={plaatsDoel(row)}
															href={plaatsHref(g, row, hoe.plaats.at)}
															class="row__plaats">{hoe.plaats.text}</BronLink
														>{hoe.rest.slice(
															i + hoe.plaats.text.length
														)}{:else}{hoe.rest}{/if}{/if}{#if hoe.afgeleid}, afgeleid{/if}</span
											>
										{/if}
										{#if hoe?.citaat}
											<span class="row__citaat"
												>{hoe.citaat.before}<mark>{hoe.citaat.mark}</mark>{hoe.citaat.after}</span
											>
										{/if}
										<span class="row__meta">
											<!-- Where the verbinding comes from, in the line's own words (Thijs, 10 Oct:
											     the box over the next row was "out of place"). -->
											{#each [...metaParts(row, !!hoe), ...(hoe?.herkomst ? [{ kind: 'herkomst', text: metaParts(row, !!hoe).length ? kleineLetter(hoe.herkomst) : hoe.herkomst }] : [])] as part, k (k)}
												{#if k > 0}<span class="row__sep">,</span>{/if}
												<span class="row__part row__part--{part.kind}">{part.text}</span>
											{/each}
											{#if row.proposed && onProposedText}
												<span class="row__sep">,</span>
												<TekstLink onclick={() => onProposedText(row)}
													>toon voorgestelde tekst</TekstLink
												>
											{/if}
										</span>
									</span>
									<RijActies
										naam={dossier ? dossierNaamNu(dossier) : row.title}
										item={itemVanRij(row)}
										netwerk={!row.missing && onAddToNetwerk
											? { aan: inNetwerk?.(row) ?? false, voegToe: () => onAddToNetwerk(row) }
											: null}
									/>
								</div>
								{#if openRij === rowId(row)}
									<div class="row__inhoud">
										<RijInhoud item={{ node: row.ref }} als="kern" />
									</div>
								{/if}
							</li>
						{/each}
					</ul>
					{#if g.rows.length > PREVIEW}
						<p class="group__alle">
							<AlleN
								aantal={count}
								noun={g.noun ?? 'verbindingen'}
								open={all}
								onclick={() => {
									if (!all && (g.total ?? 0) > g.rows.length) onMeer?.(g.id);
									expanded = toggle(expanded, g.id);
								}}
							/>
						</p>
					{/if}
					{#if all && count > g.rows.length}
						<p class="group__alle">
							<TekstLink href={tableHref}>Alle {formatCount(count)} in een tabel</TekstLink>
						</p>
					{/if}
				{/if}
			</section>
		{/each}

		{#if nogOnderweg.length > 0}
			<p class="note stil group__laden" role="status">
				{zin(nogOnderweg)} laden…
			</p>
		{/if}

		{#if !verbonden.loading && !verbonden.failed && alleenKern}
			<p class="note stil">Geen verbindingen buiten wat boven de tekst staat.</p>
		{:else if !verbonden.loading && !verbonden.failed && shown.length === 0 && groepen.length > 0}
			<p class="note stil">Geen verbindingen binnen de gekozen bronnen en filters.</p>
		{/if}

		{#if hidden.length > 0}
			<!-- What the bronfilter leaves out, as a quiet line of links: each shows its group. -->
			<p class="hidden">
				Ook <span class="ook"
					>{#each hidden as h (h.kind)}<span
							><TekstLink
								title="Toon ook de {BRON_KIND_NOUN[h.kind]}"
								onclick={() => onFilter(withKind(filter, h.kind))}
								>{kindCount(h.count, h.kind)}</TekstLink
							></span
						>{/each}</span
				>
			</p>
		{/if}

		{#if verbonden.groups.length > 0}
			<div class="foot">
				<TekstLink href={tableHref}>Alle {total} in een tabel</TekstLink>
				<TekstLink onclick={exportCsv}>Exporteer</TekstLink>
			</div>
		{/if}
	</div>
</aside>

<style>
	.verbonden {
		display: flex;
		flex-direction: column;
		height: 100%;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
	}
	.head {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: var(--s-2);
		padding: var(--s-4) var(--s-4) 0;
	}
	/* The choose-line: one height (24 px), one baseline, under the heading. */
	.regel {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0 var(--s-4);
		padding: var(--s-1) var(--s-4) var(--s-2);
		border-bottom: 1px solid var(--rule);
	}
	.regel__knop {
		padding: 0;
		border: 0;
		background: none;
		font-family: var(--font-ui);
		font-size: var(--t-ui-micro);
		font-weight: 500;
		color: var(--ink);
		cursor: pointer;
	}
	.regel__knop {
		height: var(--veld-h-klein);
	}
	.regel__knop:hover,
	.regel__knop:focus-visible {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	.head__title {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body);
		font-weight: 600;
		color: var(--ink);
	}
	.head__count {
		color: var(--ink-3);
	}
	.body {
		flex: 1;
		overflow-y: auto;
		padding-bottom: var(--s-6);
	}
	/* The groups while their rows load: their heads, and quiet bars where rows will be. */
	.voorlopig {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		padding: var(--s-3) var(--s-4);
		border-bottom: 1px solid var(--rule);
	}
	.balk {
		display: block;
		height: 12px;
		width: 85%;
		border-radius: var(--r-1);
		/* The panel is paper-2 itself: the bars take the colour of its rules, faintly. */
		background: var(--rule);
		opacity: 0.6;
	}
	.balk--kop {
		height: 16px;
		width: 45%;
	}
	.balk--kort {
		width: 60%;
	}
	@media (prefers-reduced-motion: no-preference) {
		.balk {
			animation: ademen 1.6s ease-in-out infinite;
		}
	}
	@keyframes ademen {
		50% {
			opacity: 0.3;
		}
	}

	.note,
	.hidden {
		margin: 0;
		padding: var(--s-4);
	}
	.hidden {
		margin-top: var(--s-2);
		border-top: 1px solid var(--rule);
	}
	.section {
		margin: var(--s-4) 0 0;
		padding: 0 var(--s-4);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 600;
		font-style: italic;
		color: var(--ink-3);
	}
	.group__head {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		padding: var(--s-4) var(--s-4) var(--s-1);
	}
	.group__label {
		flex: 0 1 auto;
		min-width: 0;
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-weight: 600;
		color: var(--ink);
	}
	/* A block, not inline: a button inline is an inline-block, whose baseline is its last
	   line, and the count and the box would follow a wrapped heading down to it. The caret
	   follows the last word in the slot. */
	.group__knop {
		display: block;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: inherit;
		cursor: pointer;
		text-align: left;
	}
	.group__knop:hover {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	.group__slot {
		white-space: nowrap;
	}
	.group__count {
		flex: none;
		color: var(--ink-3);
	}
	/* Whether the group is drawn on the canvas, said in words beside its box. */
	/* On the margin of the group's head and caption. */
	.group__melding {
		margin: 0;
		padding: 0 var(--s-4) var(--s-1);
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	/* A waiting row: the height of a row with a title over two lines and its meta line, a
	   quiet bar where the title will be. */
	/* The heights measured on 6:162 BW: a judgment's row holds its passage (142 to 163 px),
	   another row a title and a meta line (77 to 140 px). On an article (6:74, 6:98 and 7:611
	   BW, UX-toets 0.79.47, #1): a judgment's row 142 to 163 px, an article's 77 to 119, a
	   Kamerstuk's 163. */
	.row--wacht {
		height: 112px;
		padding: var(--s-2) var(--s-4);
	}
	.rows--wacht[data-wacht='passage'] .row--wacht {
		height: 156px;
	}
	.rows--wacht[data-wacht='verwijzing'] .row--wacht {
		height: 96px;
	}
	.rows--wacht[data-wacht='kamerstuk'] .row--wacht {
		height: 164px;
	}
	/* On a phone the rows wrap more (6:98 BW at 375 px): a judgment's 188, an article's 148 to
	   176, a Kamerstuk's 172. */
	@media (max-width: 768px) {
		.rows--wacht[data-wacht='passage'] .row--wacht {
			height: 188px;
		}
		.rows--wacht[data-wacht='verwijzing'] .row--wacht {
			height: 148px;
		}
		.rows--wacht[data-wacht='kamerstuk'] .row--wacht {
			height: 172px;
		}
	}
	.rows--wacht[data-wacht='uitspraak'] .row--wacht {
		height: 95px;
	}
	.rows--wacht[data-wacht='artikel'] .row--wacht {
		height: 77px;
	}
	.wacht-regel {
		display: block;
		width: 70%;
		height: var(--s-2);
		margin-top: var(--s-2);
		background: var(--paper-2);
	}
	.row__main {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: var(--s-3);
		padding: var(--s-2) var(--s-4);
		cursor: pointer;
	}
	.row__main :global(.kind-glyph) {
		margin-top: var(--s-1);
	}
	.row__main:hover,
	.row__main:focus-within,
	.row__main.is-open {
		background: var(--paper-2);
	}
	.row__text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.row__title {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: 1.3;
		color: var(--ink);
	}
	/* A law the title names that the dataset lacks: read, not followed. */
	.row__title--missing {
		color: var(--ink-3);
	}
	/* The case number that tells sister cases apart, in the title where the eye looks. */
	.row__case {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	/* The dot between parts, with its own room: whitespace around it in the markup is not
	   kept at the start of an element. */
	/* A comma against the word before it, a space after. */
	.row__sep {
		margin-right: 0.3em;
	}
	.row__meta {
		margin-top: 2px;
		color: var(--ink-3);
		line-height: 1.35;
	}
	.row__part--lid {
		font-weight: 600;
		color: var(--ink-2);
	}
	.row__part--proposed {
		color: var(--ink);
		/* In ink, as everything at rest but "nee" (Thijs, 10 Oct); the weight keeps it seen. */
		font-weight: 600;
	}
	.row__part--derived {
		font-style: italic;
	}
	/* The verbinding in words: the verb in weight, the rest as the source gives it. */
	.row__hoe {
		margin-top: 2px;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		line-height: 1.35;
		color: var(--ink-2);
	}
	.row__hoe b {
		font-weight: 600;
		color: var(--ink);
	}
	.row__hoe.is-afgeleid {
		font-style: italic;
	}
	/* A Kamerstuk opened under its row: its core text, in from the row's title. */
	.row__inhoud {
		padding: 0 var(--s-4) var(--s-3) calc(var(--s-4) + 11px + var(--s-3));
		background: var(--paper-2);
	}
	/* The r.o. of the passage: a reference whose card is the overweging, in the line's ink. */
	.row__hoe :global(a.row__plaats) {
		color: inherit;
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
	}
	.row__hoe :global(a.row__plaats:hover),
	.row__hoe :global(a.row__plaats:focus-visible),
	.row__hoe :global(a.row__plaats[aria-expanded='true']) {
		text-decoration-color: currentColor;
	}

	/* The passage that carries the verbinding, the words that name the bron marked. */
	.row__citaat {
		margin-top: var(--s-1);
		padding-left: var(--s-2);
		border-left: 2px solid var(--rule-strong);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		line-height: 1.45;
		color: var(--ink-2);
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.row__citaat mark {
		background: var(--wassing);
		color: var(--ink);
	}
	/* The counts of the line, a comma between them. */
	.ook > span + span::before {
		content: ', ';
	}
	.foot {
		display: flex;
		gap: var(--s-4);
		padding: var(--s-4);
		font-size: var(--t-micro);
	}

	/* The network glyph at the right of a group's heading (RijActies). */
	.group__laag {
		margin-left: auto;
		flex: none;
		/* Outside the line: the head keeps one height with or without it, so the rows below do
		   not move when it appears with the group's rows (UX-toets e7a2f95, #1: 9 px). */
		align-self: center;
		margin-block: calc(-1 * var(--s-2));
	}
	/* One line of controls under a group's heading: the order, the year and the court. */
	.regel--wacht {
		height: 32px;
	}
	.group__regel {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-2) var(--s-4);
		padding: 0 var(--s-4) var(--s-2);
	}
	.jaar-rechter {
		display: grid;
		grid-template-columns: auto auto;
		gap: 0 var(--s-2);
		max-height: 60vh;
		overflow-y: auto;
	}
	.jaar-rechter__lijst {
		display: flex;
		flex-direction: column;
	}
	.jaar-rechter__item {
		display: flex;
		justify-content: space-between;
		gap: var(--s-3);
		white-space: nowrap;
	}
	.jaar-rechter__tel {
		color: var(--ink-3);
	}

	.group__alle {
		margin: 0;
		padding: var(--s-1) var(--s-4) var(--s-3);
		font-size: var(--t-meta);
	}
</style>
