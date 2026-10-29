<script lang="ts">
	// De dagrij van de lagere rechtspraak, opengeklapt: een kopje per rechtsgebied met zijn
	// aantal. De grootste kopjes openen met de rij en halen hun eerste uitspraken lui op; de
	// rest wacht op een eigen klik. Een uitspraak telt in elk rechtsgebied dat ze heeft.
	import { OPEN_AREAS, areaLabel, areaParam, type LowerArea } from './lower-courts';
	import AreaGroup from './AreaGroup.svelte';

	let { date, areas }: { date: string; areas: readonly LowerArea[] } = $props();
</script>

<div class="areas">
	{#each areas as a, n (areaParam(a))}
		<AreaGroup {date} area={a} label={areaLabel(a)} opened={n < OPEN_AREAS} />
	{/each}
</div>

<style>
	.areas {
		display: flex;
		flex-direction: column;
	}
</style>
