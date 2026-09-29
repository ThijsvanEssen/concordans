<script lang="ts">
	// `Ingediend door X (fractie), mede namens Y (fractie) en Z (fractie)`: each name a link
	// to the member, each fractie to the fractie. `max` shortens the medeindieners to
	// `en N anderen`, for a line in a list.
	import NameLink from './NameLink.svelte';
	import { groupSubmitters, joinerOf, type Submitter } from './submitters';

	let { submitters, max }: { submitters: Submitter[]; max?: number } = $props();

	const groups = $derived(groupSubmitters(submitters));
	const shown = $derived(max === undefined ? groups.with : groups.with.slice(0, max));
	const rest = $derived(groups.with.length - shown.length);
	const restLine = $derived(rest ? ` en ${rest} ${rest === 1 ? 'ander' : 'anderen'}` : '');
	const withLead = $derived(groups.by.length ? ', mede namens ' : 'Mede namens ');
	/** Before the fractie: the markup around a link keeps no space of its own. */
	const OPEN = ' (';
</script>

{#snippet person(s: Submitter)}
	<NameLink collection="members" name={s.name} key={s.memberKey} />{#if s.faction}{OPEN}<NameLink
			collection="factions"
			name={s.faction}
			key={s.factionKey}
		/>){/if}
{/snippet}

{#snippet list(people: Submitter[], more: boolean)}
	{#each people as s, i (i)}{joinerOf(i, people.length, more)}{@render person(s)}{/each}
{/snippet}

{#if groups.by.length || shown.length}
	<span class="submitters">
		{#if groups.by.length}Ingediend door {@render list(
				groups.by,
				false
			)}{/if}{#if shown.length}{withLead}{@render list(shown, rest > 0)}{restLine}{/if}
	</span>
{/if}
