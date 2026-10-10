<script lang="ts">
	// The seats of two sides against the majority (Thijs, 9 Oct: the coalition "dan zien we
	// meteen waar ze zitten"): one bar, the first side filled, the second open, and a line at
	// the majority with its number. Shape and word, not colour alone, as in the hall above it.
	let {
		ja,
		nee,
		totaal,
		woorden
	}: {
		/** The seats of the first side (coalitie, voor). */
		ja: number;
		/** The seats of the second side (oppositie, tegen). */
		nee: number;
		/** The seats of the Kamer: 150 or 75. */
		totaal: number;
		/** The two sides as words: ['coalitie', 'oppositie']. */
		woorden: [string, string];
	} = $props();

	/** More than half: 76 of 150, 38 of 75. */
	const meerderheid = $derived(Math.floor(totaal / 2) + 1);
	const pct = (n: number) => `${(100 * n) / totaal}%`;
	const hoofdletter = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
</script>

<div class="meerderheid">
	<p class="zin">
		{hoofdletter(woorden[0])} <b>{ja}</b>, {woorden[1]} <b>{nee}</b>{ja >= meerderheid
			? `, een meerderheid`
			: `, geen meerderheid`}
	</p>
	<div
		class="balk"
		role="img"
		aria-label="{hoofdletter(
			woorden[0]
		)} {ja} zetels, {woorden[1]} {nee}, meerderheid {meerderheid} van {totaal}"
	>
		<span class="ja" style:width={pct(ja)}></span>
		<span class="nee" style:left={pct(ja)} style:width={pct(nee)}></span>
		<span class="lijn" style:left={pct(meerderheid)}></span>
	</div>
	<p class="schaal" aria-hidden="true">
		<span style:left={pct(meerderheid)}>{meerderheid}</span>
	</p>
</div>

<style>
	.meerderheid {
		align-self: stretch;
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	.zin {
		margin: 0;
	}
	.zin b {
		font-weight: 600;
		color: var(--ink);
	}
	.balk {
		position: relative;
		height: var(--s-3);
	}
	.ja,
	.nee {
		position: absolute;
		top: 0;
		bottom: 0;
		box-sizing: border-box;
	}
	.ja {
		left: 0;
		background: var(--ink);
	}
	/* Open, as the hall draws the other side: a contour, no fill. */
	.nee {
		border: 1px solid var(--ink-3);
		background: var(--paper);
	}
	.lijn {
		position: absolute;
		top: calc(-1 * var(--s-1));
		bottom: calc(-1 * var(--s-1));
		width: 2px;
		margin-left: -1px;
		background: var(--ink);
	}
	.schaal {
		position: relative;
		height: 1.2em;
		margin: 0;
		color: var(--ink-3);
	}
	.schaal span {
		position: absolute;
		transform: translateX(-50%);
	}
</style>
