<script lang="ts">
	// The vote on a motie or an amendement, on the page of the stuk itself (API 0.73, BE-33):
	// the outcome and the day, the seats for and against, and the fracties on each side. The
	// stuk names its decisions; the fracties of the Tweede Kamer are in the decision's votes,
	// those of the Eerste Kamer in its own lists.
	import type { Schema } from '$lib/api/types';
	import { getDecision } from '$lib/api/records';
	import BronLink from '$lib/bron/BronLink.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import { decisionOutcome } from '$lib/components/explore/index/decision-kind';
	import { ekFactionGroups } from '$lib/components/explore/readers/voters';
	import { langeDatum } from '$lib/text/datum';

	type Decision = Schema<'DecisionDTO'>;

	let { decisions }: { decisions: Decision[] } = $props();

	let details = $state<Map<string, Decision>>(new Map());
	$effect(() => {
		const ac = new AbortController();
		const keys = decisions.filter((d) => d.chamber !== 'EK').map((d) => d.key);
		Promise.all(
			keys.map((key) =>
				getDecision(key)
					.then((d) => [key, d] as const)
					.catch(() => null)
			)
		).then((found) => {
			if (!ac.signal.aborted)
				details = new Map(found.filter((f): f is readonly [string, Decision] => f !== null));
		});
		return () => ac.abort();
	});

	/** The fracties per side: Voor, Tegen, and any other choice the source gives. */
	function sides(d: Decision): { label: string; names: string[] }[] {
		if (d.chamber === 'EK') return ekFactionGroups(d);
		const full = details.get(d.key);
		const by = Map.groupBy(full?.votes ?? [], (v) => v.choice);
		const order = ['Voor', 'Tegen', ...[...by.keys()].filter((c) => c !== 'Voor' && c !== 'Tegen')];
		return order
			.filter((c) => by.has(c))
			.map((c) => ({ label: c, names: by.get(c)!.map((v) => v.name?.trim() || v.voter_id) }));
	}

	/** "120 voor, 30 tegen" from the tally; empty for a decision without votes. */
	function telling(d: Decision): string {
		const tally = details.get(d.key)?.tally ?? d.tally ?? {};
		return Object.entries(tally)
			.map(([keuze, zetels]) => `${zetels} ${keuze.toLowerCase()}`)
			.join(', ');
	}
</script>

{#if decisions.length > 0}
	<Sectie titel="Stemming" soort="decisions">
		{#each decisions as d (d.key)}
			{@const uitslag = decisionOutcome(d)}
			{@const tally = telling(d)}
			<div class="stemming">
				<p class="uitslag">
					<BronLink ref={`decisions/${d.key}`}>{uitslag ?? 'Stemming'}</BronLink>{d.date
						? ` op ${langeDatum(d.date)}`
						: ''}{tally ? `: ${tally}` : ''}.
				</p>
				{#each sides(d) as side (side.label)}
					{#if side.names.length > 0}
						<p class="kant"><span class="kant-naam">{side.label}</span> {side.names.join(', ')}</p>
					{/if}
				{/each}
			</div>
		{/each}
	</Sectie>
{/if}

<style>
	.stemming {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
	}
	.stemming + .stemming {
		margin-top: var(--s-3);
	}
	.uitslag {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body);
		color: var(--ink);
	}
	.kant {
		margin: 0;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
		color: var(--ink-2);
	}
	.kant-naam {
		display: inline-block;
		min-width: 48px;
		margin-right: var(--s-1);
		font-weight: 600;
		color: var(--ink);
	}
</style>
