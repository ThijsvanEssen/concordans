<script lang="ts">
	// The outcome of a vote as a picture, the one form of it across the site: a motie, a
	// stemming, the lists of stemmingen, the votes of a Kamerlid or a fractie. The width is the
	// seats of the Kamer (150, of the Eerste Kamer 75); voor from the left in mos, tegen from the
	// right in the accent, with the word beside the number (red only says nee, and says it in
	// words); what is neither between them, hatched; a line at the majority. Where the vote names
	// its fracties each is a segment, in order of its seats. Read to a screen reader as one
	// sentence ("Aangenomen, 88 voor, 62 tegen") with a table behind it. Every drawing of a
	// vote's tally goes through here (guards/stembalk.test.ts). The model is in stembalk.ts.
	import type { VoteBarModel, VoteSide } from '$lib/votes/stembalk';

	let {
		model,
		compact = false,
		members = false
	}: {
		model: VoteBarModel;
		/** In a list row: thinner, the line without its label. */
		compact?: boolean;
		/** A hoofdelijke stemming counts members, not seats. */
		members?: boolean;
	} = $props();

	const LEFT: VoteSide[] = ['for', 'other'];
	const SIDES: VoteSide[] = ['for', 'against', 'other'];
	const WORD = { for: 'voor', against: 'tegen', other: 'niet deelgenomen' } as const;
	const unit = $derived(members ? 'leden' : 'zetels');
	const pct = (seats: number) => `${(seats / model.total) * 100}%`;

	/** The parts of a side: its fracties, or the side whole where the vote names none. */
	const partsOf = (side: VoteSide) => {
		const p = model.parts[side];
		return p.length > 0 ? p : [{ name: '', seats: model.counts[side] }];
	};
	const named = $derived(SIDES.some((side) => model.parts[side].length > 0));
	const title = (side: VoteSide, name: string, seats: number) =>
		`${name ? `${name}, ` : ''}${seats} ${unit}, ${WORD[side]}`;
</script>

<figure class="stembalk" class:compact aria-label="Stemuitslag">
	<div class="row">
		<span class="figure"><b>{model.counts.for}</b> voor</span>
		<div class="field" class:with-label={!compact}>
			<div class="bar" role="img" aria-label={model.sentence}>
				{#each LEFT as side (side)}
					{#if model.counts[side] > 0}
						{#each partsOf(side) as p (p.name || side)}
							<span
								class="part part--{side}"
								style:flex="0 0 {pct(p.seats)}"
								title={title(side, p.name, p.seats)}
							></span>
						{/each}
					{/if}
				{/each}
				<span class="rest"></span>
				{#each partsOf('against') as p (p.name || 'against')}
					<span
						class="part part--against"
						style:flex="0 0 {pct(p.seats)}"
						title={title('against', p.name, p.seats)}
					></span>
				{/each}
			</div>
			<span class="line" style:left={pct(model.total / 2)} aria-hidden="true"></span>
			{#if !compact}
				<span class="label" style:left={pct(model.total / 2)} aria-hidden="true"
					>meerderheid {model.majority}</span
				>
			{/if}
		</div>
		<span class="figure"><b>{model.counts.against}</b> tegen</span>
	</div>
	{#if named}
		<table class="sr-only">
			<caption>{model.sentence}</caption>
			<thead>
				<tr><th>Fractie</th><th>Keuze</th><th>Zetels</th></tr>
			</thead>
			<tbody>
				{#each SIDES as side (side)}
					{#each model.parts[side] as p (p.name)}
						<tr><td>{p.name}</td><td>{WORD[side]}</td><td>{p.seats}</td></tr>
					{/each}
				{/each}
			</tbody>
		</table>
	{/if}
</figure>

<style>
	.stembalk {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-variant-numeric: tabular-nums;
		color: var(--ink-2);
	}
	.row {
		display: grid;
		grid-template-columns: auto minmax(calc(var(--s-8) + var(--s-6)), 1fr) auto;
		align-items: center;
		gap: var(--s-3);
	}
	/* In a list the bars start and end alike, whatever the numbers: columns of one width. */
	.compact .row {
		grid-template-columns: var(--s-8) minmax(calc(var(--s-8) + var(--s-6)), 1fr) var(--s-8);
		gap: var(--s-2);
		font-size: var(--t-micro);
	}
	.compact {
		max-width: 360px;
	}
	.figure b {
		color: var(--ink);
		font-weight: 600;
	}
	.compact .figure:first-child {
		text-align: right;
	}
	.field {
		position: relative;
		min-width: 0;
	}
	/* Room under the bar for the label of the line. */
	.field.with-label {
		padding-bottom: var(--s-5);
	}
	.bar {
		display: flex;
		height: var(--s-4);
		background: var(--rule);
		border-radius: var(--r-1);
		overflow: hidden;
	}
	.compact .bar {
		height: var(--s-2);
	}
	.part {
		min-width: 0;
		border-left: 1px solid var(--paper);
	}
	.part:first-child {
		border-left: 0;
	}
	.part--for {
		background: var(--uitkomst-ja);
	}
	.part--against {
		background: var(--uitkomst-nee);
	}
	.part--other {
		background: repeating-linear-gradient(135deg, var(--ink-3) 0 2px, var(--paper) 2px 4px);
	}
	.rest {
		flex: 1 1 0;
		min-width: 0;
	}
	/* The majority: a line across the bar, a little beyond it. */
	.line {
		position: absolute;
		top: calc(-1 * var(--s-1));
		width: 2px;
		height: calc(var(--s-4) + 2 * var(--s-1));
		margin-left: -1px;
		background: var(--ink);
	}
	.compact .line {
		height: calc(var(--s-2) + 2 * var(--s-1));
	}
	.label {
		position: absolute;
		bottom: 0;
		transform: translateX(-50%);
		font-size: var(--t-micro);
		color: var(--ink-3);
		white-space: nowrap;
	}
</style>
