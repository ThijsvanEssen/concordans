<script lang="ts">
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import KeyList from '$lib/components/ui/KeyList.svelte';
	import KeyRow from '$lib/components/ui/KeyRow.svelte';
</script>

<RouteKop />

<div class="page-wrap">
	<div class="container blad blad--tekst">
		<nav class="stub-eyebrow" aria-label="Hoort bij"><a href="/docs">Documentatie</a></nav>
		<header class="blad__kop"><h1 class="blad__titel">Sneltoetsen</h1></header>
		<KeyList>
			<KeyRow
				>{#snippet key()}<kbd>⌘</kbd><kbd>K</kbd> of <kbd>Ctrl</kbd><kbd>K</kbd
					>{/snippet}Zoeken</KeyRow
			>
			<KeyRow
				>{#snippet key()}<kbd>↑</kbd> <kbd>↓</kbd> <kbd>Enter</kbd>{/snippet}Door de zoekresultaten;
				Enter opent er een</KeyRow
			>
			<KeyRow>{#snippet key()}<kbd>Esc</kbd>{/snippet}Zoekveld wissen, of zoeken sluiten</KeyRow>
			<KeyRow>{#snippet key()}<kbd>L</kbd>{/snippet}Bij een bron: tekst of netwerk</KeyRow>
			<KeyRow
				>{#snippet key()}<kbd>1</kbd> <kbd>2</kbd>{/snippet}Bij een bron: Tekst of Verbonden</KeyRow
			>
			<KeyRow>{#snippet key()}<kbd>O</kbd>{/snippet}In het netwerk: alleen verbonden bronnen</KeyRow
			>
			<KeyRow
				>{#snippet key()}<kbd>J</kbd> <kbd>K</kbd> <kbd>Enter</kbd>{/snippet}Volgende of vorige rij
				onder Bronnen en in Verbonden; Enter opent haar</KeyRow
			>
			<KeyRow
				>{#snippet key()}<kbd>←</kbd> <kbd>→</kbd>{/snippet}Terug of vooruit naar de vorige bron,
				als het netwerk de focus heeft</KeyRow
			>
			<KeyRow
				>{#snippet key()}<kbd>↑</kbd> <kbd>↓</kbd> <kbd>Home</kbd> <kbd>End</kbd>{/snippet}Door de
				bronnen in de lijst van het netwerk</KeyRow
			>
			<KeyRow
				>{#snippet key()}<kbd>N</kbd>{/snippet}De bron in die lijst aan het netwerk toevoegen of
				eruit halen</KeyRow
			>
			<KeyRow
				>{#snippet key()}<kbd>←</kbd> <kbd>→</kbd>{/snippet}Vorige of volgende wijziging, bij
				Vergelijken</KeyRow
			>
			<KeyRow
				>{#snippet key()}<kbd>⌘</kbd>-klik, <kbd>Ctrl</kbd>-klik of de middelste muisknop{/snippet}Een
				verwijzing direct openen, zonder kaart</KeyRow
			>
			<KeyRow
				>{#snippet key()}<kbd>Esc</kbd>{/snippet}Een kaart, menu of opengeklapte rij sluiten</KeyRow
			>
			<KeyRow>{#snippet key()}<kbd>?</kbd>{/snippet}Deze pagina</KeyRow>
		</KeyList>
	</div>
</div>
