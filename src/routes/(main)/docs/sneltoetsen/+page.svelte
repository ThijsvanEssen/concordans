<script lang="ts">
	// Generated from the register of the keys (lib/keys/register.ts): the promise is what is bound.
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import Toetsen from '$lib/keys/Toetsen.svelte';
</script>

<RouteKop />

<div class="page-wrap">
	<div class="container blad blad--tekst">
		<nav class="stub-eyebrow" aria-label="Hoort bij"><a href="/docs">Documentatie</a></nav>
		<header class="blad__kop"><h1 class="blad__titel">Sneltoetsen</h1></header>
		<Toetsen />
	</div>
</div>
