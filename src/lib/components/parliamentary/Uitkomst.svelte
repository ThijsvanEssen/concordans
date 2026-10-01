<script lang="ts">
	// Een uitkomst in vorm én kleur, zodat ook wie rood
	// en groen niet onderscheidt het ziet. Ja: een gevuld vakje in mos. Nee: een open vakje
	// met een rand in het accent. Nu: een gevuld vakje in inkt. Nog niet: een gestippeld vakje.
	let {
		soort,
		woord = null
	}: {
		soort: 'ja' | 'nee' | 'nu' | 'open' | 'klaar';
		/** Het woord naast het vakje; zonder woord alleen het vakje (met een title). */
		woord?: string | null;
	} = $props();
	const TITLE = {
		ja: 'aangenomen of afgerond',
		nee: 'verworpen of tegen',
		nu: 'nu',
		open: 'nog niet',
		klaar: 'afgerond'
	};
</script>

<span class="uk uk--{soort}" title={woord ? undefined : TITLE[soort]}
	><span class="vak" aria-hidden="true"></span>{#if woord}<span class="w">{woord}</span>{/if}</span
>

<style>
	.uk {
		display: inline-flex;
		align-items: baseline;
		gap: var(--s-2);
		font-weight: 600;
	}
	.vak {
		display: inline-block;
		width: 10px;
		height: 10px;
		flex: none;
		transform: translateY(1px);
		box-sizing: border-box;
	}
	.uk--ja .vak {
		background: var(--uitkomst-ja);
	}
	.uk--ja .w {
		color: var(--uitkomst-ja);
	}
	.uk--nee .vak {
		border: 2px solid var(--uitkomst-nee);
	}
	.uk--nee .w {
		color: var(--uitkomst-nee);
	}
	.uk--nu .vak {
		background: var(--ink);
	}
	.uk--klaar .vak {
		background: var(--ink-2);
	}
	.uk--open .vak {
		border: 1.5px dashed var(--ink-3);
	}
	.uk--open .w {
		color: var(--ink-3);
		font-weight: 500;
	}
</style>
