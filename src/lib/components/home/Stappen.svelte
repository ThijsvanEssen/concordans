<script lang="ts">
	// The three steps of the start page, a plan that stands forward: one framed block, three
	// numbered parts with an arrow between them (under each other on a phone). The server's
	// HTML of `/` writes the same list (start.json, home.py); app.html sets it alike.
	import Picto from '$lib/components/ui/Picto.svelte';
	import { START } from './start';
</script>

<ol class="stappen">
	{#each START.steps as step (step.title)}
		<li>
			<span class="beeld beeld--{step.visual}" aria-hidden="true">
				{#if step.visual === 'zoek'}
					<span class="mini-zoek">art. 6:162 BW</span>
				{:else if step.visual === 'lees'}
					<span class="mini-artikel">
						<span class="mini-tekst"><i></i><i></i><i></i></span>
						<span class="mini-verbonden"><em>Verbonden</em><i></i><i></i></span>
					</span>
				{:else}
					<span class="btn">Volg</span>
					<span class="btn"><Picto naam="bewaar" />Bewaar</span>
				{/if}
			</span>
			<b>{step.title}</b>
			{step.text}
		</li>
	{/each}
</ol>

<style>
	.stappen {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		margin: 0;
		padding: 0;
		list-style: none;
		counter-reset: stap;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
		color: var(--ink-2);
	}
	li {
		position: relative;
		counter-increment: stap;
		padding: var(--s-4);
	}
	li + li {
		border-left: 1px solid var(--rule);
	}
	li::before {
		content: counter(stap);
		display: block;
		margin-bottom: var(--s-1);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	b {
		display: block;
		margin-bottom: var(--s-1);
		font-size: var(--t-body-2);
		font-weight: 600;
		color: var(--ink);
	}
	/* The picture of a step: small, quiet, in ink and grey, with no data (the real forms of
	   the search field, the article with Verbonden, the Knoppen). */
	.beeld {
		display: flex;
		align-items: flex-start;
		gap: var(--s-2);
		height: 64px;
		margin-bottom: var(--s-3);
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
	/* The arrow on the rule between two parts. */
	li + li::after {
		content: '→';
		position: absolute;
		top: var(--s-4);
		left: 0;
		padding: 0 var(--s-1);
		transform: translateX(-50%);
		background: var(--paper);
		color: var(--ink-3);
	}
	@media (max-width: 640px) {
		.stappen {
			grid-template-columns: minmax(0, 1fr);
		}
		li + li {
			border-top: 1px solid var(--rule);
			border-left: 0;
		}
		li + li::after {
			content: '↓';
			top: 0;
			left: var(--s-4);
			transform: translateY(-50%);
		}
	}
</style>
