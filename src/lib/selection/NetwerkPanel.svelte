<script lang="ts">
	import { count } from '$lib/text/words';
	import FilterOptie from '$lib/components/ui/FilterOptie.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import CanvasKaart from '$lib/components/graph/CanvasKaart.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	// The netwerk of chosen bronnen, in the strip at the left of the werkplek: a search that adds a bron, the
	// selected bron added, each chosen one on or off, taken out, or opened, the bronnen
	// that join them shown or not, and the context around them cleared. On an empty
	// Verkenner it is the start of the page, in the middle of the canvas.
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import Search from '$lib/search/Search.svelte';
	import { GROUP_LABEL } from '$lib/graph/collection-role';
	import type { NetwerkEntry } from './netwerk';
	import { formatCount } from '$lib/text/getal';

	let {
		entries,
		loading = false,
		selection = null,
		start = false,
		tussen,
		joiningCount,
		deels = false,
		onSelect,
		onToggle,
		onRemove,
		onGroepAan,
		onAdd,
		onTussen,
		onClearContext,
		onClear,
		onVoorbeeld,
		telefoon = false,
		omgeving = null,
		aroundOn = false,
		onOmgeving
	}: {
		entries: NetwerkEntry[];
		loading?: boolean;
		/** The selected bron when it is not chosen yet. */
		selection?: { label: string } | null;
		/** The canvas is empty: the panel is the start of the page. */
		start?: boolean;
		tussen: boolean;
		joiningCount: number;
		/** The selected bron whose surroundings alone the line below shows (O; Thijs, 10 Oct). */
		omgeving?: string | null;
		/** The filter Alleen verbonden bronnen is on. */
		aroundOn?: boolean;
		onOmgeving?: () => void;
		/** The API ran out of time looking for paths: these are the ones it found (`partial`). */
		deels?: boolean;
		/** Adds a bron found by the search, by the name a link uses. */
		onSelect: (id: string) => void;
		onToggle: (id: string) => void;
		onRemove: (id: string) => void;
		/** A chip greyed with its grouping: switch that grouping on again. */
		onGroepAan?: (kind: NonNullable<NetwerkEntry['verborgenMet']>) => void;
		onAdd: () => void;
		onTussen: () => void;
		onClearContext: () => void;
		onClear: () => void;
		/** Een voorbeeldnetwerk met één klik. */
		onVoorbeeld?: () => void;
		/** A phone: the chosen bronnen on one line that scrolls, the field behind Bron toevoegen. */
		telefoon?: boolean;
	} = $props();

	let zoeken = $state(false);

	// A long netwerk (the start page's band opens with fifteen) folds after a few, so it
	// does not cover the canvas.
	const KORT = 5;
	let alles = $state(false);
	const gevouwen = $derived(!alles && entries.length > KORT + 1);
	const getoond = $derived(gevouwen ? entries.slice(0, KORT) : entries);

	/** What a group's members are called: a wet's artikelen, a fractie's leden. */
	const ledenVan = (c: NetwerkEntry['collection']) =>
		c === 'instruments'
			? 'artikelen'
			: c === 'dossiers'
				? 'stukken'
				: c === 'cabinets'
					? 'bewindspersonen'
					: 'leden';
</script>

