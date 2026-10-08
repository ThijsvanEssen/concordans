<script lang="ts">
	// The one frame of every reader: the scroll container, the margins, the width of the
	// column and the load, empty and error states. A reader never sets its own padding,
	// width or scroll; the column it stands in sets them for all readers alike, through
	// --reader-pad-top, --reader-pad-left, --reader-pad-right and --reader-max
	// (explore/+page.svelte). So the text keeps its place and width whatever opens
	// beside it, and the scrollbar keeps its gutter whether or not the text scrolls.
	import { getContext, type Snippet } from 'svelte';
	import type { GraphNode } from '$lib/graph/types';
	import BehoortBij from '$lib/bron/BehoortBij.svelte';
	import { BEHOORT_KEY } from '$lib/bron/behoort';
	import { kop } from '$lib/stores/kop.svelte';

	let {
		status = 'ready',
		message = '',
		onRetry,
		children
	}: {
		status?: 'empty' | 'loading' | 'error' | 'ready';
		message?: string;
		/** Load again after an error: the API may have been out of reach for a moment. */
		onRetry?: () => void;
		children?: Snippet;
	} = $props();

	// Where the bron stands, above its text and before it loads (docs/hierarchie.md).
	const bron = getContext<(() => GraphNode) | undefined>(BEHOORT_KEY);

	// The title of the reader scrolled above the frame: the status bar names the bron then.
	let frame = $state<HTMLElement | null>(null);
	$effect(() => {
		kop.uitBeeld = false;
		if (status !== 'ready' || !frame) return;
		const titel = [...frame.querySelectorAll<HTMLElement>('h1, h2')].find(
			(h) => !h.closest('.behoort')
		);
		if (!titel) return;
		const kijk = new IntersectionObserver(
			([e]) => {
				kop.uitBeeld = !e.isIntersecting && e.boundingClientRect.top < (e.rootBounds?.top ?? 0);
			},
			{ root: frame }
		);
		kijk.observe(titel);
		return () => {
			kijk.disconnect();
			kop.uitBeeld = false;
		};
	});
</script>

<div class="reader-frame" bind:this={frame}>
	<div class="reader-frame__col">
		{#if bron && status !== 'empty'}<BehoortBij node={bron()} />{/if}
		{#if status === 'empty'}
			<div class="reader-empty">
				<p>Selecteer een artikel, uitspraak of parlementaire bron om de inhoud hier te lezen.</p>
			</div>
		{:else if status === 'loading'}
			<div class="reader-loading">
				<div class="skeleton-h"></div>
				<div class="skeleton-body"></div>
				<div class="skeleton-body skeleton-body--short"></div>
			</div>
		{:else if status === 'error'}
			<div class="reader-error" role="alert">
				<p>{message || 'De bron kon niet worden geladen.'}</p>
				{#if onRetry}
					<button type="button" class="btn is-text" onclick={onRetry}>Opnieuw</button>
				{/if}
			</div>
		{:else}
			{@render children?.()}
		{/if}
	</div>
</div>

<style>
	.reader-frame {
		height: 100%;
		overflow-y: auto;
		scrollbar-gutter: stable;
		padding: var(--reader-pad-top, var(--s-6)) var(--reader-pad-right, var(--s-6)) var(--s-8)
			var(--reader-pad-left, var(--s-6));
		box-sizing: border-box;
	}
	/* On a phone every reader has the width, 16 px from the edges. */
	@media (max-width: 768px) {
		.reader-frame {
			/* Set here, not only used: what reads them inside (a sticky bar) agrees. */
			--reader-pad-top: var(--s-5);
			--reader-pad-left: var(--s-4);
			--reader-pad-right: var(--s-4);
		}
	}
	/* Left in Lezen, beside the table of contents; centred where the column says so. */
	.reader-frame__col {
		max-width: var(--reader-max, 760px);
		min-height: 100%;
		margin-left: var(--reader-col-left, 0);
		margin-right: auto;
	}

	.reader-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		font-family: var(--font-serif);
		font-style: italic;
		font-size: var(--t-body);
		color: var(--ink-3);
		text-align: center;
		padding: var(--s-6);
	}

	/* Where the text would begin: the frame's own margins, no more. */
	.reader-error {
		padding: var(--s-5) 0;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}

	.reader-loading {
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
		padding: var(--s-5) 0;
	}

	.skeleton-h,
	.skeleton-body {
		border-radius: var(--r-1);
		background: linear-gradient(90deg, var(--paper-2) 25%, var(--rule) 50%, var(--paper-2) 75%);
		background-size: 200% 100%;
		animation: shimmer 1.4s infinite;
	}

	.skeleton-h {
		height: 32px;
		width: 60%;
	}

	.skeleton-body {
		height: 14px;
	}

	.skeleton-body--short {
		width: 70%;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}
</style>
