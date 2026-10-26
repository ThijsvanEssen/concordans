<script lang="ts">
	// Mijn at the right of the top bar: a menu of Bundels and Gevolgd, what the reader keeps
	// and follows. A sign on it (NewMark) until the reader has been at the item that has one.
	import { menu } from '$lib/actions/menu';
	import { page } from '$app/state';
	import Caret from '$lib/components/ui/Caret.svelte';
	import MenuList from '$lib/components/ui/MenuList.svelte';
	import NewMark from '$lib/components/ui/NewMark.svelte';
	import { sign } from '$lib/bevestig/bevestig.svelte';
	import { MINE, mineAt } from '$lib/nav/mine';

	let open = $state(false);
	let button = $state<HTMLElement | null>(null);
	const close = () => (open = false);
	const current = $derived(mineAt(page.url.pathname));
</script>

<div class="mijn" use:menu={{ open, close }}>
	<button
		type="button"
		class="mijn__knop"
		class:is-active={current !== null}
		bind:this={button}
		aria-haspopup="menu"
		aria-expanded={open}
		onclick={() => (open ? close() : (open = true))}
		>Mijn{#if !open && (sign.has('bundels') || sign.has('gevolgd'))}<NewMark />{/if}<Caret
			{open}
		/></button
	>
	{#if open && button}
		<MenuList anchor={button} label="Mijn" {close} align="right">
			{#each MINE as m (m.id)}
				<a
					href={m.href}
					role="menuitem"
					class="tekstmenu__item"
					aria-current={current === m.id ? 'page' : undefined}
					onclick={close}
					>{m.label}{#if sign.has(m.id)}<NewMark />{/if}</a
				>
			{/each}
		</MenuList>
	{/if}
</div>

<style>
	.mijn {
		position: relative;
		display: inline-flex;
	}
	/* Beside the links of the bar, in their sans: a menu that reads as one of them. */
	.mijn__knop {
		display: inline-flex;
		align-items: center;
		gap: var(--s-1);
		height: var(--veld-h);
		padding: 0 var(--s-2);
		border: 0;
		background: none;
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		font-weight: 500;
		color: var(--ink-3);
		cursor: pointer;
	}
	.mijn__knop:hover,
	.mijn__knop:focus-visible,
	.mijn__knop.is-active,
	.mijn__knop[aria-expanded='true'] {
		color: var(--ink);
	}
</style>
