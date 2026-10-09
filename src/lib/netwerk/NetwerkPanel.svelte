<script lang="ts">
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	// The netwerk of chosen bronnen, over the canvas: a search that adds a bron, the
	// selected bron added, each chosen one on or off, taken out, or opened, the bronnen
	// that join them shown or not, and the context around them cleared. On an empty
	// Verkenner it is the start of the page, in the middle of the canvas.
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import Search from '$lib/search/Search.svelte';
	import Caret from '$lib/components/ui/Caret.svelte';
	import { laatstOpen } from '$lib/stores/zwevend';
	import type { NetwerkEntry } from './netwerk';
	import { formatCount } from '$lib/verbonden/filter';

	let {
		entries,
		loading = false,
		selection = null,
		start = false,
		tussen,
		joiningCount,
		deels = false,
		onPick,
		onToggle,
		onRemove,
		onGroepAan,
		onAdd,
		onTussen,
		onClearContext,
		onClear,
		onVoorbeeld,
		telefoon = false,
		deelLabel = 'Deel',
		deelMelding = '',
		onDeel,
		omgeving = null,
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
		/** Deel: the address of this view, the netwerk and its filters in it ("Gekopieerd" once copied). */
		deelLabel?: string;
		/** Read out once copied. */
		deelMelding?: string;
		onDeel?: () => void;
		/** The selected bron whose surroundings alone the line below shows (O; Thijs, 10 Oct). */
		omgeving?: string | null;
		onOmgeving?: () => void;
		/** The API ran out of time looking for paths: these are the ones it found (`partial`). */
		deels?: boolean;
		/** Adds a bron found by the search, by the name a link uses. */
		onPick: (id: string) => void;
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
		/** A phone: the panel starts folded, as it covers the canvas there. */
		telefoon?: boolean;
	} = $props();

	// Folded to its head, like the legend; per browser remembered. Without a choice it is
	// open, on a phone folded.
	const PANEEL = 'concordans:netwerkpaneel';
	let open = $state(true);
	$effect(() => {
		try {
			const v = localStorage.getItem(PANEEL);
			open = v ? v === 'open' : !telefoon;
		} catch {
			open = !telefoon;
		}
	});
	const zetOpen = (v: boolean) => {
		open = v;
		if (v) laatstOpen.set('netwerk');
		try {
			localStorage.setItem(PANEEL, v ? 'open' : 'dicht');
		} catch {
			/* geen opslag */
		}
	};

	// On a phone, the legend opened folds this panel: there is room for one.
	$effect(() =>
		laatstOpen.subscribe((wie) => {
			if (telefoon && wie === 'legenda' && open) open = false;
		})
	);

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

	/** A grouping by its name in the legend. */
	const GROEP = {
		instrument: 'Wet',
		faction: 'Fractie',
		committee: 'Commissie',
		dossier: 'Dossier'
	} as const;
</script>

<section
	class="netwerk"
	class:netwerk--start={start}
	class:netwerk--dicht={!start && !open}
	aria-label="Netwerk"
