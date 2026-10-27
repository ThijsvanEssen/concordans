<script lang="ts">
	// A row of Verbonden: one verbinding with one bron. Its glyph and title, its line of the
	// verbinding (hoe.ts) with the place a passage stands at, the passage, and the meta line. A
	// click anywhere on it opens it in place, as its title does: a Kamerstuk its core text, a
	// connected law the references between the two, any other bron its glance. The bron is one
	// step further (Lees verder, or the title with a modifier).
	import { page } from '$app/state';
	import { textOf } from '$lib/text/words';
	import { zetMarkering } from '$lib/bron/markering.svelte';
	import { itemVanRij } from '$lib/map/rij';
	import { blockClick, terPlekke } from '$lib/actions/klik';
	import { bronHref, openHref, refId } from '$lib/bron/href';
	import { withParams } from '$lib/util/address';
	import { dossierName } from '$lib/bron/dossier-naam';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import BronLink from '$lib/bron/BronLink.svelte';
	import DossierNaam from '$lib/bron/DossierNaam.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import RijActies from '$lib/components/ui/RijActies.svelte';
	import RijInhoud from '$lib/components/open/RijInhoud.svelte';
	import RowGlance from './RowGlance.svelte';
	import StukUitslag from '$lib/components/parliamentary/StukUitslag.svelte';
	import { stukUitslag } from '$lib/components/parliamentary/stuk-uitslag';
	import type { GraphNode } from '$lib/graph/types';
	import Aanhaling from './Aanhaling.svelte';
	import ConfidenceDot from './ConfidenceDot.svelte';
	import { betrouwbaarheid } from './verbinding';
	import WetVerwijzingen from './WetVerwijzingen.svelte';
	import TierSwatch from './TierSwatch.svelte';
	import { shapeOfTier } from './tiers';
	import { hoeVan, kleineLetter } from './hoe';
	import { ankerVanRij, dossierVanRij, metaParts, type Row } from './rows';

	let {
		row,
		selection,
		inPlace = false,
		sister = null,
		open,
		onToggle,
		onProposedText,
		onAddToNetwerk,
		inNetwerk
	}: {
		row: Row;
		selection: GraphNode;
		/** Its group is read beside the selected bron: the row opens there. */
		inPlace?: boolean;
		/** The case number that tells it from a sister case of the same title. */
		sister?: string | null;
		/** Opened in place under it. */
		open: boolean;
		onToggle: () => void;
		onProposedText?: (row: Row) => void;
		onAddToNetwerk?: (row: Row) => void;
		inNetwerk?: (row: Row) => boolean;
	} = $props();

	/** The width of a row's glyph: the opened content of a row stands in from it. */
	const ROW_GLYPH = 11;

	// The passage is the row's where its bron cites the selected one, else the selected one's.
	const inRij = $derived(row.direction === 'inbound');

	// A row of an in-place group opens beside the selected bron, which stays selected.
	const inPlaceHref = (at: string | null) =>
		withParams(page.url, { naast: refId(row.ref) }, { hash: at ?? '' });

	// A row opens its bron as every link to a bron does (openHref): in Tekst; a group read
	// beside the text opens it there. A citing judgment opens at the
	// note its citation stands in.
	const href = $derived(
		inPlace ? inPlaceHref(ankerVanRij(row)) : openHref(row.ref, { at: ankerVanRij(row) })
	);

	// The r.o. of a passage is a reference to the judgment at it: its card is the overweging,
	// the words that cite the article or judgment marked, in its note where the citation stands
	// in one (OverwegingKaart). A note of a Kamerstuk opens the stuk there.
	const plaatsRef = $derived(inRij ? row.ref : selection.id);
	const plaatsDoel = $derived.by(() => {
		const cited = inRij ? selection : row.ref;
		return cited.collection === 'articles' || cited.collection === 'judgments' ? cited.key : null;
	});
	// The r.o. of a passage opens the citing judgment's text there: the row's, or the selected
	// one's where it cites the row's bron.
	const plaatsHref = (at: string) =>
		inRij
			? inPlace
				? inPlaceHref(at)
				: bronHref(row.ref, { at, keepMode: false, mode: 'read' })
			: bronHref(selection.id, { at, keepMode: false, mode: 'read' });
	// What the reader marks where the place opens it: the note opened, the citation in it.
	const plaatsMarkering = (plaats: { at: string; noot: string | null }) => ({
		bron: inRij ? refId(row.ref) : selection.id,
		at: plaats.noot ?? plaats.at,
		doel: plaatsDoel,
		bereik: row.bereik ?? null
	});
	/** What its reader marks where the row opens it at a note: the citation in it. */
	const rijMarkering = $derived(
		inRij && row.noot
			? { bron: refId(row.ref), at: row.noot.id, doel: plaatsDoel, bereik: row.bereik ?? null }
			: null
	);

	// A Kamerstuk opens in place under its row: its core text (a motie its dictum, an
	// amendement its toelichting, another its opening), as in Actueel, Bronnen and Bundels
	// (RijInhoud). The stuk is one step further: Lees verder, or the title with a modifier. A
	// connected law opens on the references between the two laws' articles (Thijs, 14 Oct).
	const wetVerband = $derived.by(() => {
		const van = row.edge?.van;
		const naar = row.props?.bwb_id;
		return row.ref.collection === 'instruments' &&
			row.relation === 'REFERS_TO' &&
			typeof van === 'string' &&
			typeof naar === 'string'
			? { van, naar, dit: typeof row.edge?.dit === 'string' ? row.edge.dit : undefined }
			: null;
	});

	// A judgment carries the vlak of its tierShape where the soortteken would stand (Design System,
	// VerbondenGroep): the strook above the group and its rows read as one.
	const tierShape = $derived(
		row.ref.collection === 'judgments' && typeof row.props?.tier === 'string'
			? shapeOfTier(row.props.tier)
			: null
	);

	const hoe = $derived(hoeVan(row, selection.collection));
	// A derived verbinding says how sure it is (Design System, Zekerheid).
	const zekerheid = $derived(betrouwbaarheid(row.confidence, true, null));
	// Where the passage stands under the line, it shows the verbinding is in the text: the
	// words "staat letterlijk in de tekst" say it twice (A208c).
	const herkomst = $derived(
		hoe?.herkomst && !(hoe.citaat && hoe.herkomst === 'Staat letterlijk in de tekst')
			? hoe.herkomst
			: null
	);
	const dossier = $derived(dossierVanRij(row));
	// A motie or amendement says how the Kamer decided, on every list (StukUitslag); the day of
	// the vote then stands for the stuk's own.
	const uitslag = $derived(row.ref.collection === 'documents' ? stukUitslag(row.props) : null);
	// An open row of another bron shows the passage in its glance until the glance's own text has
	// come, which then stands in its place: the passage is never shown twice (RowGlance).
	const glimpInGlance = $derived(open && !wetVerband && row.ref.collection !== 'documents');
	const delen = $derived(metaParts(uitslag?.datum ? { ...row, date: null } : row, !!hoe));

	/** An article by the abbreviation of its law ("Artikel 3.34 Ar"): the law's full title at hover. */
	const fullTitle = $derived(
		row.ref.collection === 'articles' && typeof row.props?.instrument_citation_title === 'string'
			? row.props.instrument_citation_title
			: undefined
	);
