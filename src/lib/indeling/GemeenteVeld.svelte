<script lang="ts">
	// The field of Indeling: a municipality by name, with the matches beneath it as a list to
	// choose from (Bergen, Noord-Holland and Bergen, Limburg tell themselves apart by their
	// province). Typing opens the list, the arrows and Enter choose, Escape closes; a tap outside
	// closes it in the capture phase, so a touch on the canvas or a link beneath does not leave
	// it open (actions/menu.ts). "Wissen" empties the field.
	import Tekstveld from '$lib/components/ui/Tekstveld.svelte';
	import { findGemeenten, sharesName, type Gemeente } from './indeling';

	let {
		items,
		chosen,
		onChoose,
		onClear
	}: {
		items: readonly Gemeente[];
		chosen: Gemeente | null;
		onChoose: (g: Gemeente) => void;
		onClear: () => void;
	} = $props();

	let typed = $state('');
	let open = $state(false);
	let at = $state(0);
	let box: HTMLDivElement | undefined = $state();
	const shown = $derived(typed);
	const matches = $derived(open ? findGemeenten(items, typed) : []);
	const listed = $derived(open && typed.trim() !== '');

	// A municipality chosen elsewhere (the address, a row of the table) fills the field.
	$effect(() => {
		typed = chosen?.name ?? '';
	});
	$effect(() => {
		if (!open) return;
		const away = (e: Event) => {
			if (box && e.target instanceof Node && !box.contains(e.target)) open = false;
		};
		document.addEventListener('pointerdown', away, true);
		return () => document.removeEventListener('pointerdown', away, true);
	});

	function choose(g: Gemeente) {
		typed = g.name;
		open = false;
		onChoose(g);
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

<div class="veld" bind:this={box}>
	<label class="etiket" for="gemeente">Gemeente</label>
	<div class="kader">
		<Tekstveld
			id="gemeente"
			value={shown}
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
		{#if shown}<button type="button" class="wis" onclick={clear}>Wissen</button>{/if}
	</div>
	{#if listed}
		<ul id="gemeente-lijst" class="lijst" role="listbox" aria-label="Gemeenten">
			{#each matches as g, i (g.code)}
				<li id="gemeente-{g.code}" role="option" aria-selected={i === at} class:op={i === at}>
					<button type="button" tabindex="-1" onclick={() => choose(g)}
						>{g.name}{#if sharesName(items, g)}<span class="provincie">{g.province}</span
							>{/if}</button
					>
				</li>
			{:else}
				<li class="geen">Geen gemeente met deze naam</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.veld {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		width: 25rem;
		max-width: 100%;
	}
	.etiket {
		font-family: var(--font-ui);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.kader {
		position: relative;
	}
	.kader :global(.tekstveld) {
		padding-right: 5rem;
	}
	.wis {
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
	.lijst {
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
	.lijst li button {
		display: flex;
		gap: var(--s-2);
		align-items: baseline;
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
		align-items: center;
	}
	.lijst li.op button,
	.lijst li button:hover {
		background: var(--paper-2);
	}
	.provincie {
		color: var(--ink-3);
	}
	.geen {
		padding: var(--s-3);
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		color: var(--ink-2);
	}
</style>
