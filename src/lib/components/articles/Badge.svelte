<script lang="ts">
	// A or B: the mark of a tekstversie, the same on the line through time, at the lists and
	// at the head of its column. Its ring takes the colour of what it stands on
	// (`--badge-ring`, the paper by default).
	let { which }: { which: 'A' | 'B' } = $props();
</script>

<span class="badge" class:badge--a={which === 'A'}>{which}</span>

<style>
	.badge {
		flex: none;
		display: inline-grid;
		place-items: center;
		width: 18px;
		height: 18px;
		border: 2px solid var(--badge-ring, var(--paper));
		border-radius: 50%;
		background: var(--ink);
		font-family: var(--font-serif);
		font-size: var(--t-label);
		font-weight: 600;
		line-height: 1;
		color: var(--paper);
	}
	.badge--a {
		background: var(--ink-3);
	}
</style>
