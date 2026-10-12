<script lang="ts">
	// The mark of a strekking, the same wherever one is chosen: bevorderend solid, beperkend
	// striped, neutraal open, niet beoordeeld light. Shape before colour, all in ink: red stays
	// for "nee" and errors.
	import type { StrekkingLaag } from './strekking';

	let { strekking }: { strekking: StrekkingLaag } = $props();
</script>

<span class="st st--{strekking}" aria-hidden="true"></span>

<style>
	.st {
		display: inline-block;
		box-sizing: border-box;
		width: 10px;
		height: 10px;
		flex: none;
		color: var(--ink);
	}
	.st--bevorderend {
		background: currentColor;
	}
	.st--beperkend {
		background: repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 4px);
		box-shadow: inset 0 0 0 1px currentColor;
	}
	.st--neutraal {
		box-shadow: inset 0 0 0 1px currentColor;
	}
	.st--geen {
		background: var(--paper-2);
		box-shadow: inset 0 0 0 1px var(--rule);
	}
	/* In a chosen option, filled in ink, the mark is in paper. */
	:global([aria-pressed='true']) .st {
		color: var(--paper);
	}
</style>
