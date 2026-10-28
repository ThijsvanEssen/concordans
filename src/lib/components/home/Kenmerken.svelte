<script lang="ts">
	// What Concordans does, in three small pictures with a line each: a search field, an
	// article with its Verbonden, the Knoppen Volg and Bewaar. Quiet, grey and ink, no data.
	// The server's HTML of `/` writes the same list (start.json, home.py); app.html sets it alike.
	import Picto from '$lib/components/ui/Picto.svelte';
	import { START } from './start';
</script>

<ul class="kenmerken">
	{#each START.features as feature (feature.visual)}
		<li>
			<span class="beeld beeld--{feature.visual}" aria-hidden="true">
				{#if feature.visual === 'zoek'}
					<span class="mini-zoek">art. 6:162 BW</span>
				{:else if feature.visual === 'lees'}
					<span class="mini-artikel">
						<span class="mini-tekst"><i></i><i></i><i></i></span>
						<span class="mini-verbonden"><em>Verbonden</em><i></i><i></i></span>
					</span>
				{:else}
					<span class="btn">Volg</span>
					<span class="btn"><Picto naam="bewaar" />Bewaar</span>
				{/if}
			</span>
			<span class="onderschrift">{feature.text}</span>
		</li>
	{/each}
</ul>

<style>
	.kenmerken {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--s-6);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
	}
	.beeld {
		display: flex;
		align-items: flex-start;
		gap: var(--s-2);
		height: 64px;
	}
	.mini-zoek {
		display: block;
		flex: 1;
		max-width: 220px;
		padding: var(--s-2) var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.mini-artikel {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
		flex: 1;
		max-width: 220px;
		height: 100%;
		border: 1px solid var(--rule);
		border-radius: var(--r-1);
	}
	.mini-tekst,
	.mini-verbonden {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: var(--s-1);
		padding: var(--s-2);
	}
	.mini-verbonden {
		border-left: 1px solid var(--rule);
	}
	.mini-verbonden em {
		font-size: var(--t-micro);
		font-style: normal;
		color: var(--ink-3);
	}
	.mini-artikel i {
		display: block;
		height: 4px;
		border-radius: var(--r-1);
		background: var(--rule);
	}
	.mini-verbonden i {
		width: 70%;
		background: var(--rule-strong);
	}
	.onderschrift {
		font-size: var(--t-body-2);
		line-height: var(--lh-snug);
		color: var(--ink);
	}
	@media (max-width: 640px) {
		.kenmerken {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--s-5);
		}
	}
</style>