>
	{#if start}
		<h2 class="start__title">Netwerk</h2>
		<!-- The field itself, not steps that explain it (Thijs, 9 Oct: "de UI moet zichzelf
		     wijzen"). -->
		<div class="zoek zoek--start">
			<Search compact placeholder="Bron toevoegen" {onPick} />
		</div>
		{#if onVoorbeeld}
			<button type="button" class="voorbeeld" onclick={onVoorbeeld}>
				<span class="voorbeeld-kop">Voorbeeld</span>
				<span>Art. 3:2 en 3:4 Awb, en de uitspraken die beide aanhalen</span>
			</button>
		{/if}
	{:else}
		<!-- De gekozen bronnen als labels op één regel; zoeken pas na "+ bron";
		     één regel voor wat ertussen ligt. Wissen is één klik, en Terug zet het terug. -->
		<div class="kop">
			<button type="button" class="kop-knop" aria-expanded={open} onclick={() => zetOpen(!open)}>
				<span class="titel">Netwerk</span>
				{#if loading}<span class="laden">laden</span>{:else if !open && entries.length > 0}<span
						class="aantal">{entries.length} {entries.length === 1 ? 'bron' : 'bronnen'}</span
					>{/if}
				<Caret {open} />
			</button>
			<span class="ruimte"></span>
			<!-- Deel moved here from the status bar (Thijs, 10 Oct): what it gives beyond the
			     bron's own address is this netwerk. -->
			{#if onDeel}
				<button type="button" class="wis" onclick={onDeel}>{deelLabel}</button>
				<span class="sr-only" aria-live="polite">{deelMelding}</span>
			{/if}
			{#if open && entries.length > 0}
				<button
					type="button"
					class="wis"
					onclick={onClear}
					title="Leeg het netwerk en het canvas; Terug zet het terug">Wissen</button
				>
				<details class="menu">
					<summary aria-label="Meer">⋯</summary>
					<div class="menu-lijst">
						<button type="button" class="link" onclick={onClearContext}
							>Alleen de gekozen bronnen tonen</button
						>
					</div>
				</details>
			{/if}
		</div>
		{#if open}
			<ul class="chips">
				{#each getoond as e (e.id)}
					<li class="chip" class:uit={!e.on} class:mist={e.missing} class:gedimd={!!e.verborgenMet}>
						<button
							type="button"
							class="chip-naam"
							aria-pressed={e.on}
							disabled={e.missing}
							title={e.missing
								? 'Niet gevonden'
								: e.verborgenMet
									? `Aan met ${GROEP[e.verborgenMet]}`
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
				<li>
					{#if zoeken}
						<div class="zoek">
							<Search
								compact
								placeholder="Bron toevoegen"
								onPick={(id) => {
									onPick(id);
									zoeken = false;
								}}
							/>
						</div>
					{:else}
						<button type="button" class="chip chip--plus" onclick={() => (zoeken = true)}
							>+ bron</button
						>
					{/if}
				</li>
			</ul>
			{#if omgeving && onOmgeving}
				<button type="button" class="omgeving-knop" onclick={onOmgeving}
					><span class="omgeving-knop__naam">Alleen de omgeving van {omgeving}</span><kbd>O</kbd
					></button
				>
			{/if}
			{#if entries.length > 1}
				<label class="tussen">
					<input type="checkbox" id="netwerk-tussen" checked={tussen} onchange={onTussen} />
					{#if tussen}<b>{joiningCount}</b>
						{joiningCount === 1 ? 'bron' : 'bronnen'} ertussen{:else}Toon de bronnen ertussen{/if}
				</label>
				{#if tussen && deels}
					<p class="deels">Niet alle paden gevonden; de zoektocht duurde te lang.</p>
				{/if}
			{/if}
		{/if}
	{/if}
</section>

<style>
	/* Only the surroundings of the selected bron: a line, as Toon de bronnen ertussen. */
	.omgeving-knop {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		margin-top: var(--s-2);
		padding: 0;
		border: 0;
		background: none;
		font-family: var(--font-ui);
		font-size: var(--t-ui-micro);
		color: var(--ink-2);
		text-align: left;
		cursor: pointer;
	}
	.omgeving-knop__naam {
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.omgeving-knop {
		max-width: 100%;
	}
	.omgeving-knop:hover {
		color: var(--ink);
		text-decoration: underline;
	}
	.omgeving-knop kbd {
		padding: 0 var(--s-1);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		font-size: var(--t-ui-micro);
		color: var(--ink-3);
	}
	/* A key says nothing without a keyboard. */
	@media (hover: none) {
		.omgeving-knop kbd {
			display: none;
		}
	}
	.deels {
		margin: var(--s-1) 0 0;
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.kop {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
	}
	.kop-knop {
		display: inline-flex;
		align-items: baseline;
		gap: var(--s-2);
		padding: 0;
		border: 0;
		background: none;
		font-family: var(--font-ui);
		font-size: var(--t-ui-micro);
		color: var(--ink-2);
		cursor: pointer;
	}
	.kop-knop:hover {
		color: var(--ink);
	}
	.aantal {
		color: var(--ink-2);
	}
	.titel {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-weight: 600;
		color: var(--ink);
	}
	.laden {
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.ruimte {
		flex: 1;
	}
	.wis {
		padding: 0;
		border: 0;
		background: none;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-2);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
		cursor: pointer;
	}
	.wis:hover {
		color: var(--ink);
	}
	.menu {
		position: relative;
		font-size: var(--t-micro);
	}
	.menu summary {
		list-style: none;
		cursor: pointer;
		padding: 0 var(--s-1);
		color: var(--ink-2);
	}
	.menu summary::-webkit-details-marker {
		display: none;
	}
	.menu-lijst {
		position: absolute;
		right: 0;
		top: 100%;
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--s-2);
		padding: var(--s-3);
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		box-shadow: var(--shadow-pop);
		white-space: nowrap;
	}
	.chips {
		list-style: none;
		margin: var(--s-2) 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1);
	}
	.chip {
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--ink);
		border-radius: 999px;
		background: var(--paper);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
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
		gap: var(--s-1);
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		padding: var(--s-1) var(--s-1) var(--s-1) var(--s-2);
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
	.chip.gedimd {
		color: var(--ink-3);
		border-color: var(--rule-strong);
	}
	.chip.gedimd :global(svg) {
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
		min-width: 14rem;
	}
	.tussen {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		margin-top: var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-2);
		cursor: pointer;
	}
	.tussen input {
		accent-color: var(--ink);
	}
	.tussen b {
		color: var(--ink);
		font-weight: 600;
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
	.netwerk {
		position: absolute;
		top: var(--s-3);
		right: var(--s-3);
		z-index: var(--z-float);
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink);
		width: 280px;
		max-width: calc(100% - 2 * var(--s-3));
		max-height: calc(100% - 2 * var(--s-3));
		overflow-y: auto;
		padding: var(--s-2) var(--s-3) var(--s-3);
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--s-2);
		align-content: start;
	}

	.netwerk--dicht {
		width: auto;
		padding-bottom: var(--s-2);
	}
	.netwerk--start {
		top: 18%;
		left: 50%;
		right: auto;
		transform: translateX(-50%);
		width: min(440px, calc(100% - 2 * var(--s-3)));
		max-width: none;
		padding: var(--s-5);
		gap: var(--s-3);
	}
	.start__title {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 600;
	}

	/* Also the button inside ConfirmButton, a component of its own. */
</style>
