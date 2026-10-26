<script lang="ts">
	// The betrouwbaarheid of a verbinding as a dot beside its word, alike in the table and the
	// card: full for hoog, half for matig, open for laag.
	const ZEKER = { hoog: 'zeker', matig: 'minder zeker', laag: 'onzeker' } as const;
	let { word }: { word: 'hoog' | 'matig' | 'laag' } = $props();
</script>

<span class="conf conf--{word}" aria-hidden="true" title="afgeleid, {ZEKER[word]}"></span>

<style>
	/* A dot the height of a lower-case letter, its ring a little heavier than a hairline. */
	.conf {
		display: inline-block;
		width: 7px;
		height: 7px;
		border: 1.3px solid var(--ink-3);
		border-radius: var(--r-rond);
		vertical-align: 0;
	}
	.conf--hoog {
		background: var(--ink-3);
	}
	.conf--matig {
		background: linear-gradient(90deg, var(--ink-3) 50%, transparent 50%);
	}
</style>
