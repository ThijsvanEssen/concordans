<script lang="ts">
	// Two actions that belong together in one frame with a rule between them: zoom out and in,
	// the previous and the next change. Optionally a value between them ("1 van 7"). A half
	// that cannot (the start or the end reached) is disabled, not gone.
	type Half = {
		/** What it does: `Inzoomen`. */
		label: string;
		onclick: () => void;
		disabled?: boolean;
		/** The sign: `+`, `‹`. */
		sign: string;
	};
	let {
		name,
		first,
		second,
		value
	}: {
		/** What the pair is, for a screen reader: `Zoom`, `Wijzigingen`. */
		name: string;
		first: Half;
		second: Half;
		/** The state between the halves: `1 van 7`. */
		value?: string;
	} = $props();
</script>

<div class="pair" role="group" aria-label={name}>
	{@render half(first)}
	{#if value}<span class="value-segment">{value}</span>{/if}
	{@render half(second)}
</div>

{#snippet half(h: Half)}
	<button
		type="button"
		aria-label={h.label}
		title={h.label}
		disabled={h.disabled}
		onclick={h.onclick}>{h.sign}</button
	>
{/snippet}

<style>
	.pair {
		flex: none;
		box-sizing: border-box;
		display: inline-flex;
		height: var(--veld-h);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		overflow: hidden;
	}
	button {
		display: inline-grid;
		place-items: center;
		width: var(--veld-h);
		padding: 0;
		border: 0;
		background: none;
		font-family: var(--font-ui);
		font-size: var(--t-teken);
		line-height: 1;
		color: var(--ink-2);
		cursor: pointer;
	}
	button + button,
	.value-segment + button {
		border-left: 1px solid var(--rule-strong);
	}
	button:hover:not(:disabled) {
		background: var(--paper-2);
		color: var(--ink);
	}
	button:disabled {
		color: var(--rule);
		cursor: default;
	}
	/* The ring falls inside the frame, which clips what is outside it. */
	button:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: -3px;
	}
	.value-segment {
		display: inline-flex;
		align-items: center;
		padding: 0 var(--s-3);
		border-left: 1px solid var(--rule-strong);
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		color: var(--ink-3);
		white-space: nowrap;
	}
	@media (pointer: coarse), (max-width: 768px) {
		.pair {
			height: var(--veld-h-raak);
		}
		button {
			width: var(--veld-h-raak);
			font-size: var(--t-teken-raak);
		}
		.value-segment {
			font-size: var(--t-ui-raak);
		}
	}
</style>
