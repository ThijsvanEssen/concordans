<script lang="ts">
	import { meldNetwerk } from '$lib/stores/netwerk-melding';
	import { goto } from '$app/navigation';
	import { rijen } from '$lib/actions/rijen';
	import { hoeVan } from './hoe';
	import { itemVanRij } from '$lib/map/rij';
	// The panel Verbonden: the verbindingen of the selected bron, in the groups of the
	// table in groups.ts, under the bronfilter. In the network each group can put its
	// bronnen on the canvas or take them off.
	import { onControl } from '$lib/actions/outside';
	import Caret from '$lib/components/ui/Caret.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import FilterOptie from '$lib/components/ui/FilterOptie.svelte';
	import AlleN from '$lib/components/ui/AlleN.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import RijActies from '$lib/components/ui/RijActies.svelte';
	import { isOpen, zetOpen } from '$lib/components/ui/dicht.svelte';
	import { page } from '$app/state';
	import { tick } from 'svelte';
	import { bronHref, refId } from '$lib/bron/href';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import type { GraphStore } from '$lib/graph/graph-store';
	import type { CanvasRow } from '$lib/graph/store/types';
	import type { GraphNode } from '$lib/graph/types';
	import {
		RECHTERS,
		type Rechter,
		kindCount,
		BRON_KIND_NOUN,
		PRESETS,
		activePreset,
		bronnenLabel,
		formatCount,
		withKind,
		withPreset,
		type VerbondenFilter
	} from './filter';
	import { countLabel, groupCount, type Group } from './groups';
	import { csvName, download, rowsToCsv } from './export';
	import { caseNumberOf, mentionRows, metaParts, repeatedTitles, rowKey, type Row } from './rows';
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
		totalCount,
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
		onMeer?: (groupId: string) => void;
		/** Every row, before a copy or an export. */
		onAlles?: () => Promise<void>;
	} = $props();

	const PREVIEW = 3;

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
		toon = null;
	});

	// The kern of the bron (Procesgang, Ingediend bij, Wet, Fractie) stands above its text in
	// the band; Verbonden is the context and leaves those groups out (Thijs, 9 Oct: "dubbelop";
	// docs/hierarchie.md, Kern of context). Its count is what it lists; the table keeps all.
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
				(g) => !isKernGroep(selection.collection, g) && !isInhoudGroep(selection.collection, g)
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
					(isKernGroep(selection.collection, g) || isInhoudGroep(selection.collection, g))
			)
	);
	const filtered = $derived(filterGroups(groepen, filter));
	const shown = $derived(regroup(filtered, grouping, selection.collection));
	const hidden = $derived(hiddenLine(groepen, filter));
	const total = $derived(totalCount(verbonden.groups));

	const rowId = rowKey;

	function toggle(set: Set<string>, id: string) {
		const next = new Set(set);
		if (!next.delete(id)) next.add(id);
		return next;
	}

	const drawable = (rows: Row[]) => rows.filter((r) => r.relation && r.direction);
	const isLayerOn = (g: Group) => {
		const rows = drawable(g.rows);
		return rows.length > 0 && rows.every((r) => onCanvas.has(refId(r.ref)));
	};

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

	function toggleLayer(g: Group) {
		const rows = drawable(g.rows);
		if (isLayerOn(g)) {
			const ids = rows.map((r) => refId(r.ref));
			store.hideRows(ids);
			meld(g.id, `${telling(rows)} uit het netwerk gehaald.`, () =>
				store.showRows(selection.id, rows as CanvasRow[])
			);
			return;
		}
		const nieuw = rows.filter((r) => !onCanvas.has(refId(r.ref)));
		store.showRows(selection.id, rows as CanvasRow[]);
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

	// A row opens its bron in Netwerk (Thijs, 10 Oct: "laten we standaard navigeren naar
	// Netwerk"); a group read beside the text opens it there.
	const openHref = (g: Group, row: Row) =>
		g.inPlace
			? inPlaceHref(row)
			: bronHref(row.ref, { at: row.at, keepMode: false, mode: 'graph' });

	/** The row whose provenance a tap shows, on touch. */
	let toon = $state<string | null>(null);
	const aanraking = () => typeof matchMedia !== 'undefined' && matchMedia('(hover: none)').matches;

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
		{#if verbonden.groups.length > 0}
			<span class="head__count">{countLine(groepen, filter)}</span>
		{/if}
	</div>
	<!-- The choose-line of the panel (docs/bediening.md): which bronnen, how grouped, the filter. -->
	<div class="regel">
		<TekstMenu
			klein
			label="Bronnen"
			tekst={bronnenLabel(filter)}
			waarde={activePreset(filter)?.id ?? null}
			opties={PRESETS.map((p) => ({ waarde: p.id, label: p.label }))}
			onKies={(id) => {
				const p = PRESETS.find((x) => x.id === id);
				if (p) onFilter(withPreset(filter, p));
			}}
		>
			{#snippet onder(sluit)}
				<button
					type="button"
					role="menuitem"
					class="regel__menuitem"
					onclick={() => {
						sluit();
						onOpenFilter();
					}}>Kies bronnen en verbindingen</button
				>
			{/snippet}
		</TekstMenu>
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
			<p class="note">
				De verbindingen konden niet worden geladen.
				{#if onRetry}
					<button type="button" class="link is-accent" onclick={onRetry}>Opnieuw</button>
				{/if}
			</p>
		{:else if verbonden.loading && verbonden.groups.length === 0}
			<!-- The heads of the groups to come, with their counts, and rows still being read. -->
			{#each verbonden.preview?.length ? verbonden.preview : [null] as p, i (p?.id ?? i)}
				<div class="voorlopig" aria-hidden={p ? undefined : 'true'}>
					{#if p}
						<p class="voorlopig-kop">
							{p.label}{#if p.count != null}<span class="voorlopig-aantal"
									>{formatCount(p.count)}</span
								>{/if}
						</p>
					{:else}
						<span class="balk balk--kop"></span>
					{/if}
					<span class="balk"></span>
					<span class="balk balk--kort"></span>
				</div>
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
				<div class="group__head">
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
					<span class="group__count">{countLabel(g)}</span>
					{#if network && drawable(g.rows).length > 0}
						<span class="group__laag">
							<FilterOptie
								inline
								label="netwerk"
								title="Toon in het netwerk"
								naam="Toon in het netwerk: {g.label}"
								on={isLayerOn(g)}
								onToggle={() => toggleLayer(g)}
							/>
						</span>
					{/if}
				</div>
				{#if !toe}
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
														class="jaar-rechter__menuitem"
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
														class="jaar-rechter__menuitem"
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
					{#if g.order}<p class="group__caption">{g.order}</p>{/if}
					<ul class="rows">
						{#each all ? g.rows : g.rows.slice(0, PREVIEW) as row (rowId(row))}
							{@const id = rowId(row)}
							{@const sister = repeatedTitles(g.rows).has(row.title) ? caseNumberOf(row) : null}
							{@const hoe = hoeVan(row, selection.collection)}
							{@const href = openHref(g, row)}
							<li class="row" class:toont={toon === id}>
								<!-- The row is the way to its bron: a click anywhere on it opens the bron in
								     Netwerk, as its title does. On touch a tap beside the title shows where
								     the verbinding comes from. -->
								<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
								<div
									class="row__main"
									data-rij
									onclick={(e) => {
										if (onControl(e) || row.missing) return;
										if (aanraking()) toon = toon === id ? null : id;
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
											<a class="row__title" {href} data-sveltekit-noscroll
												>{row.title}{#if sister}<span class="row__case">, {sister}</span>{/if}</a
											>
										{/if}
										{#if hoe && (hoe.werkwoord || hoe.rest)}
											<span class="row__hoe" class:is-afgeleid={hoe.afgeleid}
												>{#if hoe.werkwoord}<b>{hoe.werkwoord}</b
													>{/if}{#if hoe.rest}{hoe.werkwoord && !/^[,:]/.test(hoe.rest)
														? ' '
														: ''}{hoe.rest}{/if}{#if hoe.afgeleid}, afgeleid{/if}</span
											>
										{/if}
										{#if hoe?.citaat}
											<span class="row__citaat"
												>{hoe.citaat.before}<mark>{hoe.citaat.mark}</mark>{hoe.citaat.after}</span
											>
										{/if}
										<span class="row__meta">
											{#each metaParts(row, !!hoe) as part, k (k)}
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
										{#if hoe?.herkomst}
											<span class="row__herkomst">{hoe.herkomst}</span>
										{/if}
									</span>
									<RijActies
										naam={row.title}
										item={itemVanRij(row)}
										netwerk={!row.missing && onAddToNetwerk
											? { aan: inNetwerk?.(row) ?? false, voegToe: () => onAddToNetwerk(row) }
											: null}
									/>
								</div>
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

		{#if !verbonden.loading && !verbonden.failed && alleenKern}
			<p class="note">Geen verbindingen buiten wat boven de tekst staat.</p>
		{:else if !verbonden.loading && !verbonden.failed && shown.length === 0 && groepen.length > 0}
			<p class="note">Geen verbindingen binnen de gekozen bronnen en filters.</p>
		{/if}
		{#if !verbonden.loading && !verbonden.failed && verbonden.groups.length === 0 && verbonden.id}
			<p class="note">Deze bron heeft geen verbindingen in de gegevens.</p>
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
				<TekstLink href={tableHref}>Alle {formatCount(total)} in een tabel</TekstLink>
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
	.regel__knop,
	.regel__menuitem {
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
		color: var(--accent);
	}
	.regel__menuitem {
		display: block;
		width: 100%;
		padding: var(--s-1) var(--s-3);
		color: var(--ink-2);
		text-align: left;
	}
	.regel__menuitem:hover,
	.regel__menuitem:focus-visible {
		background: var(--paper-2);
		outline: none;
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
	.voorlopig-kop {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body);
		color: var(--ink-2);
	}
	.voorlopig-aantal {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
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
		color: var(--ink-3);
		line-height: 1.4;
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
		color: var(--accent);
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
	.group__caption {
		margin: 0;
		padding: 0 var(--s-4) var(--s-1);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
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
	.row__main:focus-within {
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
		color: var(--accent);
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
		background: var(--accent-soft);
		color: var(--ink);
	}
	/* Where the verbinding comes from: on hover and focus, on a phone after a tap (Thijs). */
	.row__herkomst {
		display: none;
		position: absolute;
		top: calc(100% - var(--s-1));
		left: calc(var(--s-4) + 21px);
		z-index: var(--z-float);
		max-width: calc(100% - var(--s-4) * 2 - 21px);
		padding: var(--s-1) var(--s-2);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		box-shadow: var(--shadow-modal);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		line-height: 1.35;
		color: var(--ink-2);
		pointer-events: none;
	}
	.row__main:hover .row__herkomst,
	.row__main:focus-within .row__herkomst,
	.row.toont .row__herkomst {
		display: block;
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
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	/* "netwerk" at the right of a group's heading: the vinkje of FilterOptie. */
	.group__laag {
		margin-left: auto;
		flex: none;
	}
	/* One line of controls under a group's heading: the order, the year and the court. */
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
	.jaar-rechter__menuitem {
		display: flex;
		justify-content: space-between;
		gap: var(--s-3);
		padding: var(--s-1) var(--s-3);
		border: 0;
		background: none;
		font-family: var(--font-ui);
		font-size: var(--t-ui-micro);
		color: var(--ink);
		text-align: left;
		white-space: nowrap;
		cursor: pointer;
	}
	.jaar-rechter__menuitem:hover,
	.jaar-rechter__menuitem:focus-visible {
		background: var(--paper-2);
		outline: none;
	}
	.jaar-rechter__menuitem[aria-checked='true'] {
		font-weight: 600;
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
