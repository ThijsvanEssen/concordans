<script lang="ts">
	// The one wordmark: § plus the name. Every measure is in em, so `size` scales
	// the whole mark and the proportions between glyph and name stay fixed. The § is merk, the
	// name ink. Sizes: 20 in the top bar, 28 in the footer (the § is never under 26 px).
	// `grond` is what it stands on (DS Woordmerk): paper (the name in ink, the § merk), ink (the
	// name in paper, the § merk) or ink-2, a button or bar in hover, where merk is too weak and
	// the § and the name stand in paper.
	let { size = 20, grond = 'paper' }: { size?: number; grond?: 'paper' | 'ink' | 'ink-2' } =
		$props();
</script>

<span class="wordmark grond-{grond}" style:font-size="{size}px">
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
		font-family: var(--font-merk);
		font-style: italic;
		font-weight: 800;
		font-size: 1.3em;
		color: var(--merk);
	}

	.grond-ink,
	.grond-ink-2 {
		color: var(--paper);
	}
	.grond-ink-2 .mark {
		color: var(--paper);
	}

	.name {
		font-family: var(--font-serif);
		font-weight: 500;
	}
</style>
