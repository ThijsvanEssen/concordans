<script lang="ts">
	// Ontwerpstudie ronde 5 (prototype): wisselen tussen netwerk en tekst. Klein, twee
	// knoppen met een beeld en één woord; de gekozen stand onderstreept in inkt. Toets L.
	import Picto from './Picto.svelte';

	let {
		stand,
		onKies,
		tekstMogelijk = true
	}: {
		stand: 'netwerk' | 'tekst';
		onKies: (s: 'netwerk' | 'tekst') => void;
		/** Een bron zonder eigen tekst: de lezer staat al naast het netwerk. */
		tekstMogelijk?: boolean;
	} = $props();
</script>

<div class="ws" role="group" aria-label="Weergave (toets L)">
	<button type="button" aria-pressed={stand === 'netwerk'} onclick={() => onKies('netwerk')} title="Netwerk: de verbindingen">
		<Picto naam="netwerk" size={15} />Netwerk
	</button>
	<button
		type="button"
		aria-pressed={stand === 'tekst'}
		disabled={!tekstMogelijk}
		onclick={() => onKies('tekst')}
		title={tekstMogelijk ? 'Tekst: lezen op volle breedte' : 'Deze bron heeft geen eigen tekst'}
	>
		<Picto naam="tekst" size={15} />Tekst
	</button>
</div>

<style>
	/* Een kleine knoppenrij: de gekozen stand gevuld in inkt, de andere als knop met rand. */
	.ws {
		display: inline-flex;
		border: 1px solid var(--ink);
		border-radius: var(--r-1);
		overflow: hidden;
	}
	button {
		display: inline-flex;
		align-items: center;
		gap: var(--s-1);
		padding: 3px var(--s-2);
		border: 0;
		background: var(--paper);
		font: inherit;
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink);
		cursor: pointer;
	}
	button + button {
		border-left: 1px solid var(--ink);
	}
	button:hover:not(:disabled):not([aria-pressed='true']) {
		background: var(--paper-2);
	}
	button[aria-pressed='true'] {
		background: var(--ink);
		color: var(--paper);
		cursor: default;
	}
	button:disabled {
		color: var(--ink-3);
		cursor: default;
	}
	button:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}
</style>
