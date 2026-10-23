<script lang="ts">
	// One row of Feiten: a label and its value. When the value is missing, label and value
	// drop out together; with `nodig` the label stays and the value reads "niet in de gegevens".
	import type { Snippet } from 'svelte';
	import Waarde, { ontbreekt } from './Waarde.svelte';

	let {
		label,
		value,
		nodig = false,
		children
	}: {
		label: string;
		/** Decides whether the row shows; shown as text when there are no children. */
		value: unknown;
		nodig?: boolean;
		/** The value in its own form: a link, a date, a list. */
		children?: Snippet;
	} = $props();
</script>

<!-- A label and its value in one group (a dl may hold them in a div): in the list of Feiten the
     group draws no box of its own, in its strip it is a cell. -->
{#if !ontbreekt(value)}
	<div class="field">
		<dt>{label}</dt>
		<dd>
			{#if children}{@render children()}{:else}{value}{/if}
		</dd>
	</div>
{:else if nodig}
	<div class="field">
		<dt>{label}</dt>
		<dd><Waarde value={null} nodig /></dd>
	</div>
{/if}
