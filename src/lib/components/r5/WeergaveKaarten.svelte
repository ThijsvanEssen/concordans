<script lang="ts">
	// Ontwerpstudie ronde 5 (prototype): de eerste keer dat een bron opent, twee kaarten
	// onder de schakelaar (ronde 4, thema 6). Een kaart kiest de weergave; daarna niet meer.
	import Picto from './Picto.svelte';

	let { stand, onKies }: { stand: 'netwerk' | 'tekst'; onKies: (k: 'netwerk' | 'tekst') => void } =
		$props();

	const SLEUTEL = 'concordans:weergavekaarten';
	let open = $state(false);
	$effect(() => {
		try {
			open = localStorage.getItem(SLEUTEL) !== 'gezien';
		} catch {
			open = false;
		}
	});
	const sluit = () => {
		open = false;
		try {
			localStorage.setItem(SLEUTEL, 'gezien');
		} catch {
			/* geen opslag */
		}
	};
	const kies = (k: 'netwerk' | 'tekst') => {
		if (k !== stand) onKies(k);
		sluit();
	};
</script>

{#if open}
	<div class="kaarten" role="dialog" aria-label="Netwerk of tekst">
		<button type="button" class="kaart" class:aan={stand === 'netwerk'} onclick={() => kies('netwerk')}>
			<Picto naam="netwerk" size={28} />
			<b>Netwerk</b>
			<span>Een klik op een bron kiest die bron; het netwerk volgt.</span>
		</button>
		<button type="button" class="kaart" class:aan={stand === 'tekst'} onclick={() => kies('tekst')}>
			<Picto naam="tekst" size={28} />
			<b>Tekst</b>
			<span>De tekst op volle breedte. L wisselt terug.</span>
		</button>
		<button type="button" class="dicht" aria-label="Sluiten" onclick={sluit}>×</button>
	</div>
{/if}

<style>
	.kaarten {
		position: absolute;
		top: calc(100% + var(--s-2));
		right: 0;
		z-index: 3;
		display: grid;
		grid-template-columns: 1fr 1fr auto;
		gap: var(--s-2);
		width: 26rem;
		padding: var(--s-3);
		background: var(--paper);
		border: 1px solid var(--ink);
		border-radius: var(--r-2);
		box-shadow: var(--shadow-pop);
	}
	.kaart {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--s-1);
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
	.kaart:hover {
		border-color: var(--ink);
	}
	.kaart.aan {
		border-color: var(--ink);
		box-shadow: inset 0 0 0 1px var(--ink);
	}
	.kaart b {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-weight: 500;
		color: var(--ink);
	}
	.dicht {
		align-self: start;
		border: 0;
		background: none;
		font: inherit;
		color: var(--ink-3);
		cursor: pointer;
	}
	.dicht:hover {
		color: var(--ink);
	}
</style>
