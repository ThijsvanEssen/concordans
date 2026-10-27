<script lang="ts">
	// The one wordmark: § plus the name. Every measure is in em, so `size` scales
	// the whole mark and the proportions between glyph and name stay fixed. The § is merk, the
	// name ink. Sizes: 20 in the top bar, 28 in the footer (the § is never under 26 px).
	// What it stands on (DS Woordmerk): paper (the name in ink, the § merk), or on a ground
	// that sets `.op-ink` (the name in paper, the § merk) or `.op-ink-2` (a button or bar in
	// hover: merk is too weak there, the § and the name stand in paper). The ground is the
	// parent's, so the mark takes it from there and knows no prop for it.
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
		font-family: var(--font-merk);
		font-style: italic;
		font-weight: 800;
		font-size: 1.3em;
		color: var(--merk);
	}

	:global(.op-ink) .wordmark,
	:global(.op-ink-2) .wordmark {
		color: var(--paper);
	}
	:global(.op-ink-2) .mark {
		color: var(--paper);
	}

	.name {
		font-family: var(--font-serif);
		font-weight: 500;
	}
</style>