{#if start}
	<section class="netwerk netwerk--start" aria-label="Netwerk">
		<h2 class="start__title">Netwerk</h2>
		<!-- The field itself, not steps that explain it (Thijs, 9 Oct: "de UI moet zichzelf
		     wijzen"). -->
		<div class="zoek zoek--start">
			<Search compact placeholder="Bron toevoegen" {onSelect} />
		</div>
		{#if onVoorbeeld}
			<button type="button" class="voorbeeld" onclick={onVoorbeeld}>
				<span class="voorbeeld-kop">Voorbeeld</span>
				<span>Art. 3:2 en 3:4 Awb, en de uitspraken die beide aanhalen</span>
			</button>
		{/if}
	</section>
{:else}
	<!-- De gekozen bronnen als labels op één regel; zoeken pas na "Bron toevoegen";
	     één regel voor wat ertussen ligt. Wissen is één klik, en Terug zet het terug. -->
	<!-- Bronnen, the first block of the strip at the left (mockup A197-b). -->
	<CanvasKaart title="Bronnen" label="Netwerk" class="netwerk">
		{#snippet samenvatting()}
			{#if loading}<span class="laden punt" role="status" aria-label="Laden" title="Laden"
				></span>{/if}
		{/snippet}
		{#snippet actie()}
			{#if entries.length > 0 && !telefoon}
				<TekstLink onclick={onClear} title="Leeg het netwerk en het canvas; Terug zet het terug"
					>Wissen</TekstLink
				>
				<!-- One more action, in the one menu of the site (TekstMenu), not a menu of its own. -->
				<TekstMenu rechts label="Meer" tekst="Meer">
					{#snippet onder(sluit)}
						<button
							type="button"
							role="menuitem"
							class="tekstmenu__item"
							onclick={() => {
								sluit();
								onClearContext();
							}}>Alleen de gekozen bronnen tonen</button
						>
					{/snippet}
				</TekstMenu>
			{/if}
		{/snippet}
		<ul class="chips" data-zijscroll>
			{#each getoond as e (e.id)}
				<li class="chip" class:uit={!e.on} class:mist={e.missing} class:is-dim={!!e.verborgenMet}>
					<button
						type="button"
						class="chip-naam"
						aria-pressed={e.on}
						disabled={e.missing}
						title={e.missing
							? 'Niet gevonden'
							: e.verborgenMet
								? `Aan met ${GROUP_LABEL[e.verborgenMet]}`
								: e.on
									? `${e.titel ?? e.label}: verbergen`
									: `${e.titel ?? e.label}: tonen`}
						onclick={() => (e.verborgenMet ? onGroepAan?.(e.verborgenMet) : onToggle(e.id))}
						><KindGlyph collection={e.collection} size={11} /><span
							>{e.label}{#if e.alone}<span
									class="los"
									title="Geen verbinding met de andere gekozen bronnen">, zonder verbinding</span
								>{:else if e.via}<span
									class="los"
									title="De verbindingen lopen via de eerste {formatCount(e.via.used)} {ledenVan(
										e.collection
									)}"
									>, via {formatCount(e.via.used)} van {formatCount(e.via.total)}
									{ledenVan(e.collection)}</span
								>{/if}</span
						></button
					>
					<button
						type="button"
						class="chip-weg"
						onclick={() => onRemove(e.id)}
						aria-label="Haal {e.label} uit netwerk">×</button
					>
				</li>
			{/each}
			{#if gevouwen}
				<li class="verder">
					<TekstLink onclick={() => (alles = true)}>en {entries.length - KORT} andere</TekstLink>
				</li>
			{:else if entries.length > KORT + 1}
				<li class="verder">
					<TekstLink onclick={() => (alles = false)}>minder</TekstLink>
				</li>
			{/if}
			{#if selection}
				<li>
					<button
						type="button"
						class="chip chip--voorstel"
						onclick={onAdd}
						aria-label="Voeg {selection.label} toe aan netwerk">+ {selection.label}</button
					>
				</li>
			{/if}
			{#if telefoon && !zoeken}
				<li>
					<button type="button" class="chip chip--plus" onclick={() => (zoeken = true)}
						>Bron toevoegen</button
					>
				</li>
			{/if}
		</ul>
		{#if !telefoon || zoeken}
			<!-- The field itself (mockup A197-b); on a phone behind Bron toevoegen. -->
			<div class="zoek">
				<Search
					compact
					placeholder="Bron toevoegen"
					onSelect={(id) => {
						onSelect(id);
						zoeken = false;
					}}
				/>
			</div>
		{/if}
		{#if (omgeving || aroundOn) && onOmgeving}
			<!-- A filter, on and off; the chosen bronnen stay. The bron's name and the key on hover. -->
			<p class="omgeving">
				<FilterOptie
					inline
					on={aroundOn}
					onToggle={onOmgeving}
					label="Alleen verbonden bronnen"
					title={omgeving
						? `Alleen ${omgeving} met verbonden bronnen (toets O)`
						: 'Alleen verbonden bronnen (toets O)'}
				/>
			</p>
		{/if}
		{#if entries.length > 1}
			<p class="tussen">
				<FilterOptie
					inline
					on={tussen}
					onToggle={onTussen}
					label={tussen
						? `${count(joiningCount, 'bron', 'bronnen')} ertussen`
						: 'Toon de bronnen ertussen'}
				/>
			</p>
			{#if tussen && deels}
				<p class="deels">Niet alle verbindingen gevonden: het zoeken duurde te lang.</p>
			{/if}
		{/if}
		{#if telefoon && entries.length > 0}
			<!-- On a phone under Filter, with the netwerk's own filters (GraphView). -->
			<p class="netwerk-acties">
				<TekstLink onclick={onClear} title="Leeg het netwerk en het canvas; Terug zet het terug"
					>Wissen</TekstLink
				>
				<TekstLink onclick={onClearContext}>Alleen de gekozen bronnen tonen</TekstLink>
			</p>
		{/if}
	</CanvasKaart>
{/if}

<style>
	/* An empty network: the field in the middle of the canvas, a card of its own. */
	.netwerk--start {
		position: absolute;
		top: 18%;
		left: 50%;
		z-index: var(--z-float);
		transform: translateX(-50%);
		box-sizing: border-box;
		width: min(440px, calc(100% - 2 * var(--s-3)));
		display: grid;
		gap: var(--s-3);
		padding: var(--s-5);
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink);
	}
	/* One quiet line under the chips, in the text's letter. */
	.omgeving {
		margin: var(--s-2) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
	}
	.netwerk-acties {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2) var(--s-4);
		margin: var(--s-3) 0 0;
	}
	.deels {
		margin: var(--s-1) 0 0;
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.laden {
		flex: none;
		white-space: nowrap;
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* Open, the head has no room for a word beside the actions: a dot of its own, no shift. */
	.laden.punt {
		width: var(--s-2);
		height: var(--s-2);
		border-radius: var(--r-rond);
		background: var(--ink-3);
		animation: laden-puls 1s ease-in-out infinite alternate;
	}
	@keyframes laden-puls {
		from {
			opacity: 0.25;
		}
		to {
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.laden.punt {
			animation: none;
		}
	}
	.chips {
		list-style: none;
		margin: 0 0 var(--s-2);
		padding: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--s-2);
	}
	.chip {
		display: inline-flex;
		align-items: center;
		min-height: var(--veld-h);
		box-sizing: border-box;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-rond);
		background: var(--paper);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink);
	}
	.chips > li {
		max-width: 100%;
		min-width: 0;
	}
	.chip--voorstel {
		display: inline-block;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.chip-naam {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		padding: 0 var(--s-1) 0 var(--s-3);
		border: 0;
		background: none;
		font: inherit;
		color: inherit;
		cursor: pointer;
	}
	.chip-weg {
		padding: 0 var(--s-2) 0 var(--s-1);
		border: 0;
		background: none;
		font: inherit;
		color: var(--ink-3);
		cursor: pointer;
	}
	.chip-weg:hover {
		color: var(--ink);
	}
	.chip.is-dim {
		color: var(--ink-3);
		border-color: var(--rule-strong);
	}
	.chip.is-dim :global(svg) {
		opacity: 0.5;
	}
	.chip.uit {
		border-style: dashed;
		color: var(--ink-3);
	}
	.chip.mist {
		border-color: var(--rule-strong);
		color: var(--ink-3);
	}
	.los {
		color: var(--ink-3);
	}
	.chip--voorstel,
	.chip--plus {
		padding: var(--s-1) var(--s-2);
		border-style: dashed;
		border-color: var(--rule-strong);
		color: var(--ink-2);
		cursor: pointer;
	}
	.chip--plus:hover,
	.chip--voorstel:hover {
		border-color: var(--ink);
		color: var(--ink);
	}
	.verder {
		align-self: center;
		font-size: var(--t-micro);
	}
	.zoek {
		width: 100%;
	}
	.tussen {
		margin: var(--s-2) 0 0;
	}
	.zoek--start {
		margin-top: var(--s-3);
	}
	.voorbeeld {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--s-1);
		width: 100%;
		margin-top: var(--s-4);
		padding: var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		background: var(--paper);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		line-height: 1.4;
		color: var(--ink-2);
		text-align: left;
		cursor: pointer;
	}
	.voorbeeld:hover {
		border-color: var(--ink);
		color: var(--ink);
	}
	.voorbeeld-kop {
		font-weight: 600;
		color: var(--ink);
	}

	.start__title {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 600;
	}
	/* A phone: the chosen bronnen on one line that scrolls, as the mockup's 390. */
	@media (max-width: 768px) {
		.chips {
			flex-direction: row;
			flex-wrap: nowrap;
			overflow-x: auto;
		}
		.chips > li {
			flex: none;
		}
	}
	@media (pointer: coarse), (max-width: 768px) {
		.chip {
			min-height: var(--veld-h-raak);
		}
	}
</style>
