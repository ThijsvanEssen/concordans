<script lang="ts">
	// The notice of the first Bewaar of a session (F17): what was kept stays in this browser, and
	// the way to keep it elsewhere. A live region like Bevestiging, drawn once for the site; it
	// takes no focus (Bewaar keeps it), stays until Sluiten or Escape, and ends with Exporteer
	// or the way to Mijn markeringen.
	import { notice } from '$lib/bevestig/bevestig.svelte';
	import { kaart } from './map.svelte';
	import { mapFile, mapFileName } from './file';
	import { bundlePageHref } from './page';
	import { download } from '$lib/verbonden/export';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';

	const nu = $derived(notice.now);

	function exporteer() {
		download(mapFileName(kaart.mappen), mapFile(kaart.mappen), 'application/json');
		notice.close();
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (nu && e.key === 'Escape') notice.close();
	}}
/>

{#if nu}
	<div class="melding" role="status" aria-live="polite" aria-atomic="true">
		<p class="tekst">
			<strong>Bewaard in {nu.bundle}.</strong> Dit staat alleen in deze browser; exporteer om het te bewaren.
		</p>
		<span class="acties">
			<button type="button" class="btn" onclick={exporteer}>Exporteer</button>
			<TekstLink href={bundlePageHref(kaart.loose)} onclick={() => notice.close()}
				>Mijn markeringen</TekstLink
			>
		</span>
		<span class="sluit"
			><IconButton label="Sluiten" onclick={() => notice.close()}>×</IconButton></span
		>
	</div>
{/if}

<style>
	.melding {
		position: fixed;
		inset-inline: var(--s-4);
		bottom: calc(var(--s-4) + var(--tabbar-h));
		z-index: 50;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--s-3);
		width: fit-content;
		max-width: min(32rem, calc(100vw - 2 * var(--s-4)));
		margin-inline: auto;
		padding: var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		font-size: var(--t-ui);
		color: var(--ink);
	}
	.tekst {
		margin: 0;
	}
	.acties {
		grid-column: 1;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-3);
	}
	.sluit {
		grid-column: 2;
		grid-row: 1;
	}
</style>
