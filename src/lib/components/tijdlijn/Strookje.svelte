<script lang="ts">
	// Eén periode op een kleine schaal, onder een naam: het blok van de posten in het klein.
	// In rust `paper-2` met de partij als kap, open in ink, waarnemend een stippelrand. Dezelfde
	// vorm op de telefoon (CabinetOccupancy) en in Naast elkaar (NaastPosten).
	let {
		van,
		tot,
		kleur,
		open = false,
		waarnemend = false
	}: {
		/** Begin en eind als fractie van de schaal (0 tot 1). */
		van: number;
		tot: number;
		kleur: string;
		open?: boolean;
		waarnemend?: boolean;
	} = $props();
</script>

<span class="strookje" aria-hidden="true"
	><span
		class="blok"
		class:open
		class:waarnemend
		style:left="{van * 100}%"
		style:width="max(4px, {(tot - van) * 100}%)"
		style:--partij={kleur}
	></span></span
>

<style>
	/* De schaal als een lijn van 1px in `rule`, het blok erop. */
	.strookje {
		position: relative;
		display: block;
		height: var(--s-2);
	}
	.strookje::before {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		border-top: 1px solid var(--rule);
	}
	.blok {
		position: absolute;
		top: 0;
		bottom: 0;
		box-sizing: border-box;
		background: var(--paper-2);
		border-left: 2px solid var(--partij);
		box-shadow: inset 0 0 0 1px var(--rule);
	}
	.waarnemend {
		background: var(--paper);
		box-shadow: none;
		border: 1px dotted var(--ink-3);
		border-left: 2px solid var(--partij);
	}
	.open {
		background: var(--ink);
		box-shadow: none;
	}
</style>
