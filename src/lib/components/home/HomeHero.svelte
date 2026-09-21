<script lang="ts">
	import { useSearchOpener } from '$lib/stores/search-trigger';
	import { modKey } from '$lib/utils/platform';
	const openSearch = useSearchOpener();
</script>

<section class="hero">
	<div class="hero__content">
		<div class="hero__copy">
			<p class="hero__eyebrow">Concordans</p>
			<h1>Krijg grip op de wet.</h1>
			<p class="hero__subtitle">
				Zoek artikelen en uitspraken, en zie hoe ze met elkaar verbonden zijn.
			</p>
		</div>
		<button type="button" class="hero__search-cta" onclick={openSearch}>
			<svg
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				aria-hidden="true"
			>
				<circle cx="11" cy="11" r="7" />
				<path d="m20 20-3.5-3.5" />
			</svg>
			<span class="hero__search-cta-text">Zoek in het netwerk…</span>
			<span class="hero__search-cta-kbd">{modKey}K</span>
		</button>
	</div>
</section>

<style>
	.hero {
		width: 100%;
		padding: var(--space-4) 0 var(--space-3);
	}

	.hero__content {
		width: min(1040px, 100%);
		margin: 0 auto;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-card);
		padding: 2.5rem;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.hero__eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.18em;
		font-size: 0.75rem;
		color: var(--muted);
		margin: 0 0 0.25rem;
	}

	h1 {
		font-size: clamp(2.5rem, 4vw, 3.75rem);
		margin: 0;
	}

	.hero__subtitle {
		margin: 0;
		font-size: 1.15rem;
		color: var(--muted);
	}

	/* CTA replaces the inline form — opens the global search overlay so the
     homepage doesn't fork a second search surface. */
	.hero__search-cta {
		display: inline-flex;
		align-items: center;
		gap: 12px;
		padding: 14px 18px;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2, 6px);
		cursor: pointer;
		font-family: var(--font-serif, serif);
		font-size: 17px;
		color: var(--ink-3, #6b6558);
		width: 100%;
		text-align: left;
		transition:
			border-color var(--dur-1) var(--ease),
			background var(--dur-1) var(--ease);
	}
	.hero__search-cta:hover {
		border-color: var(--ink);
		background: var(--paper-3);
		color: var(--ink);
	}
	.hero__search-cta-text {
		flex: 1;
		font-style: italic;
	}
	.hero__search-cta-kbd {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--fg-3, #6b6558);
		border: 1px solid var(--rule);
		padding: 2px 7px;
		border-radius: 4px;
	}

	@media (max-width: 720px) {
		.hero__content {
			padding: var(--space-3);
		}
	}
</style>
