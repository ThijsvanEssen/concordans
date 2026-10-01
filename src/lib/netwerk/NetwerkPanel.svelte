<script lang="ts">
	import ConfirmButton from '$lib/components/ui/ConfirmButton.svelte';
	import { bronHref } from '$lib/bron/href';
	// The netwerk of chosen bronnen, over the canvas: a search that adds a bron, the
	// selected bron added, each chosen one on or off, taken out, or opened, the bronnen
	// that join them shown or not, and the context around them cleared. On an empty
	// Verkenner it is the start of the page, in the middle of the canvas.
	import Caret from '$lib/components/ui/Caret.svelte';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import Search from '$lib/search/Search.svelte';
	import Picto from '$lib/components/r5/Picto.svelte';
	import type { NetwerkEntry } from './netwerk';

	let {
		entries,
		loading = false,
		selection = null,
		start = false,
		tussen,
		joiningCount,
		onPick,
		onToggle,
		onRemove,
		onAdd,
		onTussen,
		onClearContext,
		onClear,
		onVoorbeeld
	}: {
		entries: NetwerkEntry[];
		loading?: boolean;
		/** The selected bron when it is not chosen yet. */
		selection?: { label: string } | null;
		/** The canvas is empty: the panel is the start of the page. */
		start?: boolean;
		tussen: boolean;
		joiningCount: number;
		/** Adds a bron found by the search, by the name a link uses. */
		onPick: (id: string) => void;
		onToggle: (id: string) => void;
		onRemove: (id: string) => void;
		onAdd: () => void;
		onTussen: () => void;
		onClearContext: () => void;
		onClear: () => void;
		/** Ronde 5: een voorbeeldnetwerk met één klik. */
		onVoorbeeld?: () => void;
	} = $props();

	let zoeken = $state(false);
</script>

