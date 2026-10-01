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
		onClear
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
	} = $props();

	// Closed beside a canvas of its own until a bron is chosen; the start is always open.
	let toggled = $state<boolean | null>(null);
	const open = $derived(start || (toggled ?? entries.length > 0));
	const onCount = $derived(entries.filter((e) => e.on).length);
</script>

<section class="netwerk" class:netwerk--start={start} aria-label="Netwerk">
	{#if start}
		<h2 class="start__title">Netwerk</h2>
		<!-- Ronde 5: drie stappen in beeld, met een woord elk. -->
		<ol class="r5-stappen">
			<li><Picto naam="zoek" size={22} /><span>Zoek een bron</span></li>
			<li><Picto naam="plus" size={22} /><span>Voeg er meer toe</span></li>
			<li><Picto naam="verbindt" size={22} /><span>Zie wat ze verbindt</span></li>
		</ol>
	{:else}
		<header class="head">
			<button
				type="button"
				class="head__toggle"
				aria-expanded={open}
				onclick={() => (toggled = !open)}
			>
				<span class="head__title">Netwerk</span>
				<span class="head__count">
					{#if loading}laden{:else if entries.length > 0}{onCount} van {entries.length} aan{:else}samenstellen{/if}
				</span>
				<Caret side {open} />
			</button>
		</header>
	{/if}

	{#if open}
		<Search compact placeholder="Bron toevoegen" {onPick} />

		{#if selection}
			<button
				type="button"
				class="add"
				aria-label="Voeg {selection.label} toe aan netwerk"
				onclick={onAdd}
			>
				+ <span class="add__label">{selection.label}</span>
			</button>
		{/if}

		{#if entries.length > 0}
			<ul class="list">
				{#each entries as e (e.id)}
					<li class="row" class:row--off={!e.on}>
						<input
							type="checkbox"
							id="netwerk-{e.id}"
							checked={e.on}
							disabled={e.missing}
							onchange={() => onToggle(e.id)}
							aria-label="{e.label} tonen"
						/>
						<KindGlyph collection={e.collection} size={11} />
						{#if e.missing}
							<span class="row__name" title={e.label}>{e.label}</span>
						{:else}
							<!-- A link, so that a bron opens in a new tab as well. -->
							<a
								class="row__name"
								href={bronHref(e.id)}
								title={e.label}
								data-sveltekit-noscroll
								data-sveltekit-keepfocus>{e.label}</a
							>
						{/if}
						{#if e.missing}
							<span class="row__note" title="Deze bron staat niet in het netwerk"
								>niet gevonden</span
							>
						{:else if e.alone}
							<span class="row__note" title="Geen verbinding met de andere gekozen bronnen gevonden"
								>los</span
							>
						{/if}
						<button
							type="button"
							class="row__remove"
							onclick={() => onRemove(e.id)}
							aria-label="Haal {e.label} uit netwerk">×</button
						>
					</li>
				{/each}
			</ul>

			<label class="switch">
				<input type="checkbox" id="netwerk-tussen" checked={tussen} onchange={onTussen} />
				<span>Tussenliggende bronnen</span>
				{#if tussen}<span class="switch__count">{joiningCount}</span>{/if}
			</label>

			<div class="actions">
				<button type="button" class="link" onclick={onClearContext}>Context wissen</button>
				<ConfirmButton
					label="Netwerk wissen"
					confirmLabel="Ja, netwerk wissen"
					onConfirm={onClear}
					buttonClass="link"
				/>
			</div>
		{/if}
	{/if}
</section>

<style>
	.r5-stappen {
		list-style: none;
		margin: var(--s-2) 0 var(--s-4);
		padding: 0;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--s-3);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	.r5-stappen li {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--s-2);
		text-align: center;
		color: var(--ink);
	}
	.r5-stappen span {
		color: var(--ink-2);
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

	.head__toggle {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		width: 100%;
		padding: 2px 0;
		border: 0;
		background: none;
		font: inherit;
		color: inherit;
		cursor: pointer;
		text-align: left;
	}
	.head__title {
		font-size: var(--t-label);
		font-weight: 500;
		color: var(--ink-3);
	}
	.head__count {
		margin-left: auto;
		font-size: var(--t-micro);
		color: var(--ink-3);
		font-variant-numeric: tabular-nums;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 1px;
	}
	.row {
		display: grid;
		grid-template-columns: auto auto minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 6px;
		padding: 2px 0;
	}
	.row input {
		margin: 0;
		accent-color: var(--ink);
	}
	.row__name {
		min-width: 0;
		text-decoration: none;
		padding: 0;
		border: 0;
		background: none;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
		text-align: left;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		cursor: pointer;
	}
	.row__name:hover {
		color: var(--accent);
	}
	.row--off .row__name {
		color: var(--ink-3);
	}
	.row__note {
		font-size: var(--t-label);
		color: var(--ink-3);
	}
	.row__remove {
		padding: 0 2px;
		border: 0;
		background: none;
		font-size: var(--t-body-2);
		line-height: 1;
		color: var(--ink-3);
		cursor: pointer;
	}
	.row__remove:hover {
		color: var(--accent);
	}

	.add {
		display: flex;
		gap: var(--s-1);
		min-width: 0;
		padding: var(--s-1) var(--s-2);
		border: 1px dashed var(--rule-strong);
		border-radius: var(--r-1);
		background: none;
		font: inherit;
		color: var(--ink-2);
		text-align: left;
		cursor: pointer;
	}
	.add:hover {
		background: var(--paper-2);
		color: var(--ink);
	}
	.add__label {
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.switch {
		display: flex;
		align-items: center;
		gap: 6px;
		padding-top: var(--s-2);
		border-top: 1px solid var(--rule);
		color: var(--ink-2);
		cursor: pointer;
	}
	.switch input {
		margin: 0;
		accent-color: var(--ink);
	}
	.switch__count {
		margin-left: auto;
		font-size: var(--t-micro);
		color: var(--ink-3);
		font-variant-numeric: tabular-nums;
	}

	.actions {
		display: flex;
		gap: var(--s-3);
	}
	/* Also the button inside ConfirmButton, a component of its own. */
	.actions :global(.link) {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		font-size: var(--t-micro);
		color: var(--ink-3);
		cursor: pointer;
	}
	.actions :global(.link:hover) {
		color: var(--accent);
	}
</style>
