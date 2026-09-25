<script lang="ts">
	// The one wordmark: § plus the name. Every measure is in em, so `size` scales
	// the whole mark and the proportions between glyph and name stay fixed.
	let { size = 20 }: { size?: number } = $props();
</script>

<span class="wordmark" style:font-size="{size}px">
	<span class="mark" aria-hidden="true">&sect;</span>
	<span class="name">Concordans</span>
</span>

<style>
	.wordmark {
		display: inline-flex;
		align-items: baseline;
		gap: 0.5em;
		color: var(--ink);
		line-height: 1;
		white-space: nowrap;
	}

	/* Shares the name's baseline, so the § hangs below it like a descender. The
	   small drop moves its ink centre onto the capitals' centre. */
	.mark {
		position: relative;
		top: 0.03em;
		font-family: 'Playfair Display', var(--font-serif);
		font-style: italic;
		font-weight: 800;
		font-size: 1.3em;
		color: var(--accent);
	}

	.name {
		font-family: var(--font-serif);
		font-weight: 500;
	}
</style>
