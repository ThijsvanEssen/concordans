<script lang="ts" generics="B = unknown">
	import { bewaarItem } from '$lib/map/map';
	import BronLink from '$lib/bron/BronLink.svelte';
	// De gedeelde tijdlijn, het ene patroon voor een reeks met datums. Datum links in een vaste
	// kolom, alleen wat de kop nog niet zegt; een teken op een doorlopende lijn; dan label, zin
	// en meta. Het teken is dat van de soort, zoals in het netwerk en Verbonden: een stemming
	// een driehoek, gevuld in mos als ze is aangenomen, open in het accent als ze is verworpen;
	// wat nog kan volgen staat gestippeld. Een regel met inhoud gedraagt zich als een rij van
	// Actueel (IndexRow): één klik opent die inhoud onder de regel, de bron staat een stap
	// verder. Een termijn (`perioden`, Loopbaan) is geen moment: geen lijn en geen teken.
	import type { Snippet } from 'svelte';
	import { sorteer, type TijdGroep, type TijdRegel, type Volgorde } from './tijdlijn';
	import { dagMaand, yearsOf } from '$lib/text/datum';
	import RijActies from '$lib/components/ui/RijActies.svelte';
	import Markering from '$lib/components/ui/Markering.svelte';
	import { isOpen, subKey } from '$lib/components/ui/dicht.svelte';
	import FoldButton from '$lib/components/ui/FoldButton.svelte';
	import { VORMEN, VORM_VAN } from '$lib/bron/vormen';
	import { openHref } from '$lib/bron/href';
	import { rowClick, terPlekke } from '$lib/actions/klik';
	import { parseNodeId } from '$lib/vocabulary';
	// Het teken op de lijn is het bronteken zelf, uit dezelfde tabel als KindGlyph en het
	// canvas (vormen.ts); de uitkomst zit in vulling en kleur. Geen teken van zichzelf.
	const vormVan = (r: TijdRegel<B>) =>
		VORMEN[r.vorm ?? (r.soort ? VORM_VAN[r.soort] : null) ?? 'overig'];

	let {
		groepen,
		datums = true,
		inklapbaar = false,
		niveau = 3,
		perioden = false,
		volgorde = null,
		bewaar = false,
		openId,
		onToggle,
		leeg = null,
		meer,
		onderRegel
	}: {
		groepen: TijdGroep<B>[];
		/** Zonder datumkolom als de kop de dag al noemt. */ datums?: boolean;
		/** Each group's heading opens and closes it (the procedure of a dossier: the Raad van
		 *  State, the Tweede and the Eerste Kamer); open until closed, kept per heading. */
		inklapbaar?: boolean;
		/** De kop van een groep: 2 waar de tijdlijn de pagina is (Actueel), 3 in een sectie. */
		niveau?: 2 | 3;
		/** De compacte vorm: termijnen, de jaren in de termkolom, zonder lijn en teken. */
		perioden?: boolean;
		/** De tijdlijn zet de regels van een groep zelf op datum. */
		volgorde?: Volgorde | null;
		/** Bewaar on each line with a bron (RijActies), where it is in Actueel. */
		bewaar?: boolean;
		/** The line open, where the page keeps it (Actueel: in the address); else the Tijdlijn's. */
		openId?: string | null;
		onToggle?: (id: string) => void;
		/** Eén stille regel waar niets is. */
		leeg?: string | null;
		/** Onder de laatste groep, in de tekstkolom: Volgende dagen, Alle 9 openstaande toezeggingen. */
		meer?: Snippet;
		/** Under a line with `bij`, after its meta: what the caller draws of it (CoalitieRegel). */
		onderRegel?: Snippet<[B]>;
	} = $props();

	/** Het jaar onder de dag, tenzij de kop het al noemt. */
	const metJaar = (g: TijdGroep<B>, iso: string) => iso.slice(0, 4) !== g.jaar;

	// One line open at a time.
	let eigen = $state<string | null>(null);
	const open = $derived(onToggle ? (openId ?? null) : eigen);
	const wissel = (id: string) => {
		if (onToggle) onToggle(id);
		else eigen = eigen === id ? null : id;
	};
	function opRegel(e: MouseEvent, r: TijdRegel<B>) {
		if (r.inhoud) rowClick(e, () => wissel(r.id));
	}

	const regelsVan = (g: TijdGroep<B>) => (volgorde ? sorteer(g.regels, volgorde) : g.regels);
	/** What a line's Bewaar keeps: the bron it names, by its zin, under its kind. */
	const bewaarVan = (r: TijdRegel<B>) => {
		const id = r.bron ?? (typeof r.ref === 'string' ? r.ref : null);
		const doel = id ? parseNodeId(id) : null;
		return id && doel ? bewaarItem(id, { kort: r.zin, voluit: r.zin }) : null;
	};
	const bronVan = (r: TijdRegel<B>) =>
		r.href ?? (r.ref ? openHref(r.ref, { hasText: r.heeftTekst }) : null);
	const uid = $props.id();
