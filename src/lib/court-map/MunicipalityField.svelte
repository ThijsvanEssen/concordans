<script lang="ts">
	// The field of Indeling: a municipality by name, with the matches beneath it as a list to
	// choose from (Bergen, Noord-Holland and Bergen, Limburg tell themselves apart by their
	// province). Typing opens the list, the arrows and Enter choose, Escape closes; a tap outside
	// closes it through clickOutside (actions/top-layer.ts). "Wissen" empties the field.
	import { clickOutside } from '$lib/actions/top-layer';
	import Tekstveld from '$lib/components/ui/Tekstveld.svelte';
	import { findMunicipalities, sharesName, type Municipality } from './court-map';

	let {
		items,
		chosen,
		onChoose,
		onClear
	}: {
		items: readonly Municipality[];
		chosen: Municipality | null;
		onChoose: (m: Municipality) => void;
		onClear: () => void;
	} = $props();

	// A municipality chosen elsewhere (the address, a row of the table) fills the field.
	let typed = $derived(chosen?.name ?? '');
	let open = $state(false);
	let at = $state(0);
	let box: HTMLDivElement | undefined = $state();
	const matches = $derived(open ? findMunicipalities(items, typed) : []);
	const listed = $derived(open && typed.trim() !== '');

	$effect(() => {
		if (!open) return;
		return clickOutside(
			() => [box],
			() => (open = false)
		);
	});

	function choose(m: Municipality) {
		typed = m.name;
		open = false;
		onChoose(m);
	}
	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') open = false;
		else if (e.key === 'ArrowDown' && matches.length) {
			e.preventDefault();
			at = (at + 1) % matches.length;
		} else if (e.key === 'ArrowUp' && matches.length) {
			e.preventDefault();
			at = (at - 1 + matches.length) % matches.length;
		} else if (e.key === 'Enter' && matches[at]) {
			e.preventDefault();
			choose(matches[at]);
		}
	}
	function clear() {
		typed = '';
		open = false;
		onClear();
	}
</script>

<div class="field" bind:this={box}>
	<label for="gemeente">Gemeente</label>
	<div class="frame">
		<Tekstveld
			id="gemeente"
			value={typed}
			placeholder="Typ een gemeente"
			role="combobox"
			autocomplete="off"
			aria-expanded={listed}
			aria-controls="gemeente-lijst"
			aria-autocomplete="list"
			aria-activedescendant={listed && matches[at] ? `gemeente-${matches[at].code}` : undefined}
			oninput={(e) => {
				typed = e.currentTarget.value;
				at = 0;
				open = true;
			}}
			onkeydown={onKey}
		/>
		{#if typed}<button type="button" class="clear-btn" onclick={clear}>Wissen</button>{/if}
	</div>
	{#if listed}
		<ul id="gemeente-lijst" class="options" role="listbox" aria-label="Gemeenten">
			{#each matches as m, i (m.code)}
				<li id="gemeente-{m.code}" role="option" aria-selected={i === at} class:on={i === at}>
					<button type="button" tabindex="-1" onclick={() => choose(m)}
						>{m.name}{#if sharesName(items, m)}<span class="province">{m.province}</span
							>{/if}</button
					>
				</li>
			{:else}
				<li class="none">Geen gemeente met deze naam</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.field {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		width: 25rem;
		max-width: 100%;
	}
	label {
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.frame {
		position: relative;
	}
	.frame :global(.tekstveld) {
		padding-right: 5rem;
	}
	.clear-btn {
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		padding: 0 var(--s-3);
		border: 0;
		background: transparent;
		font: inherit;
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		color: var(--ink-2);
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}
	.options {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		z-index: 5;
		margin: var(--s-1) 0 0;
		padding: 0;
		list-style: none;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
	}
	.options li button {
		display: flex;
		gap: var(--s-2);
		align-items: center;
		width: 100%;
		min-height: var(--veld-h-raak);
		padding: 0 var(--s-3);
		border: 0;
		background: transparent;
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}
	.options li.on button,
	.options li button:hover {
		background: var(--paper-2);
	}
	.province {
		color: var(--ink-3);
	}
	.none {
		padding: var(--s-3);
		font-size: var(--t-ui);
		color: var(--ink-2);
	}
</style>
