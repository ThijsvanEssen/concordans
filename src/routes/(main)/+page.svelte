<script lang="ts">
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import Search from '$lib/search/Search.svelte';
	import { bronPlural, type Collection } from '$lib/vocabulary';

	/** The ways into the material by kind; each opens Bladeren on that kind. */
	const KINDS: Collection[] = ['instruments', 'dossiers', 'judgments', 'committees'];
</script>

<svelte:head>
	<title>Concordans</title>
	<meta
		name="description"
		content="Nederlandse wetten, uitspraken en parlementaire stukken met hun onderlinge verbindingen."
	/>
</svelte:head>

<div class="home">
	<h1 class="sr-only">Concordans</h1>
	<Search />
	<nav class="kinds" aria-label="Bladeren">
		{#each KINDS as kind (kind)}
			<a class="kind no-underline" href="/explore?mode=index&kind={kind}">
				<KindGlyph collection={kind} />
				{bronPlural(kind)}
			</a>
		{/each}
	</nav>
</div>

<style>
	.home {
		width: 100%;
		max-width: 720px;
		min-height: calc(100vh - 64px - 320px);
		margin: 0 auto;
		padding: 18vh 32px 88px;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
	}

	.kinds {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 28px;
		margin-top: 20px;
		padding: 0 18px;
	}

	.kind {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-sans);
		font-size: 14px;
		color: var(--fg-2);
		text-decoration: none;
		border-bottom: none;
	}
	.kind:hover {
		color: var(--ink);
	}

	@media (max-width: 640px) {
		.home {
			padding: 48px 16px 64px;
		}
		.kinds {
			padding: 0 4px;
		}
	}
</style>
