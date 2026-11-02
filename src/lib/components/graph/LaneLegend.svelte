<script lang="ts">
	// The key and the switch of the lanes in one place: every lijnsoort this network holds, with its
	// sample in the colour it has there, so that a line can be read without hovering. The tick is the
	// switch, in the one state of Relatie, as in Tonen. The set stands still: what is off, or what no
	// line shows now (a line shows the heaviest of a pair), stays, quieter. And the markers of a
	// changed wet: on a phone Wetten has no heads, so they alone say what they mean.
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
	import Vinkje from '$lib/components/ui/Vinkje.svelte';
	import LineSample from './LineSample.svelte';
	import { tokens } from './nodeSprites';

	let {
		kinds,
		lines,
		hidden,
		onToggle,
		changes,
		changesDrawn
	}: {
		/** What the network holds, with nothing switched off (scene `kinds`). */
		kinds: readonly { kind: LineKind; proposed: boolean }[];
		/** The lines drawn now. */
		lines: readonly SceneLine[];
		/** The lijnsoorten switched off. */
		hidden: ReadonlySet<LineKind>;
		onToggle: (kind: LineKind) => void;
		/** How the wetten of this network change. */
		changes: readonly LawChange[];
		/** And which of those stand on the canvas now. */
		changesDrawn: readonly LawChange[];
	} = $props();

	const holds = (kind: LineKind, proposed: boolean) =>
		kinds.some((k) => k.kind === kind && k.proposed === proposed);
	const drawn = (kind: LineKind, proposed: boolean) =>
		lines.some((l) => l.kind === kind && l.proposed === proposed);
	/** Per lijnsoort its samples: a change that is only proposed has its own, one switch for both. */
	const items = $derived(
		LINE_KINDS.filter((kind) => hidden.has(kind) || kinds.some((k) => k.kind === kind)).map(
			(kind) => ({
				kind,
				samples: [
					...(holds(kind, false) || !holds(kind, true)
						? [{ proposed: false, label: LINE_KIND_LABEL[kind] }]
						: []),
					...(holds(kind, true) ? [{ proposed: true, label: 'Voorgestelde wijziging' }] : [])
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
				<Vinkje aan={!hidden.has(kind)} />
				{#each samples as { proposed, label } (label)}
					<span class="sample" class:stil={!drawn(kind, proposed)}>
						<LineSample
							relation={sample.relation}
							from={sample.from}
							colour={colourOf(kind, proposed)}
						/>
						<span class="word">{label}</span>
					</span>
				{/each}
			</button>
		</li>
	{/each}
	{#each marks as change, i (change)}
		<li class="mark" class:first={i === 0} class:stil={!changesDrawn.includes(change)}>
			<svg width="10" height="10" viewBox="-5 -5 10 10" aria-hidden="true">
				<path class:hollow={change === 'proposed'} d={CHANGED_MARK} />
			</svg>
			{LAW_CHANGE_WORDS[change].head}
		</li>
	{/each}
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
		gap: 0 var(--s-4);
		width: fit-content;
		max-width: calc(100% - 2 * var(--s-8));
		margin: 0 0 calc(-1 * var(--s-8));
		padding: var(--s-1) var(--s-4);
		list-style: none;
		background: var(--paper);
		font-family: var(--font-serif);
		font-size: var(--t-note);
		color: var(--ink);
	}
	.kind {
		display: flex;
		align-items: center;
		gap: var(--s-1) var(--s-2);
		min-height: var(--s-5);
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: inherit;
		cursor: pointer;
	}
	.sample {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
	}
	/* Off, or no line shows it now: it stays, quieter. Only the tick says which. */
	.stil,
	.kind[aria-pressed='false'] .sample {
		color: var(--ink-3);
	}
	.stil :global(svg),
	.kind[aria-pressed='false'] :global(.lm) {
		opacity: 0.35;
	}
	.kind:hover {
		color: var(--ink);
	}
	.mark {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		min-height: var(--s-5);
	}
	/* What a line means and what a mark on a wet means: a rule between them. */
	.mark.first {
		padding-left: var(--s-4);
		border-left: 1px solid var(--rule);
	}
	.mark path {
		fill: var(--ink-2);
	}
	.mark path.hollow {
		fill: var(--paper);
		stroke: var(--ink-2);
	}
	/* A phone: Deel stands above the field; the samples above the strips, and they scroll away. */
	@media (max-width: 768px) {
		.kinds {
			position: static;
			max-width: 100%;
			margin: 0;
		}
		.kind {
			min-height: 44px;
		}
		.mark.first {
			padding-left: 0;
			border-left: 0;
		}
	}
</style>
