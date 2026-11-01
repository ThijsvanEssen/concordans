<script lang="ts">
	// The lijnsoorten the lanes draw now, each with its sample in the colour it has there, so that a
	// line can be read without hovering. Only what is drawn: Relatie switches them. And the marker of a
	// changed wet, where one stands: on a phone Wetten has no heads, so it alone says what it means.
	import {
		LINE_KIND_LABEL,
		LINE_KIND_SAMPLE,
		LINE_KIND_STYLE,
		LINE_KINDS
	} from '$lib/graph/line-kind';
	import { laneLineColour } from '$lib/graph/line-strength';
	import type { SceneLine } from '$lib/graph/scene';
	import LineSample from './LineSample.svelte';
	import { tokens } from './nodeSprites';
	import { CHANGED_MARK, CHANGED_WORDS } from '$lib/graph/lane-changes';

	let { lines, changed }: { lines: readonly SceneLine[]; changed: boolean } = $props();

	const has = (kind: SceneLine['kind'], proposed: boolean) =>
		lines.some((l) => l.kind === kind && l.proposed === proposed);
	const items = $derived(
		LINE_KINDS.flatMap((kind) => {
			const out = [];
			if (has(kind, false)) out.push({ kind, proposed: false, label: LINE_KIND_LABEL[kind] });
			if (has(kind, true)) out.push({ kind, proposed: true, label: 'Voorgestelde wijziging' });
			return out;
		})
	);
	const colourOf = (kind: SceneLine['kind'], proposed: boolean) => {
		const style = LINE_KIND_STYLE[kind];
		const t = tokens();
		return laneLineColour(t[style.colour], t.paper, proposed ? 'licht' : style.tone);
	};
</script>

<ul class="kinds" aria-label="Lijnsoorten">
	{#each items as { kind, proposed, label } (`${kind}${proposed}`)}
		{@const sample = LINE_KIND_SAMPLE[kind]}
		<li>
			<LineSample relation={sample.relation} from={sample.from} colour={colourOf(kind, proposed)} />
			{label}
		</li>
	{/each}
	{#if changed}
		<li>
			<svg class="mark" width="10" height="10" viewBox="-5 -5 10 10" aria-hidden="true">
				<path d={CHANGED_MARK} />
			</svg>
			{CHANGED_WORDS}
		</li>
	{/if}
</ul>

<style>
	/* It stays in view while the field scrolls: over the empty top of the columns. */
	.kinds {
		position: sticky;
		top: 0;
		left: 0;
		z-index: 1;
		box-sizing: border-box;
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-4);
		width: fit-content;
		max-width: calc(100% - 2 * var(--s-8));
		margin: 0 0 calc(-1 * var(--s-8));
		padding: var(--s-2) var(--s-4);
		list-style: none;
		background: var(--paper);
		font-family: var(--font-serif);
		font-size: var(--t-note);
		color: var(--ink-2);
	}
	.kinds li {
		display: flex;
		align-items: center;
		gap: var(--s-2);
	}
	.mark path {
		fill: var(--ink-2);
	}
	/* A phone: Deel stands above the field; the samples above the strips, and they scroll away. */
	@media (max-width: 768px) {
		.kinds {
			position: static;
			max-width: 100%;
			margin: 0;
		}
	}
</style>