</script>

<div class="tl" class:zonder={!datums} class:perioden class:met-acties={bewaar}>
	{#each groepen as g (g.id)}
		{@const sleutel = subKey(g.titel)}
		{@const groepOpen = !inklapbaar || isOpen(sleutel, true)}
		<section class="groep">
			{#if g.titel}
				<svelte:element this={niveau === 2 ? 'h2' : 'h3'} class="kop kop--{niveau}">
					{#if inklapbaar}
						<FoldButton {sleutel} open={groepOpen}
							>{g.titel}{#if g.sub}<span class="sub">{g.sub}</span>{/if}</FoldButton
						>
					{:else}
						{g.titel}{#if g.sub}<span class="sub">{g.sub}</span>{/if}
					{/if}
				</svelte:element>
			{/if}
			{#if groepOpen}
				<ol class="regels">
					{#each regelsVan(g) as r (r.id)}
						{@const v = vormVan(r)}
						{@const isHet = open === r.id}
						{@const kept = bewaar ? bewaarVan(r) : null}
						{@const doel = r.inhoud ? bronVan(r) : null}
						<li
							class="regel regel--{r.teken}"
							class:groot={r.groot}
							class:kan-open={!!r.inhoud}
							class:is-open={isHet}
							class:is-dim={r.gedimd}
							data-rij
						>
							<span class="datum"
								>{#if r.periode}{yearsOf(
										r.periode.van,
										r.periode.tot
									)}{:else if r.datum && r.datumKnop}<button
										type="button"
										class="datum-knop"
										title={r.datumKnop.titel}
										onclick={r.datumKnop.actie}
										>{dagMaand(r.datum)}{#if metJaar(g, r.datum)}<span class="j"
												>{r.datum.slice(0, 4)}</span
											>{/if}</button
									>{:else if r.datum}{dagMaand(r.datum)}{#if metJaar(g, r.datum)}<span class="j"
											>{r.datum.slice(0, 4)}</span
										>{/if}{/if}</span
							>
							{#if !perioden}
								<svg class="bteken" width="14" height="14" viewBox="-1 -1 18 18" aria-hidden="true"
									><path
										d={v.d}
										fill-rule={v.wijze === 'gat' ? 'evenodd' : 'nonzero'}
										class:vol={v.wijze !== 'lijn' &&
											(r.teken === 'ja' || r.teken === 'stuk' || r.teken === 'activiteit')}
									/></svg
								>
							{/if}
							<!-- The button below is the keyboard's way in; this only widens its target. -->
							<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
							<div class="tekst" title={r.hint ?? undefined} onclick={(e) => opRegel(e, r)}>
								{#if r.inhoud}
									<button
										type="button"
										class="regel-toggle"
										aria-expanded={isHet}
										aria-controls={isHet ? `${uid}-${r.id}` : undefined}
										aria-label="Inhoud van {r.zin}"
										onclick={() => wissel(r.id)}
									></button>
								{/if}
								{#if r.label}<span class="label">{r.label}</span>{/if}
								{#if r.inhoud && doel}<a
										class="zin"
										href={doel}
										data-sveltekit-noscroll
										onclick={(e) => terPlekke(e, () => wissel(r.id))}>{@render zinVan(r)}</a
									>{:else if r.inhoud}<span class="zin">{@render zinVan(r)}</span
									>{:else if r.ref}<BronLink ref={r.ref} class="zin">{@render zinVan(r)}</BronLink
									>{:else if r.href}<a
										href={r.href}
										rel={/^https?:/.test(r.href) ? 'external' : undefined}
										class="zin">{@render zinVan(r)}</a
									>{:else if r.actie}<button type="button" class="zin zin--actie" onclick={r.actie}
										>{@render zinVan(r)}</button
									>{:else}<span class="zin">{@render zinVan(r)}</span>{/if}
								{#if r.meta}<span class="meta">{r.meta}</span>{/if}
								{#if r.onder}<span class="meta">{@render r.onder(r.id)}</span>{/if}
								{#if r.bij && onderRegel}{@render onderRegel(r.bij)}{/if}
								{#if isHet && r.inhoud}<div class="inhoud" id="{uid}-{r.id}">
										{@render r.inhoud(r.id)}
									</div>{/if}
							</div>
							{#if bewaar}<span class="acties"
									>{#if kept}<RijActies naam={r.zin} item={kept} />{/if}</span
								>{/if}
						</li>
					{/each}
				</ol>
				{#if g.noot}<p class="noot">{g.noot}</p>{/if}
			{/if}
		</section>
	{:else}
		{#if leeg}<p class="leeg">{leeg}</p>{/if}
	{/each}
	{#if meer}<p class="verder">{@render meer()}</p>{/if}
</div>

<!-- The zin, with the words a reader follows marked where the line has them (Gevolgd). -->
{#snippet zinVan(r: TijdRegel)}{#if r.zinDelen}<Markering
			delen={r.zinDelen}
		/>{:else}{r.zin}{/if}{/snippet}

<style>
	.tl {
		display: flex;
		flex-direction: column;
		gap: var(--s-5);
		/* The two columns before the text, shared by the lines, the note and Meer. */
		--tl-datum: var(--s-8);
		--tl-teken: 20px;
		--tl-voor: calc(var(--tl-datum) + var(--tl-teken) + 2 * var(--s-2));
	}
	/* A line that leads to a list on the page: read as the other lines, underlined as a link. */
	.zin--actie,
	.datum-knop {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: inherit;
		text-align: left;
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
		cursor: pointer;
	}
	.datum-knop {
		text-align: right;
	}
	.zin--actie:hover,
	.datum-knop:hover {
		text-decoration-color: currentColor;
	}
	.kop {
		margin: 0;
		padding-bottom: var(--s-2);
		border-bottom: 2px solid var(--ink);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink);
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-2);
		align-items: baseline;
	}
	/* Rung 2 where the timeline is the page (a day of Actueel). */
	.kop--2 {
		padding-top: var(--s-5);
		font-size: var(--t-h3);
		font-weight: 800;
		border-bottom-width: 1px;
		border-bottom-color: var(--rule-strong);
	}
	.sub {
		font-weight: 400;
		color: var(--ink-3);
	}
	.kop--2 .sub {
		font-size: var(--t-micro);
	}
	.regels {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.regel {
		display: grid;
		grid-template-columns: var(--tl-datum) var(--tl-teken) minmax(0, 1fr);
		gap: 0 var(--s-2);
		position: relative;
		/* Where the line opens for the teken of the row: the teken stands on the page
		   itself, with no plate of its own, in light and dark alike. */
		--gat-van: calc(var(--s-2) + 1px);
		--gat-tot: calc(var(--s-2) + 19px);
	}
	.met-acties .regel {
		grid-template-columns: var(--tl-datum) var(--tl-teken) minmax(0, 1fr) auto;
	}
	/* De doorlopende lijn door de tekens, open waar het teken staat. */
	.regel::before {
		content: '';
		position: absolute;
		left: calc(var(--tl-datum) + var(--s-2) + 9px);
		top: 0;
		bottom: 0;
		width: 1px;
		background: linear-gradient(
			to bottom,
			var(--rule) var(--gat-van),
			transparent var(--gat-van) var(--gat-tot),
			var(--rule) var(--gat-tot)
		);
	}
	.regel:first-child::before {
		top: var(--gat-tot);
		background: var(--rule);
	}
	.regel:last-child::before {
		bottom: calc(100% - var(--s-3) - 6px);
	}
	.regel:only-child::before {
		display: none;
	}
	.is-dim {
		opacity: 0.4;
	}
	.datum {
		padding: var(--s-2) 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-2);
		text-align: right;
		line-height: 1.6;
	}
	.j {
		display: block;
		color: var(--ink-3);
	}
	/* Het bronteken op de lijn: gevuld in inkt; aangenomen of afgedaan in mos; verworpen als
	   omtrek in het accent; openstaand of verwacht als gestippelde omtrek. */
	.bteken {
		position: relative;
		z-index: 1;
		justify-self: center;
		margin-top: calc(var(--s-2) + 3px);
		overflow: visible;
	}
	.bteken path {
		fill: none;
		stroke: var(--ink);
		stroke-width: 1.6;
	}
	.bteken path.vol {
		fill: var(--ink);
		stroke: none;
	}
	.regel--ja .bteken path.vol {
		fill: var(--uitkomst-ja);
	}
	.regel--nee .bteken path {
		stroke: var(--uitkomst-nee);
		stroke-width: 2;
	}
	.regel--open .bteken path,
	.regel--verwacht .bteken path {
		stroke-dasharray: 2 1.5;
		stroke: var(--ink-2);
	}
	.tekst {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		padding: var(--s-2) 0;
		border-bottom: 1px solid var(--rule);
		min-width: 0;
	}
	.kan-open .tekst {
		cursor: pointer;
	}
	.kan-open .tekst:hover .zin {
		text-decoration-line: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
	}
	/* The keyboard's way in, under the line's text, the size of it. */
	.regel-toggle {
		position: absolute;
		inset: 0;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
	}
	.regel-toggle:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}
	/* The content lies over the toggle; a click on it is passed on by the line. */
	.tekst > :not(.regel-toggle) {
		position: relative;
	}
	.label {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-2);
	}
	.regel--ja .label {
		color: var(--uitkomst-ja);
	}
	.regel--nee .label {
		color: var(--uitkomst-nee);
	}
	.zin,
	.tekst :global(a.zin) {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: var(--lh-snug);
		color: var(--ink);
		text-decoration: none;
		text-wrap: pretty;
	}
	.tekst :global(a.zin:hover) {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	.groot .zin,
	.groot :global(a.zin) {
		font-size: var(--t-h3);
		font-weight: 600;
	}
	/* A line that opens: two lines at most, as a row of Actueel; opened, the zin whole. */
	.kan-open:not(.is-open) .zin {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
	}
	.regel--verwacht .zin,
	.regel--verwacht :global(a.zin) {
		color: var(--ink-3);
		font-style: italic;
	}
	.meta {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* Opened: the bron's own content under the line, a rule on its left. */
	.inhoud {
		margin-top: var(--s-2);
		padding-left: var(--s-3);
		border-left: 2px solid var(--rule-strong);
		cursor: auto;
	}
	.acties {
		padding-top: var(--s-2);
		border-bottom: 1px solid var(--rule);
	}
	.noot,
	.verder,
	.leeg {
		margin: 0 0 0 var(--tl-voor);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.noot {
		margin-top: var(--s-2);
	}
	.verder {
		font-size: var(--t-meta);
		color: var(--ink);
	}
	.zonder {
		--tl-datum: 0px;
	}
	.zonder .datum {
		visibility: hidden;
	}
	/* Perioden: the years in the reader's term column (96px; on a phone as wide as "2023–2026"), no line, no teken. */
	.perioden {
		--tl-datum: max(var(--reader-term, 0px), calc(var(--s-8) + var(--s-2)));
		--tl-teken: 0px;
		--tl-voor: calc(var(--tl-datum) + var(--s-4));
	}
	/* Child combinators: a Tijdlijn opened inside a line (PostOpen under a term) keeps its own
	   form. */
	.perioden > .groep > .regels > .regel {
		grid-template-columns: var(--tl-datum) minmax(0, 1fr);
		gap: 0 var(--s-4);
	}
	.perioden > .groep > .regels > .regel::before {
		display: none;
	}
	/* The years are a column of figures. */
	.perioden > .groep > .regels > .regel > .datum {
		text-align: left;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
	}
	/* A phone: the line keeps its grid; Bewaar goes under the text, as in Actueel's rows. */
	@media (max-width: 768px) {
		.met-acties .regel {
			grid-template-columns: var(--tl-datum) var(--tl-teken) minmax(0, 1fr);
		}
		.acties {
			grid-column: 3;
			padding-top: 0;
		}
		.met-acties .tekst {
			border-bottom: 0;
		}
	}
</style>
