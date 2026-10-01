<script lang="ts">
	// One row of Feiten: a label and its value. When the value is missing, label and value
	// drop out together; with `nodig` the label stays and the value reads "niet in de gegevens".
	import type { Snippet } from 'svelte';
	import Waarde, { ontbreekt } from './Waarde.svelte';

	let {
		label,
		value,
		nodig = false,
		class: klasse = '',
		children
	}: {
		label: string;
		/** Decides whether the row shows; shown as text when there are no children. */
		value: unknown;
		nodig?: boolean;
		class?: string;
		/** The value in its own form: a link, a date, a list. */
		children?: Snippet;
	} = $props();
</script>

{#if !ontbreekt(value)}
	<dt>{label}</dt>
	<dd class={klasse}>
		{#if children}{@render children()}{:else}{value}{/if}
	</dd>
{:else if nodig}
	<dt>{label}</dt>
	<dd><Waarde value={null} nodig /></dd>
{/if}
