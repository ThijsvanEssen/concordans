<script lang="ts" module>
	import { isRateLimited, isSlow } from '$lib/api/errors';
	import { RATE_LIMIT_TEXT } from './RateLimit.svelte';

	/**
	 * The one sentence for a failure of `what` ("De inhoudsopgave", or with `plural` "De
	 * tekstversies"), slow, broken or asked too often.
	 */
	export function failureText(what: string, error: unknown, plural = false) {
		const verb = plural ? 'konden' : 'kon';
		if (isRateLimited(error)) return `${RATE_LIMIT_TEXT}.`;
		return isSlow(error)
			? `${what} ${verb} niet op tijd worden geladen.`
			: `${what} ${verb} niet worden geladen.`;
	}

	/** Nothing to show: no answer, or an empty list. */
	const isEmpty = (data: unknown) => data == null || (Array.isArray(data) && data.length === 0);
</script>

<script lang="ts" generics="T">
	// The one view of a LoadState: loading, a failure that says what failed (role="alert",
	// with Opnieuw where the caller can ask again, and the kenmerk of a 500) and the data. Empty is shown only from
	// ready, so a failure never reads as "niet in de gegevens". `line` stands quietly in
	// running text; `block` holds the place of a reader with a skeleton. A 429 counts down
	// its Retry-After and asks once again by itself; after that Opnieuw, once the wait is over.
	import { untrack, type Snippet } from 'svelte';
	import RateLimit, { answered } from './RateLimit.svelte';
	import type { LoadState } from '$lib/util/load.svelte';
	import Kenmerk from './Kenmerk.svelte';
	import TraagLaden from './TraagLaden.svelte';
	import TekstLink from './TekstLink.svelte';

	let {
		state,
		what,
		plural = false,
		retry,
		form = 'line',
		tag = 'p',
		empty,
		children
	}: {
		state: LoadState<T>;
		/** What fails, as the subject of the sentence: "De inhoudsopgave", "Het lid". */
		what: string;
		/** `what` is plural ("De tekstversies"): they konden niet worden geladen. */
		plural?: boolean;
		retry?: () => void;
		form?: 'line' | 'block';
		/** The element of a line: `span` inside running text or a card that is a span. */
		tag?: 'p' | 'span';
		empty?: Snippet;
		children?: Snippet<[T]>;
	} = $props();

	// A 429 asks again by itself once per subject; an answer gives that back.
	$effect(() => {
		if (state.status === 'ready') answered(untrack(() => what));
	});
</script>

{#if state.status === 'loading'}
	{#if form === 'block'}
		<div class="skeleton" aria-busy="true">
			<div class="skeleton__head"></div>
			<div class="skeleton__line"></div>
			<div class="skeleton__line skeleton__line--short"></div>
		</div>
		<TraagLaden label="Laden…" />
	{:else}
		<TraagLaden label="Laden…" zichtbaar {tag} />
	{/if}
{:else if state.status === 'error' && isRateLimited(state.error)}
	<!-- A 429: the seconds for the eye; a screen reader hears the sentence once. -->
	<RateLimit error={state.error} {what} {retry}>
		{#snippet children(wait, auto)}
			<svelte:element
				this={tag}
				class="stil failure"
				class:failure--block={form === 'block'}
				role="status"
			>
				{#if wait > 0}
					<span aria-hidden="true">{RATE_LIMIT_TEXT}, opnieuw over {wait} s.</span>
					<span class="sr-only">{RATE_LIMIT_TEXT}{auto ? ', zo meteen opnieuw' : ''}.</span>
				{:else}
					{RATE_LIMIT_TEXT}.
					{#if retry}<TekstLink onclick={retry}>Opnieuw</TekstLink>{/if}
				{/if}
			</svelte:element>
		{/snippet}
	</RateLimit>
{:else if state.status === 'error'}
	<svelte:element
		this={tag}
		class="stil failure"
		class:failure--block={form === 'block'}
		role="alert"
	>
		{failureText(what, state.error, plural)}
		{#if retry}
			<TekstLink onclick={retry}>Opnieuw</TekstLink>
		{/if}
		<Kenmerk error={state.error} />
	</svelte:element>
{:else if empty && isEmpty(state.data)}
	{@render empty()}
{:else}
	{@render children?.(state.data)}
{/if}

<style>
	.failure--block {
		padding: var(--s-5) 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}

	.skeleton {
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
		padding: var(--s-5) 0;
	}

	.skeleton__head,
	.skeleton__line {
		border-radius: var(--r-1);
		background: linear-gradient(90deg, var(--paper-2) 25%, var(--rule) 50%, var(--paper-2) 75%);
		background-size: 200% 100%;
		animation: shimmer 1.4s infinite;
	}

	.skeleton__head {
		height: var(--s-6);
		width: 60%;
	}

	.skeleton__line {
		height: var(--s-4);
	}

	.skeleton__line--short {
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
