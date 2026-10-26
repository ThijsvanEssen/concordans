<script lang="ts">
	// The vlak of an instantie (Design System, VerbondenGroep): a step of soort-rechtspraak, the
	// Europese hoven hatched in the step of their rank, Overige instanties in rule-strong. In the
	// strook, its legend and in front of the title of a judgment's row: one form.
	import type { Instantievorm } from './tiers';

	let {
		vorm,
		balk = false
	}: {
		vorm: Instantievorm;
		/** A segment of the strook: it takes the room its figure says. */
		balk?: boolean;
	} = $props();
</script>

<i
	class="vlak"
	data-europa={vorm.europa || undefined}
	data-balk={balk || undefined}
	style:--trap={vorm.trap ? `var(--rechtspraak-${vorm.trap})` : 'var(--rule-strong)'}
	aria-hidden="true"
></i>

<style>
	.vlak {
		display: block;
		flex: none;
		width: var(--s-3);
		height: var(--s-3);
		background: var(--trap);
	}
	.vlak[data-balk] {
		width: auto;
		height: 100%;
		min-width: 3px;
	}
	/* The Europese hoven: hatched, with a rim, so the step reads without colour. */
	.vlak[data-europa] {
		background: repeating-linear-gradient(135deg, var(--trap) 0 2px, var(--paper) 2px 3.5px);
		box-shadow: inset 0 0 0 1px var(--trap);
	}
</style>