</script>

{#snippet glimp(opened: boolean)}
	{#if hoe?.citaat}
		<span class="row__citaat" class:is-open={opened}><Aanhaling passage={hoe.citaat} /></span>
	{/if}
{/snippet}
{#snippet glimpOpen()}{@render glimp(true)}{/snippet}

<li class="row" class:row--onder={!!row.onder} style:--row-glyph="{ROW_GLYPH}px">
	<!-- The row is the way to its bron: a click anywhere on it opens the bron in Netwerk, as its
	     title does. -->
	<div
		class="row__main"
		data-rij
		class:is-open={open}
		use:blockClick={row.missing ? null : onToggle}
	>
		{#if tierShape}
			<span class="row__vlak"><TierSwatch shape={tierShape} /></span>
		{:else}
			<KindGlyph
				collection={row.ref.collection}
				vorm={row.filterGroup === 'wetsvoorstellen' ? 'voorstel' : undefined}
				size={ROW_GLYPH}
			/>
		{/if}
		<span class="row__text">
			{#if row.missing}
				<span class="row__title row__title--missing">{row.title}</span>
			{:else}
				<a
					class="row__title"
					{href}
					title={fullTitle}
					data-sveltekit-noscroll
					aria-expanded={open}
					onclick={(e) => terPlekke(e, onToggle)}
					>{#if dossier}<DossierNaam
							{dossier}
							vorm="naam"
						/>{:else}{row.title}{/if}{#if sister}<span class="row__case">, {sister}</span>{/if}</a
				>
			{/if}
			{#if hoe && (hoe.werkwoord || hoe.rest)}
				<span class="row__hoe" class:is-afgeleid={hoe.afgeleid}
					>{#if hoe.werkwoord}<b>{hoe.werkwoord}</b>{/if}{#if hoe.rest}{hoe.werkwoord &&
						!/^[,:]/.test(hoe.rest)
							? ' '
							: ''}{#if hoe.plaats}{@const i = hoe.rest.indexOf(hoe.plaats.text)}{hoe.rest.slice(
								0,
								i
							)}<BronLink
								ref={plaatsRef}
								at={hoe.plaats.at}
								noot={hoe.plaats.noot}
								doel={plaatsDoel}
								markering={plaatsMarkering(hoe.plaats)}
								href={plaatsHref(hoe.plaats.noot ?? hoe.plaats.at)}
								class="row__plaats">{hoe.plaats.text}</BronLink
							>{hoe.rest.slice(
								i + hoe.plaats.text.length
							)}{:else}{hoe.rest}{/if}{/if}{#if hoe.afgeleid}, naam herkend <ConfidenceDot
							word={zekerheid.word}
						/>{/if}</span
				>
			{/if}
			{#if hoe?.citaat && !glimpInGlance}
				{@render glimp(open)}
			{/if}
			<span class="row__meta">
				<!-- Where the verbinding comes from, in the line's own words (Thijs, 10 Oct: the box
				     over the next row was "out of place"). -->
				{#each delen as part, k (k)}
					{#if k > 0}<span class="row__sep">,</span>{/if}
					<span
						class="row__part row__part--{part.kind}"
						class:is-proposed={part.kind === 'proposed'}>{part.text}</span
					>
				{/each}{#if uitslag}{#if delen.length}<span class="row__sep">,</span>{/if}<span
						class="row__part"><StukUitslag {uitslag} /></span
					>{/if}{#if herkomst}{#if delen.length || uitslag}<span class="row__sep">,</span>{/if}<span
						class="row__part row__part--herkomst"
						>{delen.length || uitslag ? kleineLetter(herkomst) : herkomst}</span
					>{/if}
				{#if row.proposed && onProposedText}
					<span class="row__sep">,</span>
					<TekstLink onclick={() => onProposedText(row)}>toon voorgestelde tekst</TekstLink>
				{/if}
			</span>
		</span>
		<RijActies
			naam={dossier ? dossierName(dossier) : row.title}
			item={itemVanRij(row)}
			netwerk={!row.missing && onAddToNetwerk
				? { aan: inNetwerk?.(row) ?? false, voegToe: () => onAddToNetwerk(row) }
				: null}
		/>
	</div>
	{#if open}
		<div class="row__inhoud">
			{#if wetVerband}
				<WetVerwijzingen {...wetVerband} />
			{:else if row.ref.collection !== 'documents'}
				<RowGlance
					bron={row.ref}
					at={row.at ?? null}
					{href}
					onRead={() => zetMarkering(rijMarkering)}
					glimp={hoe?.citaat ? glimpOpen : undefined}
				/>
			{:else}
				<RijInhoud
					item={{
						node: row.ref,
						dictum: textOf(row.props?.dictum),
						explanation: textOf(row.props?.explanation)
					}}
					als="kern"
				/>
			{/if}
		</div>
	{/if}
</li>

<style>
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
	/* The vlak stands on the first line of the title, in the width of a soortteken. */
	.row__vlak {
		flex: none;
		display: flex;
		justify-content: center;
		width: var(--row-glyph);
		margin-top: var(--s-2);
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
	/* A comma against the word before it, a space after: whitespace in the markup is not kept
	   at the start of an element. */
	.row__sep {
		margin-right: 0.3em;
	}
	.row__meta {
		margin-top: 2px;
		color: var(--ink-3);
		line-height: 1.35;
	}
	.row__part--lid {
		font-weight: 400;
		color: var(--ink-2);
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
		font-weight: 400;
		color: var(--ink-2);
	}
	.row__hoe.is-afgeleid {
		font-style: italic;
	}
	/* A regulation issued under the regulation above it: in from that one, on its rule. */
	.row--onder .row__main {
		margin-left: calc(var(--s-4) + 4px);
		padding-left: var(--s-3);
		border-left: 1px solid var(--rule);
	}
	/* A Kamerstuk opened under its row: its core text, in from the row's title. */
	.row__inhoud {
		padding: 0 var(--s-4) var(--s-3) calc(var(--s-4) + var(--row-glyph) + var(--s-3));
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

	/* On a touch screen the place is a line of a finger's 44 px of its own, under the title and
	   not over it. */
	@media (pointer: coarse), (max-width: 768px) {
		/* The title as high as the closed row's (KindSummary): opening moves nothing under the
		   finger. */
		a.row__title {
			display: flex;
			align-items: center;
			min-height: var(--veld-h-raak);
		}
		.row__hoe :global(a.row__plaats) {
			display: inline-flex;
			align-items: center;
			min-height: var(--veld-h-raak);
		}
		.row__hoe :global(a.row__plaats)::after {
			display: none;
		}
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
	/* Opened, the passage stands whole. */
	.row__citaat.is-open {
		display: block;
		-webkit-line-clamp: none;
		line-clamp: none;
		overflow: visible;
	}
</style>
