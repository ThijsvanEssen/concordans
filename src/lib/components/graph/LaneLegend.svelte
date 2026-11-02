<script lang="ts">
	// The key and the switch of the lanes in one place: a lijnsoort with its sample in the colour it
	// has there, so that a line can be read without hovering; a click switches it, in the one state
	// of Relatie. What is drawn, and what is switched off: that must come back here. And the markers
	// of a changed wet: on a phone Wetten has no heads, so they alone say what they mean.
	import {
		LINE_KIND_LABEL,
		LINE_KIND_SAMPLE,
		LINE_KIND_STYLE,
		LINE_KINDS,
		type LineKind
	} from '$lib/graph/line-kind';
	import { CHANGED_MARK, LAW_CHANGE_WORDS } from '$lib/graph/lane-changes';
	import { laneLineColour } from '$lib/graph/line-strength';
	import type { LawChange, SceneLine } from '$lib/graph/scene';
	import LineSample from './LineSample.svelte';
	import { tokens } from './nodeSprites';

	let {
		lines,
		hidden,
		onToggle,
		changes
	}: {
		lines: readonly SceneLine[];
		/** The lijnsoorten switched off. */
		hidden: ReadonlySet<LineKind>;
		onToggle: (kind: LineKind) => void;
		/** How the wetten on the canvas change. */
		changes: readonly LawChange[];
	} = $props();

	const has = (kind: LineKind, proposed: boolean) =>
		lines.some((l) => l.kind === kind && l.proposed === proposed);
	/** Per lijnsoort its samples: a change that is only proposed has its own, one switch for both. */
	const items = $derived(
		LINE_KINDS.filter((kind) => hidden.has(kind) || lines.some((l) => l.kind === kind)).map(
			(kind) => ({
				kind,
				samples: [
					...(has(kind, false) || hidden.has(kind)
						? [{ proposed: false, label: LINE_KIND_LABEL[kind] }]
						: []),
					...(has(kind, true) ? [{ proposed: true, label: 'Voorgestelde wijziging' }] : [])
				]
			})
		)
	);
	const marks = $derived((['enacted', 'proposed'] as const).filter((c) => changes.includes(c)));
	const colourOf = (kind: LineKind, proposed: boolean) => {
		const style = LINE_KIND_STYLE[kind];
		const t = tokens();
		return laneLineColour(t[style.colour], t.paper, proposed ? 'licht' : style.tone);
	};
</script>

<ul class="kinds" aria-label="Lijnsoorten">
	{#each items as { kind, samples } (kind)}
		{@const sample = LINE_KIND_SAMPLE[kind]}
		<li>
			<button
				type="button"
				class="kind"
				aria-pressed={!hidden.has(kind)}
				title="{LINE_KIND_LABEL[kind]} {hidden.has(kind) ? 'tonen' : 'verbergen'}"
				onclick={() => onToggle(kind)}
			>
				{#each samples as { proposed, label } (label)}
					<LineSample
						relation={sample.relation}
						from={sample.from}
						colour={colourOf(kind, proposed)}
					/>
					<span class="word">{label}</span>
				{/each}
			</button>
		</li>
	{/each}
	{#each marks as change (change)}
		<li class="mark">
			<svg width="10" height="10" viewBox="-5 -5 10 10" aria-hidden="true">
				<path class:hollow={change === 'proposed'} d={CHANGED_MARK} />
			</svg>
			{LAW_CHANGE_WORDS[change].head}
		</li>
	{/each}
	{#if hidden.has('change')}
		<li class="note">Zonder Wijziging geen kopjes en markers bij de wetten</li>
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
		align-items: center;
		gap: 0 var(--s-3);
		width: fit-content;
		max-width: calc(100% - 2 * var(--s-8));
		margin: 0 0 calc(-1 * var(--s-8));
		padding: var(--s-1) var(--s-4);
		list-style: none;
		background: var(--paper);
		font-family: var(--font-serif);
		font-size: var(--t-note);
		color: var(--ink-2);
	}
	.kind {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		min-height: var(--s-5);
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: inherit;
		cursor: pointer;
	}
	.kind:hover .word {
		text-decoration: underline;
	}
	/* Switched off: struck through, its sample faint; it stays, to switch on again. */
	.kind[aria-pressed='false'] {
		color: var(--ink-3);
	}
	.kind[aria-pressed='false'] .word {
		text-decoration: line-through;
	}
	.kind[aria-pressed='false'] :global(svg) {
		opacity: 0.35;
	}
	.mark {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		min-height: var(--s-5);
	}
	.mark path {
		fill: var(--ink-2);
	}
	.mark path.hollow {
		fill: var(--paper);
		stroke: var(--ink-2);
	}
	.note {
		color: var(--ink-3);
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
