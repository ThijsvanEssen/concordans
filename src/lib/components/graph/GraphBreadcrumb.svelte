<script lang="ts">
	import type { GraphNode } from '$lib/graph/types';

	let {
		breadcrumbs,
		onNavigate,
		onBack,
		onForward
	}: {
		breadcrumbs: GraphNode[];
		onNavigate: (nodeId: string) => void;
		onBack: () => void;
		onForward: () => void;
	} = $props();
</script>

<div class="breadcrumb">
	<div class="breadcrumb__nav">
		<button type="button" class="nav-btn" onclick={onBack} title="Terug (←)" aria-label="Terug">
			←
		</button>
		<button
			type="button"
			class="nav-btn"
			onclick={onForward}
			title="Vooruit (→)"
			aria-label="Vooruit"
		>
			→
		</button>
	</div>

	{#if breadcrumbs.length > 0}
		<ol class="breadcrumb__trail" aria-label="Navigatiegeschiedenis">
			{#each breadcrumbs as crumb, i (i)}
				<li class="breadcrumb__item" class:breadcrumb__item--current={i === breadcrumbs.length - 1}>
					{#if i < breadcrumbs.length - 1}
						<button type="button" class="breadcrumb__link" onclick={() => onNavigate(crumb.id)}>
							{crumb.label}
						</button>
						<span class="breadcrumb__sep" aria-hidden="true">›</span>
					{:else}
						<span class="breadcrumb__current">{crumb.label}</span>
					{/if}
				</li>
			{/each}
		</ol>
	{:else}
		<span class="breadcrumb__hint">Klik op een node om te navigeren</span>
	{/if}
</div>

<style>
	.breadcrumb {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: 0.4rem var(--space-2);
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		min-height: 40px;
		overflow: hidden;
	}

	.breadcrumb__nav {
		display: flex;
		gap: 0.25rem;
		flex-shrink: 0;
	}

	.nav-btn {
		background: none;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		font-size: var(--text-base);
		color: var(--ink-2);
		transition:
			background 100ms,
			border-color 100ms;
	}

	.nav-btn:hover {
		background: var(--accent-soft);
		border-color: var(--accent);
		color: var(--accent);
	}

	.breadcrumb__trail {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		align-items: center;
		gap: 0.2rem;
		overflow: hidden;
		flex: 1;
		min-width: 0;
	}

	.breadcrumb__item {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		min-width: 0;
		flex-shrink: 1;
	}

	.breadcrumb__link {
		background: none;
		border: none;
		color: var(--ink);
		font-size: var(--text-sm);
		cursor: pointer;
		padding: 0.1rem 0.3rem;
		border-radius: var(--radius-sm);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 160px;
		transition:
			color 100ms,
			background 100ms;
		border-bottom: 1px solid var(--rule-strong);
	}

	.breadcrumb__link:hover {
		color: var(--spine);
		background: var(--accent-soft);
		border-bottom-color: var(--spine);
	}

	.breadcrumb__sep {
		color: var(--border-strong);
		font-size: var(--text-sm);
		flex-shrink: 0;
	}

	.breadcrumb__current {
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 240px;
	}

	.breadcrumb__hint {
		font-size: var(--text-sm);
		color: var(--muted);
		font-style: italic;
	}
</style>
