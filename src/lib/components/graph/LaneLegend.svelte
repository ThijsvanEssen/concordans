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
	import type { LawChange, Scene } from '$lib/graph/scene';
	import type { Visibility } from '$lib/graph/visibility';
	import Vinkje from '$lib/components/ui/Vinkje.svelte';
	import LineSample from './LineSample.svelte';
	import { tokens } from './nodeSprites';

	let {
		whole,
		scene,
		visibility,
		onToggleLine,
		foot = false
	}: {
		/** What the network holds, with nothing switched off: its lijnsoorten and changed wetten. */
		whole: Scene;
		/** What is drawn now. */
		scene: Scene;
		/** Its hiddenLines: the lijnsoorten switched off. */
		visibility: Visibility;
		onToggleLine: (kind: LineKind) => void;
		/** Under the strips of a phone, not over the columns. */
		foot?: boolean;
	} = $props();

	const hidden = $derived(visibility.hiddenLines);
	const kinds = $derived(whole.kinds);
	const lines = $derived(scene.lines);
	const changes = $derived(whole.units.flatMap((u) => u.change ?? []));
	const changesDrawn = $derived(scene.units.flatMap((u) => u.change ?? []));

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
	/** Every lijnsoort there is, Wijziging also proposed: the room the legend stands in. */
	const ALL_ITEMS = LINE_KINDS.map((kind) => ({
		kind,
		samples: [
			{ proposed: false, label: LINE_KIND_LABEL[kind] },
			...(kind === 'change' ? [{ proposed: true, label: 'Voorgestelde wijziging' }] : [])
		]
	}));
	const ALL_MARKS = ['enacted', 'proposed'] as const;
	const marks = $derived((['enacted', 'proposed'] as const).filter((c) => changes.includes(c)));
	const colourOf = (kind: LineKind, proposed: boolean) => {
		const style = LINE_KIND_STYLE[kind];
		const t = tokens();
		return laneLineColour(t[style.colour], t.paper, proposed ? 'licht' : style.tone);
	};
</script>

<!-- Also with nothing left to draw: what is switched off comes back here. The legend stands in the
     room of every lijnsoort there is, an unseen copy under it: what comes in later adds no line, so
     the field under it does not move (N17c). -->
{#if kinds.length > 0 || hidden.size > 0}
	<div class="legend" class:foot>
		<ul class="kinds" aria-label="Lijnsoorten">
			{#each items as { kind, samples } (kind)}
				<li>
					<button
						type="button"
						class="kind"
						aria-pressed={!hidden.has(kind)}
						title="{LINE_KIND_LABEL[kind]} {hidden.has(kind) ? 'tonen' : 'verbergen'}"
						onclick={() => onToggleLine(kind)}
					>
						<Vinkje aan={!hidden.has(kind)} />
						{#each samples as { proposed, label } (label)}
							{@render sampleOf(kind, proposed, label, !drawn(kind, proposed))}
						{/each}
					</button>
				</li>
			{/each}
			{#each marks as change, i (change)}
				{@render markOf(change, i, !changesDrawn.includes(change))}
			{/each}
		</ul>
		<ul class="kinds room" aria-hidden="true" inert>
			{#each ALL_ITEMS as { kind, samples } (kind)}
				<li>
					<span class="kind">
						<Vinkje aan />
						{#each samples as { proposed, label } (label)}
							{@render sampleOf(kind, proposed, label, false)}
						{/each}
					</span>
				</li>
			{/each}
			{#each ALL_MARKS as change, i (change)}
				{@render markOf(change, i, false)}
			{/each}
		</ul>
	</div>
{/if}

{#snippet sampleOf(kind: LineKind, proposed: boolean, label: string, faint: boolean)}
	{@const sample = LINE_KIND_SAMPLE[kind]}
	<span class="sample" class:faint>
		<LineSample relation={sample.relation} from={sample.from} colour={colourOf(kind, proposed)} />
		<span class="word">{label}</span>
	</span>
{/snippet}

{#snippet markOf(change: LawChange, i: number, faint: boolean)}
	<li class="mark" class:first={i === 0} class:faint>
		<svg width="10" height="10" viewBox="-5 -5 10 10" aria-hidden="true">
			<path class:hollow={change === 'proposed'} d={CHANGED_MARK} />
		</svg>
		{LAW_CHANGE_WORDS[change].head}
	</li>
{/snippet}

<style>
	/* It stays in view while the field scrolls: over the empty top of the columns. The legend and
	   its unseen room share one cell, so the room sets the height. */
	.legend {
		position: sticky;
		top: 0;
		left: 0;
		z-index: 1;
		display: grid;
		width: fit-content;
		max-width: calc(100% - 2 * var(--s-8));
		margin: 0 0 calc(-1 * var(--s-8));
	}
	.legend > .kinds {
		grid-area: 1 / 1;
	}
	.room {
		visibility: hidden;
	}
	.kinds {
		box-sizing: border-box;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0 var(--s-4);
		align-self: start;
		margin: 0;
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
	.faint,
	.kind[aria-pressed='false'] .sample {
		color: var(--ink-3);
	}
	.faint :global(svg),
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
	/* Under the strips of a phone, a key at the foot: what comes in later moves nothing above it,
	   so it needs no room. */
	.legend.foot {
		position: static;
		max-width: 100%;
		margin: 0;
	}
	.foot > .room {
		display: none;
	}
	@media (max-width: 768px) {
		.kind {
			min-height: 44px;
		}
		.mark.first {
			padding-left: 0;
			border-left: 0;
		}
	}
</style>
