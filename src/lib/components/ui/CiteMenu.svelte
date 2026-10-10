<script lang="ts">
	// Citeer, the same everywhere: a button that opens a menu of the forms to copy (kort,
	// voluit, met datum, link), with the keys of a menu, and Gekopieerd on the button.
	import type { Snippet } from 'svelte';
	import { menu } from '$lib/actions/menu';
	import Caret from './Caret.svelte';
	import { createCopier } from './copy.svelte';
	import type { CiteItem } from './cite';

	let {
		items,
		name,
		align = 'right',
		drop = 'down',
		buttonClass = 'btn',
		caret = false,
		onToggle,
		onder
	}: {
		items: CiteItem[];
		/** What is cited, for the menu's label: `artikel 6:162 BW`, `overweging 4.2`. */
		name: string;
		/** The side of the button the menu hangs from. */
		align?: 'left' | 'right';
		/** Up for a button near the bottom of the screen, as in a card. */
		drop?: 'down' | 'up';
		buttonClass?: string;
		caret?: boolean;
		/** Told when the menu opens or closes: the row it belongs to can stay raised. */
		onToggle?: (open: boolean) => void;
		/** Under the forms, after a rule: Kopieer tekst, the official text (Thijs, 10 Oct: two
		 *  actions in the head, the rest inside them). Given the function that closes it. */
		onder?: Snippet<[() => void]>;
	} = $props();

	let open = $state(false);
	let wrap = $state<HTMLElement | null>(null);
	/** The side the menu hangs from: as asked, unless the column around it would cut it off. */
	let side = $state<'left' | 'right'>('right');
	$effect(() => {
		side = align;
		if (!open || !wrap) return;
		const pop = wrap.querySelector<HTMLElement>('[role="menu"]');
		let box: HTMLElement | null = wrap.parentElement;
		while (box && getComputedStyle(box).overflowX === 'visible') box = box.parentElement;
		if (!pop || !box) return;
		const edge = box.getBoundingClientRect();
		const r = pop.getBoundingClientRect();
		if (r.left < edge.left) side = 'left';
		else if (r.right > edge.right) side = 'right';
	});
	const copier = createCopier();
	const setOpen = (value: boolean) => {
		open = value;
		onToggle?.(value);
	};

	function copy(text: string) {
		void copier.copy(text, 'cite');
		setOpen(false);
	}
</script>

{#if items.length > 0}
	<span class="cite" bind:this={wrap} use:menu={{ open, close: () => setOpen(false) }}>
		<button
			type="button"
			class={buttonClass}
			aria-haspopup="menu"
			aria-expanded={open}
			onclick={() => setOpen(!open)}
			>{copier.label('cite', 'Citeer')}{#if caret}<Caret {open} />{/if}</button
		>
		<span class="sr-only" aria-live="polite">{copier.announcement}</span>
		{#if open}
			<div class="pop pop--{side} pop--{drop}" role="menu" aria-label="Citeer {name}">
				<div class="pop__label">Kopieer als</div>
				{#each items as item (item.kind)}
					<button
						type="button"
						role="menuitem"
						class="tekstmenu__item tekstmenu__item--paar"
						onclick={() => copy(item.text)}
						><span class:pop__link={item.kind === 'link'}>{item.text}</span><span class="pop__k"
							>{item.kind}</span
						></button
					>
				{/each}
				{#if onder}
					<div class="pop__onder">{@render onder(() => setOpen(false))}</div>
				{/if}
			</div>
		{/if}
	</span>
{/if}

<style>
	.cite {
		position: relative;
		display: inline-flex;
	}
	.pop {
		position: absolute;
		top: calc(100% + var(--s-1));
		z-index: var(--z-float);
		width: min(340px, 90vw);
		padding: var(--s-2) 0;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		box-shadow: var(--shadow-modal);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 400;
		text-align: left;
	}
	.pop--up {
		top: auto;
		bottom: calc(100% + var(--s-1));
	}
	.pop--right {
		right: 0;
	}
	.pop--left {
		left: 0;
	}
	.pop__label {
		padding: 0 var(--s-3) var(--s-2);
		font-size: var(--t-label);
		color: var(--ink-3);
	}
	.pop__onder {
		margin-top: var(--s-1);
		padding-top: var(--s-1);
		border-top: 1px solid var(--rule);
	}
	.pop__k {
		flex: none;
		font-size: var(--t-label);
		color: var(--ink-3);
	}
	.pop__link {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
