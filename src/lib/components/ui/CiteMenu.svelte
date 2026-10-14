<script lang="ts">
	// Citeer, the same everywhere: a button that opens a menu of the forms to copy (kort,
	// voluit, met datum, link), with the keys of a menu, and Gekopieerd on the button.
	import type { Snippet } from 'svelte';
	import { report } from '$lib/api/errors';
	import { menu } from '$lib/actions/menu';
	import { topLayer } from '$lib/actions/top-layer';
	import Caret from './Caret.svelte';
	import { createCopier } from './copy.svelte';
	import type { CiteItem } from './cite';

	let {
		items,
		name,
		align = 'right',
		buttonClass = 'btn',
		caret = false,
		onToggle,
		onder
	}: {
		items: CiteItem[];
		/** What is cited, for the menu's label: `artikel 6:162 BW`, `overweging 4.2`. */
		name: string;
		/** The edge of the button the menu hangs from. */
		align?: 'left' | 'right';
		buttonClass?: string;
		caret?: boolean;
		/** Told when the menu opens or closes: the row it belongs to can stay raised. */
		onToggle?: (open: boolean) => void;
		/** Under the forms, after a rule: Kopieer tekst, the official text (Thijs, 10 Oct: two
		 *  actions in the head, the rest inside them). Given the function that closes it. */
		onder?: Snippet<[() => void]>;
	} = $props();

	let open = $state(false);
	let button = $state<HTMLElement | null>(null);
	const copier = createCopier();
	const setOpen = (value: boolean) => {
		open = value;
		onToggle?.(value);
	};

	function copy(text: string) {
		copier.copy(text, 'cite').catch((e) => report('Citeren', e));
		setOpen(false);
	}
</script>

{#if items.length > 0}
	<span class="cite" use:menu={{ open, close: () => setOpen(false) }}>
		<button
			type="button"
			class={buttonClass}
			bind:this={button}
			aria-haspopup="menu"
			aria-expanded={open}
			onclick={() => setOpen(!open)}
			>{copier.label('cite', 'Citeer')}{#if caret}<Caret {open} />{/if}</button
		>
		<span class="sr-only" aria-live="polite">{copier.announcement}</span>
		{#if open && button}
			<div
				class="tekstmenu__lijst is-breed pop"
				role="menu"
				aria-label="Citeer {name}"
				use:topLayer={{ anchor: button, align }}
			>
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
					<div class="tekstmenu__onder">{@render onder(() => setOpen(false))}</div>
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
		padding-block: var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 400;
	}
	.pop__label {
		padding: 0 var(--s-3) var(--s-2);
		font-size: var(--t-label);
		color: var(--ink-3);
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
