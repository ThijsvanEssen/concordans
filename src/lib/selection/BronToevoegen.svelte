<script lang="ts">
	// Bron toevoegen: the one search of the site (Search, as a picker) in a dialog, on every
	// width and the whole screen on a phone. Enter or a click adds the bron and leaves the
	// dialog open for the next; Esc closes it and gives the focus back to where it was. A bron
	// already chosen says so on its row.
	import { onMount } from 'svelte';
	import Search from '$lib/search/Search.svelte';
	import Keuze from '$lib/components/ui/Keuze.svelte';
	import type { SearchKind } from '$lib/search/lanes';

	let {
		chosen,
		onSelect,
		onClose
	}: {
		/** The bronnen of the netwerk, by the name a link uses. */
		chosen: readonly string[];
		onSelect: (id: string) => void;
		onClose: () => void;
	} = $props();

	const FILTERS = [
		{ waarde: 'alle', label: 'Alle', kinds: null },
		{ waarde: 'wetten', label: 'Wetten', kinds: ['instruments'] },
		{ waarde: 'artikelen', label: 'Artikelen', kinds: ['articles'] },
		{ waarde: 'uitspraken', label: 'Uitspraken', kinds: ['judgments'] },
		{ waarde: 'dossiers', label: 'Dossiers', kinds: ['dossiers'] }
	] as const satisfies readonly {
		waarde: string;
		label: string;
		kinds: readonly SearchKind[] | null;
	}[];
	type Filter = (typeof FILTERS)[number]['waarde'];

	let filter = $state<Filter>('alle');
	const scope = $derived(FILTERS.find((f) => f.waarde === filter)?.kinds ?? null);

	let dialog = $state<HTMLDialogElement | null>(null);

	// The focus back where it was, held before the dialog takes it.
	onMount(() => {
		const back = document.activeElement as HTMLElement | null;
		dialog?.showModal();
		// The field mounted before the dialog was open and could not take the focus.
		dialog?.querySelector<HTMLInputElement>('[data-search-field]')?.focus();
		return () => {
			dialog?.close();
			queueMicrotask(() => back?.isConnected && back.focus());
		};
	});

	function pick(id: string) {
		if (!chosen.includes(id)) onSelect(id);
	}
</script>

<dialog
	bind:this={dialog}
	class="toevoegen"
	aria-label="Bron toevoegen aan het netwerk"
	oncancel={(e) => {
		e.preventDefault();
		onClose();
	}}
	onclick={(e) => e.target === e.currentTarget && onClose()}
>
	<div class="toevoegen__kader">
		<div class="toevoegen__kop">
			<span class="toevoegen__titel">Bron toevoegen</span>
			<button type="button" class="btn is-text" onclick={onClose}>Sluiten</button>
		</div>
		<Search
			overlay
			picker
			placeholder="Zoek een wet, uitspraak of dossier"
			{scope}
			{chosen}
			onSelect={pick}
		>
			{#snippet belowField()}
				<div class="toevoegen__filters" data-zijscroll>
					<Keuze
						label="Soort bron"
						waarde={filter}
						opties={FILTERS.map((f) => ({ waarde: f.waarde, label: f.label }))}
						onSelect={(w) => (filter = w)}
					/>
				</div>
			{/snippet}
		</Search>
		<div class="toevoegen__toetsen" aria-hidden="true">
			<span><kbd>↑</kbd> <kbd>↓</kbd> kiezen</span>
			<span><kbd>Enter</kbd> toevoegen</span>
			<span><kbd>Esc</kbd> sluiten</span>
		</div>
	</div>
</dialog>

<style>
	.toevoegen {
		box-sizing: border-box;
		width: 480px;
		max-width: calc(100% - var(--s-6));
		max-height: calc(100dvh - 160px);
		margin: 96px auto 0;
		padding: 0;
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
		background: var(--paper);
		color: var(--ink);
		box-shadow: var(--shadow-modal);
		overflow: hidden;
	}
	.toevoegen[open] {
		display: flex;
	}
	.toevoegen::backdrop {
		background: var(--scherm);
	}
	.toevoegen__kader {
		display: flex;
		flex-direction: column;
		width: 100%;
		min-height: 0;
	}
	.toevoegen__kop {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-3);
		padding: var(--s-3) var(--s-4) 0;
	}
	.toevoegen__titel {
		font-size: var(--t-body-2);
		font-weight: 600;
	}
	.toevoegen__filters {
		overflow-x: auto;
		padding: var(--s-2) var(--s-4);
		border-bottom: 1px solid var(--rule);
	}
	.toevoegen__toetsen {
		display: flex;
		gap: var(--s-4);
		padding: var(--s-2) var(--s-4);
		border-top: 1px solid var(--rule);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	kbd {
		font-family: var(--font-ui);
		font-size: var(--t-label);
		padding: 0 var(--s-1);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
	}
	/* A phone: the whole screen; no keys to name on a touch screen. */
	@media (max-width: 640px) {
		.toevoegen {
			width: 100%;
			max-width: none;
			height: 100dvh;
			max-height: none;
			margin: 0;
			border: 0;
			border-radius: 0;
		}
	}
	@media (pointer: coarse), (max-width: 768px) {
		.toevoegen__toetsen {
			display: none;
		}
	}
</style>
