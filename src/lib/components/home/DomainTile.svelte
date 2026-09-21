<script lang="ts">
	let {
		title,
		description,
		example,
		exploreHref,
		accentColor = 'var(--accent)'
	}: {
		title: string;
		description: string;
		example: string;
		exploreHref: string;
		accentColor?: string;
	} = $props();
</script>

<a href={exploreHref} class="domain-tile" style="--tile-accent: {accentColor}">
	<div class="domain-tile__body">
		<h3 class="domain-tile__title">{title}</h3>
		<p class="domain-tile__desc">{description}</p>
	</div>
	<div class="domain-tile__footer">
		<span class="domain-tile__example">{example}</span>
		<span class="domain-tile__cta" aria-hidden="true">Verkennen →</span>
	</div>
</a>

<style>
	.domain-tile {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: var(--space-2);
		padding: var(--space-3);
		background: var(--paper-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-card);
		text-decoration: none;
		color: inherit;
		transition:
			border-color 150ms,
			box-shadow 150ms,
			transform 150ms;
		min-height: 160px;
		border-left: 3px solid var(--tile-accent);
		box-shadow: var(--shadow-sm);
	}

	.domain-tile:hover {
		border-color: var(--tile-accent);
		box-shadow: var(--shadow-md);
		transform: translateY(-2px);
		text-decoration: none;
	}

	.domain-tile__body {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.domain-tile__title {
		margin: 0;
		font-size: var(--text-xl);
		font-weight: 600;
		color: var(--ink);
	}

	.domain-tile__desc {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--muted);
		line-height: 1.5;
	}

	.domain-tile__footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-1);
	}

	.domain-tile__example {
		font-size: var(--text-xs);
		font-family: var(--font-mono);
		color: var(--muted);
		background: var(--bg);
		padding: 0.15em 0.5em;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
		flex-shrink: 1;
	}

	.domain-tile__cta {
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--tile-accent);
	}
</style>
