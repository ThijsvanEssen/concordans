<script lang="ts">
	// The numbered places of a hall's front (Voorzitter, Griffier, …) on one flowing line at the
	// left edge, the number as in the hall: a small round in ink. One line for the fractie list
	// and the cabinet's seats (Thijs, 10 Oct: "Centreren is hier niet helemaal chill").
	let { plaatsen, verborgen = false }: { plaatsen: string[]; verborgen?: boolean } = $props();
</script>

<p class="zaal-plaatsen" class:verborgen aria-hidden={verborgen || undefined}>
	{#each plaatsen as p, i (p)}<span><b>{i + 1}</b>{p}</span>{/each}
</p>

<style>
	.zaal-plaatsen {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-start;
		gap: var(--s-1) var(--s-4);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	.verborgen {
		visibility: hidden;
	}
	span {
		display: inline-flex;
		align-items: center;
		gap: var(--s-1);
	}
	b {
		display: inline-grid;
		place-items: center;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--ink);
		color: var(--paper);
		font-size: var(--t-glyph);
		font-weight: 600;
	}
</style>
