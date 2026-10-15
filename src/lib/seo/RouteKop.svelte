<script lang="ts">
	// The title and description of a page from spa-routes.json, the list the server
	// serves the same head from, found by the page's own route. `title` replaces the fixed
	// title where the page has a name of its own (the topic of the Overzicht).
	import { page } from '$app/state';
	import { routeKop, routePath } from './routes';
	import { serverKop } from './server-head.svelte';

	let { title }: { title?: string } = $props();
	// Read once: the page that renders this is the route's own, and leaves with it.
	const kop = routeKop(routePath(page.route.id ?? ''));
</script>

<svelte:head>
	{#if !serverKop.actief}
		<title>{title ?? kop.title}</title>
		<meta name="description" content={kop.description} />
	{/if}
	{#if kop.index === false}<meta name="robots" content="noindex" />{/if}
</svelte:head>
