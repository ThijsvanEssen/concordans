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
		<Picto naam="netwerk" size={13} />Netwerk
	</button>
	<button
		type="button"
		aria-pressed={stand === 'tekst'}
		disabled={!tekstMogelijk}
		onclick={() => onKies('tekst')}
		title={tekstMogelijk ? 'Tekst: lezen op volle breedte' : 'Deze bron heeft geen eigen tekst'}
	>
		<Picto naam="tekst" size={13} />Tekst
	</button>
</div>

<style>
	.ws {
		display: inline-flex;
		gap: var(--s-1);
	}
	button {
		display: inline-flex;
		align-items: center;
		gap: var(--s-1);
		padding: 2px var(--s-2);
		border: 0;
		border-bottom: 2px solid transparent;
		background: none;
		font: inherit;
		font-size: var(--t-micro);
		color: var(--ink-3);
		cursor: pointer;
	}
	button:hover:not(:disabled) {
		color: var(--ink);
	}
	button[aria-pressed='true'] {
		color: var(--ink);
		font-weight: 600;
		border-bottom-color: var(--ink);
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
</style>
