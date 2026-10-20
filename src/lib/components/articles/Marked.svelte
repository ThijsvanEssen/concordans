<script lang="ts">
	// A text with the words a comparison struck and inserted marked: struck in grey through,
	// inserted on the colour of an insertion. `side` shows one text alone: the old without
	// what came in, the new without what went. `plain` leaves out the words a screen reader
	// hears before a mark, for a legend that names the marks itself.
	import type { DiffSegment } from '$lib/text/version-diff';

	let {
		segments,
		side = 'both',
		plain = false
	}: { segments: DiffSegment[]; side?: 'both' | 'old' | 'new'; plain?: boolean } = $props();
</script>

{#each segments as s, i (i)}
	{@const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(s.text) ?? ['', '', s.text, '']}
	{#if s.op === 'eq'}{s.text}{:else if s.op === 'del' && side !== 'new'}{lead}<del
			>{#if !plain}<span class="sr-only">geschrapt: </span>{/if}{core}</del
		>{trail}{:else if s.op === 'ins' && side !== 'old'}{lead}<ins
			>{#if !plain}<span class="sr-only">ingevoegd: </span>{/if}{core}</ins
		>{trail}{/if}
{/each}

<style>
	ins {
		text-decoration: none;
		background: var(--mark-ins);
		box-shadow: inset 0 -1.5px 0 var(--mark-ins-rule);
		box-decoration-break: clone;
		-webkit-box-decoration-break: clone;
		padding: 0 1px;
	}
	del {
		color: var(--ink-3);
		text-decoration: line-through;
		text-decoration-color: var(--ink-2);
		text-decoration-thickness: 1px;
	}
</style>
