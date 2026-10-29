<script lang="ts">
	// The window on Ctrl /, ⌘ /: the keys of the register by context, the one the reader is in
	// first. A Blad, so it is a dialog that holds the focus, closes on Esc and gives the focus
	// back to where the reader was.
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import Blad from '$lib/components/ui/Blad.svelte';
	import { answer } from './dispatch.svelte';
	import { hulp } from './venster.svelte';
	import type { Context } from './register';
	import Toetsen from './Toetsen.svelte';

	onMount(() =>
		answer('hulp', () => {
			hulp.open = !hulp.open;
		})
	);

	/** The group of keys of the page the reader is on. */
	function hier(url: URL): Context | undefined {
		const mode = url.searchParams.get('mode');
		if (url.pathname === '/' || url.searchParams.has('q')) return 'zoeken';
		if (mode === 'netwerk' || mode === 'graph') return 'netwerk';
		if (mode === 'index') return 'bladeren';
		if (url.searchParams.has('focus') || /^\/(wetten|zaken|dossiers)\//.test(url.pathname))
			return 'lezer';
		return undefined;
	}
	const eerst = $derived(hier(page.url));
</script>

{#if hulp.open}
	<Blad title="Sneltoetsen" onClose={() => (hulp.open = false)}>
		<div class="hulp"><Toetsen {eerst} niveau={3} /></div>
	</Blad>
{/if}

<style>
	.hulp {
		padding: 0 var(--s-4) var(--s-4);
	}
</style>
