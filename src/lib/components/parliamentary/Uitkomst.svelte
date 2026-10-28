<script lang="ts">
	// Een uitkomst in vorm én kleur, zodat ook wie rood
	// en groen niet onderscheidt het ziet. Ja: een gevuld vakje in mos. Nee: een open vakje
	// met een rand in het accent. Nu: een gevuld vakje in inkt. Nog niet: een gestippeld vakje.
	let {
		tone,
		woord = null,
		title = null
	}: {
		tone: 'ja' | 'nee' | 'nu' | 'open' | 'klaar';
		/** Het woord naast het vakje; zonder woord alleen het vakje, met zijn naam voor een schermlezer en als title. */
		woord?: string | null;
		/** The name of a box without a word, where the general one does not fit; empty where the words beside it say it. */
		title?: string | null;
	} = $props();
	const TITLE = {
		ja: 'aangenomen of afgerond',
		nee: 'verworpen of tegen',
		nu: 'nu',
		open: 'nog niet',
		klaar: 'afgerond'
	};
	/** Without a word the box is named for a screen reader; an empty title leaves it unnamed. */
	const label = $derived(woord ? null : (title ?? TITLE[tone]));
</script>

<span class="uk uk--{tone}" title={label || undefined}
	><span class="vak" aria-hidden="true"></span>{#if woord}<span class="w">{woord}</span
		>{:else if label}<span class="sr-only">{label}:&nbsp;</span>{/if}</span
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
		font-weight: 600;
	}
</style>
