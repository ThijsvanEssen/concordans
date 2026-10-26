<script lang="ts">
	// The one text field (docs/bediening.md): 32 px high in the sans at `t-ui`; on a phone 44 px
	// high at 16 px, below which iOS zooms in on focus. It names itself with a label (aria) or a
	// visible `<label for>` of its own; the placeholder says what can be typed, it is no label.
	// `multiline` is the reader's own note (Aantekening): several lines in the reader's letter.
	import type { HTMLInputAttributes } from 'svelte/elements';

	let {
		value = $bindable(''),
		el = $bindable(null),
		label,
		multiline = false,
		rows = 3,
		focus = false,
		selectAll = false,
		class: className = '',
		...rest
	}: Omit<HTMLInputAttributes, 'value' | 'class'> & {
		value?: string;
		/** The input (the textarea of `multiline`), for a caller that moves the focus to it. */
		el?: HTMLInputElement | HTMLTextAreaElement | null;
		/** What the field is, for a screen reader: `Zoek in dit stuk`. */
		label?: string;
		/** Several lines, in the serif at 16 px: a note of the reader's own. */
		multiline?: boolean;
		rows?: number;
		/** Takes the focus when it appears. */
		focus?: boolean;
		/** With `focus`: selects the text it holds. */
		selectAll?: boolean;
		class?: string;
	} = $props();

	/** What a textarea takes of the input's attributes. */
	const area: Record<string, unknown> = $derived(rest);

	$effect(() => {
		if (!focus || !el) return;
		el.focus();
		if (selectAll) el.select();
	});
</script>

{#if multiline}
	<textarea
		bind:this={el}
		bind:value
		{rows}
		class="tekstveld tekstveld--notitie {className}"
		aria-label={label}
		{...area}
	></textarea>
{:else}
	<input bind:this={el} bind:value class="tekstveld {className}" aria-label={label} {...rest} />
{/if}

<style>
	.tekstveld {
		display: block;
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		height: var(--veld-h);
		margin: 0;
		padding: 0 var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		color: var(--ink);
	}
	.tekstveld::placeholder {
		color: var(--ink-3);
	}
	.tekstveld:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 1px;
	}
	/* The reader's own words: the serif at 16 px, as high as its lines. */
	.tekstveld--notitie {
		height: auto;
		padding: var(--s-1) var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-input);
		line-height: var(--lh-body);
		resize: vertical;
	}
	/* A finger's 44 px: a field has no target outside its box. */
	@media (pointer: coarse), (max-width: 768px) {
		.tekstveld:not(.tekstveld--notitie) {
			height: var(--veld-h-raak);
			font-size: var(--t-input);
		}
	}
</style>
