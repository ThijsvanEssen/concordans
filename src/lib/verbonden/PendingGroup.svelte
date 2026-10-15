<script lang="ts">
	// A group still to come, while the verbindingen load: its head with the count the light node
	// gives, and blank rows as many as it will show (#1), so what comes fills them in and
	// nothing below moves. Without a group to foretell, quiet bars where groups will be.
	import { formatCount } from '$lib/text/getal';
	import { isOpen } from '$lib/components/ui/dicht.svelte';
	import { VERBONDEN_BUCKET } from '$lib/api/records';
	import type { Collection } from '$lib/vocabulary';
	import GroupHead from './GroupHead.svelte';
	import PendingRows, { pendingKind } from './PendingRows.svelte';
	import { PREVIEW_ROWS } from './view';
	import type { VerbondenState } from './data-source';

	let {
		group,
		collection
	}: {
		group: NonNullable<VerbondenState['preview']>[number] | null;
		collection: Collection;
	} = $props();
</script>

{#if group}
	<section class="group" aria-hidden="true">
		<GroupHead
			label={group.label}
			count={group.count != null ? formatCount(group.count) : '…'}
			open
		/>
		{#if group.count && isOpen(`verbonden:${group.id}`, true)}
			{#if group.noun === 'uitspraken' && (group.count > VERBONDEN_BUCKET || group.ordered)}
				<!-- The line of the judgments' order and years, as it will stand. -->
				<div class="regel-wacht"></div>
			{/if}
			<PendingRows
				count={group.count}
				shown={PREVIEW_ROWS}
				kind={pendingKind(group.noun, collection)}
			/>
		{/if}
	</section>
{:else}
	<div class="balken" aria-hidden="true">
		<span class="balk balk--kop"></span>
		<span class="balk"></span>
		<span class="balk balk--kort"></span>
	</div>
{/if}

<style>
	/* As high as the line of the order and the years of a group of judgments (JudgmentOrderLine). */
	.regel-wacht {
		height: var(--s-6);
	}
	.balken {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		padding: var(--s-3) var(--s-4);
		border-bottom: 1px solid var(--rule);
	}
	.balk {
		display: block;
		height: var(--s-3);
		width: 85%;
		border-radius: var(--r-1);
		/* The panel is paper-2 itself: the bars take the colour of its rules, faintly. */
		background: var(--rule);
		opacity: 0.6;
	}
	.balk--kop {
		height: var(--s-4);
		width: 45%;
	}
	.balk--kort {
		width: 60%;
	}
	@media (prefers-reduced-motion: no-preference) {
		.balk {
			animation: ademen 1.6s ease-in-out infinite;
		}
	}
	@keyframes ademen {
		50% {
			opacity: 0.3;
		}
	}
</style>
