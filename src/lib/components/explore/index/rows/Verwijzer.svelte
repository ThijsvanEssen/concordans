<script lang="ts">
	// The Dutch decision whose questions a ruling of the Court of Justice answers: one link to
	// that judgment, here and on Europa. Nothing where the decision is not known.
	import type { Schema } from '$lib/api/types';
	import { openHref } from '$lib/bron/href';
	import { ecliKey } from '$lib/text/ecli';

	let { decision }: { decision: Schema<'ReferringDecisionDTO'> | null | undefined } = $props();
</script>

{#if decision}
	<span class="row-sub"
		>Vraag van <a class="raakvlak" href={openHref(`judgments/${ecliKey(decision.ecli)}`)}
			>{decision.ecli}</a
		></span
	>
{/if}
