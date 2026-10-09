<script lang="ts">
	// The title and description of a page from static/spa-routes.json, the list the server
	// serves the same head from. `title` replaces the fixed title where the page has a
	// name of its own (the topic of the Overzicht).
	import { routeKop } from './routes';
	import { serverKop } from './kop.svelte';

	let { pad, title }: { pad: string; title?: string } = $props();
	const kop = $derived(routeKop(pad));
</script>

<svelte:head>
	{#if !serverKop.actief}
		<title>{title ?? kop.title}</title>
		<meta name="description" content={kop.description} />
	{/if}
</svelte:head>
