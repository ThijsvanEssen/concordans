<script lang="ts">
	// The list of a menu, the one markup of every menu of the site (TekstMenu, Mijn, Volg, the ⋯
	// of a row): a `role="menu"` in the top layer under its button, closed by Escape and a tap
	// outside (actions/top-layer.ts, actions/menu.ts). The items are `tekstmenu__item`.
	import type { Snippet } from 'svelte';
	import { topLayer } from '$lib/actions/top-layer';

	let {
		anchor,
		label,
		close,
		align = 'left',
		wide = false,
		ownClick = false,
		children
	}: {
		/** The button it hangs from. */
		anchor: HTMLElement;
		/** What the menu is, for a screen reader. */
		label: string;
		close: () => void;
		/** The list opens to the left (`right`: from the right edge of the button). */
		align?: 'left' | 'right';
		/** A menu of options with their counts: as wide as a citation in full. */
		wide?: boolean;
		/** A click in the list is the menu's, not the row's under it. */
		ownClick?: boolean;
		children: Snippet;
	} = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	class="tekstmenu__lijst {wide ? 'is-breed' : ''}"
	role="menu"
	tabindex={ownClick ? -1 : undefined}
	aria-label={label}
	use:topLayer={{ anchor, close, align }}
	onclick={ownClick ? (e) => e.stopPropagation() : undefined}
>
	{@render children()}
</div>
