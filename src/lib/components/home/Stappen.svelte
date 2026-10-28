<script lang="ts">
	// The three steps of the start page, a plan that stands forward: one framed block, three
	// numbered parts with an arrow between them (under each other on a phone). The server's
	// HTML of `/` writes the same list (start.json, home.py); app.html sets it alike.
	import { START } from './start';
</script>

<ol class="stappen">
	{#each START.steps as step (step.title)}
		<li><b>{step.title}</b> {step.text}</li>
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
