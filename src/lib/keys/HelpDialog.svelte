<script lang="ts">
	// The window on Ctrl /, ⌘ /: the keys of the register by context, the one the reader is in
	// first. A Blad, so it is a dialog that holds the focus, closes on Esc and gives the focus
	// back to where the reader was.
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import Blad from '$lib/components/ui/Blad.svelte';
	import { answer } from './dispatch.svelte';
	import { help } from './help.svelte';
	import type { KeyContext } from './register';
	import ShortcutList from './ShortcutList.svelte';

	onMount(() =>
		answer('help', () => {
			help.open = !help.open;
		})
	);

	/** The group of keys of the page the reader is on. */
	function contextOf(url: URL): KeyContext | undefined {
		const mode = url.searchParams.get('mode');
		if (url.searchParams.has('lees')) return 'paneel';
		if (url.pathname === '/' || url.searchParams.has('q')) return 'zoeken';
		if (mode === 'netwerk' || mode === 'graph') return 'netwerk';
		if (mode === 'index') return 'bladeren';
		if (url.searchParams.has('focus') || /^\/(wetten|zaken|dossiers)\//.test(url.pathname))
			return 'lezer';
		return undefined;
	}
	const first = $derived(contextOf(page.url));
	function close() {
		help.open = false;
	}
</script>

{#if help.open}
	<Blad title="Sneltoetsen" onClose={close}>
		<div class="help"><ShortcutList {first} level={3} /></div>
	</Blad>
{/if}

<style>
	.help {
		padding: 0 var(--s-4) var(--s-4);
	}
</style>
