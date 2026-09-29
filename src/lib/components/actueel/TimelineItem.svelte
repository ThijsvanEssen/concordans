<script lang="ts">
	// One line of the homepage's Actueel: its kind in small capitals, a headline in plain
	// words and one line of context. The whole line is one link.
	import { bronHref } from '$lib/bron/href';
	import type { TimelineLine } from './timeline';

	let { line }: { line: TimelineLine } = $props();

	const href = $derived(typeof line.href === 'string' ? line.href : bronHref(line.href));
</script>

<li class="line" class:line--major={line.major}>
	<a {href}>
		<span class="label" class:label--failed={line.failed}>{line.label}</span>
		<span class="title">{line.title}</span>
		{#if line.context}<span class="context">{line.context}</span>{/if}
	</a>
</li>

<style>
	.line {
		border-bottom: 1px solid var(--rule);
	}
	a {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		padding: var(--s-4) 0;
		color: inherit;
		text-decoration: none;
	}
	.line--major a {
		padding: var(--s-5) 0;
	}
	.label {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
	}
	.label--failed {
		color: var(--accent);
	}
	.title {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: var(--lh-snug);
		color: var(--ink-2);
		text-wrap: pretty;
	}
	/* What matters on a day: the headline in the size of a heading, in ink. */
	.line--major .title {
		font-size: var(--t-h3);
		font-weight: 500;
		line-height: 1.3;
		color: var(--ink);
	}
	a:hover .title {
		color: var(--accent);
	}
	.context {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		line-height: 1.5;
		color: var(--ink-3);
	}

	@media (max-width: 640px) {
		.line--major .title {
			font-size: var(--t-body);
		}
	}
</style>
