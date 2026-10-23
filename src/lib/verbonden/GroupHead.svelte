<script lang="ts">
	// The head of a group of Verbonden: its heading and its count. A group is no folding section
	// (besluit 38, K1): the heading opens nothing, it names the group.
	let {
		label,
		count
	}: {
		label: string;
		count: string;
	} = $props();
</script>

<!-- The count follows the heading; when the heading wraps, it stands on the first line's right. -->
<div class="group__head">
	<h3 class="group__label">{label}</h3>
	<span class="group__count">{count}</span>
</div>

<style>
	.group__head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--s-2);
		padding: var(--s-4) var(--s-4) var(--s-2);
	}
	.group__label {
		flex: 0 1 auto;
		min-width: 0;
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-weight: 600;
		color: var(--ink);
	}
	.group__count {
		flex: none;
		color: var(--ink-3);
		font-variant-numeric: tabular-nums;
	}
</style>