<section class="netwerk" class:netwerk--start={start} aria-label="Netwerk">
	{#if start}
		<h2 class="start__title">Netwerk</h2>
		<!-- Ronde 6: geen schets; drie stappen onder elkaar, elk met beeld, naam en één regel. -->
		<ol class="r6-stappen">
			<li>
				<span class="r6-beeld"><Picto naam="zoek" size={16} /></span>
				<span><b>Zoek een bron</b><br />Een wet, artikel, uitspraak of dossier.</span>
			</li>
			<li>
				<span class="r6-beeld"><Picto naam="plus" size={16} /></span>
				<span><b>Voeg er een toe</b><br />Met + bij een verbonden bron.</span>
			</li>
			<li>
				<span class="r6-beeld"><Picto naam="netwerk" size={16} /></span>
				<span><b>Zie wat ze verbindt</b><br />De bronnen ertussen staan op het canvas.</span>
			</li>
		</ol>
		{#if onVoorbeeld}
			<button type="button" class="r6-voorbeeld" onclick={onVoorbeeld}>
				<span class="r6-voorbeeld-kop">Voorbeeld</span>
				<span>Art. 3:2 en 3:4 Awb, en de uitspraken die beide aanhalen</span>
			</button>
		{/if}
	{:else}
		<!-- Ronde 5: de gekozen bronnen als labels op één regel; zoeken pas na "+ bron";
		     één regel voor wat ertussen ligt; wissen achter het menu. -->
		<div class="r5-kop">
			<span class="r5-titel">Netwerk</span>
			{#if loading}<span class="r5-laden">laden</span>{/if}
			<span class="r5-ruimte"></span>
			{#if entries.length > 0}
				<details class="r5-menu">
					<summary aria-label="Meer">⋯</summary>
					<div class="r5-menu-lijst">
						<button type="button" class="link" onclick={onClearContext}>Alleen de gekozen bronnen tonen</button>
						<ConfirmButton label="Netwerk wissen" confirmLabel="Ja, netwerk wissen" onConfirm={onClear} buttonClass="link" />
					</div>
				</details>
			{/if}
		</div>
		<ul class="r5-chips">
			{#each entries as e (e.id)}
				<li class="r5-chip" class:uit={!e.on} class:mist={e.missing}>
					<button
						type="button"
						class="r5-chip-naam"
						aria-pressed={e.on}
						disabled={e.missing}
						title={e.missing ? 'Niet gevonden' : e.on ? `${e.label}: verbergen` : `${e.label}: tonen`}
						onclick={() => onToggle(e.id)}><KindGlyph collection={e.collection} size={11} />{e.label}{#if e.alone}<span class="r5-los" title="Geen verbinding met de andere gekozen bronnen"> · los</span>{/if}</button
					>
					<button type="button" class="r5-chip-weg" onclick={() => onRemove(e.id)} aria-label="Haal {e.label} uit netwerk">×</button>
				</li>
			{/each}
			{#if selection}
				<li><button type="button" class="r5-chip r5-chip--voorstel" onclick={onAdd} aria-label="Voeg {selection.label} toe aan netwerk">+ {selection.label}</button></li>
			{/if}
			<li>
				{#if zoeken}
					<div class="r5-zoek"><Search compact placeholder="Bron toevoegen" onPick={(id) => {
						onPick(id);
						zoeken = false;
					}} /></div>
				{:else}
					<button type="button" class="r5-chip r5-chip--plus" onclick={() => (zoeken = true)}>+ bron</button>
				{/if}
			</li>
		</ul>
		{#if entries.length > 1}
			<label class="r5-tussen">
				<input type="checkbox" id="netwerk-tussen" checked={tussen} onchange={onTussen} />
				{#if tussen}<b>{joiningCount}</b> {joiningCount === 1 ? 'bron' : 'bronnen'} ertussen{:else}Bronnen ertussen tonen{/if}
			</label>
		{/if}
	{/if}
</section>

<style>
	.r5-kop {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
	}
	.r5-titel {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-weight: 500;
		color: var(--ink);
	}
	.r5-laden {
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.r5-ruimte {
		flex: 1;
	}
	.r5-menu {
		position: relative;
		font-size: var(--t-micro);
	}
	.r5-menu summary {
		list-style: none;
		cursor: pointer;
		padding: 0 var(--s-1);
		color: var(--ink-2);
	}
	.r5-menu summary::-webkit-details-marker {
		display: none;
	}
	.r5-menu-lijst {
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
	.r5-chips {
		list-style: none;
		margin: var(--s-2) 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1);
	}
	.r5-chip {
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--ink);
		border-radius: 999px;
		background: var(--paper);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink);
	}
	.r5-chip-naam {
		display: inline-flex;
		align-items: center;
		gap: var(--s-1);
		max-width: 16rem;
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
	.r5-chip-weg {
		padding: 0 var(--s-2) 0 var(--s-1);
		border: 0;
		background: none;
		font: inherit;
		color: var(--ink-3);
		cursor: pointer;
	}
	.r5-chip-weg:hover {
		color: var(--ink);
	}
	.r5-chip.uit {
		border-style: dashed;
		color: var(--ink-3);
	}
	.r5-chip.mist {
		border-color: var(--rule-strong);
		color: var(--ink-3);
	}
	.r5-los {
		color: var(--ink-3);
	}
	.r5-chip--voorstel,
	.r5-chip--plus {
		padding: var(--s-1) var(--s-2);
		border-style: dashed;
		border-color: var(--rule-strong);
		color: var(--ink-2);
		cursor: pointer;
	}
	.r5-chip--plus:hover,
	.r5-chip--voorstel:hover {
		border-color: var(--ink);
		color: var(--ink);
	}
	.r5-zoek {
		min-width: 14rem;
	}
	.r5-tussen {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		margin-top: var(--s-2);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-2);
		cursor: pointer;
	}
	.r5-tussen input {
		accent-color: var(--ink);
	}
	.r5-tussen b {
		color: var(--ink);
		font-weight: 600;
	}
	.r6-stappen {
		list-style: none;
		margin: var(--s-3) 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		line-height: 1.4;
		color: var(--ink-2);
	}
	.r6-stappen li {
		display: grid;
		grid-template-columns: 32px 1fr;
		gap: var(--s-3);
		align-items: start;
	}
	.r6-stappen b {
		font-weight: 500;
		color: var(--ink);
	}
	.r6-beeld {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border: 1px solid var(--rule-strong);
		border-radius: 50%;
		color: var(--ink);
	}
	.r6-voorbeeld {
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
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		line-height: 1.4;
		color: var(--ink-2);
		text-align: left;
		cursor: pointer;
	}
	.r6-voorbeeld:hover {
		border-color: var(--ink);
		color: var(--ink);
	}
	.r6-voorbeeld-kop {
		font-weight: 500;
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
		font-family: var(--font-sans);
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
		font-weight: 500;
	}




	/* Also the button inside ConfirmButton, a component of its own. */
</style>
