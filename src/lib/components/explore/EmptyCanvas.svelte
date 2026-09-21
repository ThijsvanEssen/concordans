<script lang="ts">
	import { useSearchOpener } from '$lib/stores/search-trigger';
	import { modKey } from '$lib/utils/platform';

	const openSearch = useSearchOpener();

	// Elke tegel opent de volledige wet (focus op het instrument). De Verkenner
	// laadt alle artikelen met de aangehaakte arresten en dossiers.
	const ENTRY_LAWS = [
		{
			mono: 'BW',
			name: 'Burgerlijk Wetboek',
			href: '/explore?focus=instruments%2Fbwbr0005289&from=search'
		},
		{
			mono: 'Sr',
			name: 'Wetboek van Strafrecht',
			href: '/explore?focus=instruments%2Fbwbr0001854&from=search'
		},
		{
			mono: 'Sv',
			name: 'Wetboek van Strafvordering',
			href: '/explore?focus=instruments%2Fbwbr0001903&from=search'
		},
		{
			mono: 'Awb',
			name: 'Algemene wet bestuursrecht',
			href: '/explore?focus=instruments%2Fbwbr0005537&from=search'
		},
		{ mono: 'Gw', name: 'Grondwet', href: '/explore?focus=instruments%2Fbwbr0001840&from=search' }
	];
</script>

<div class="empty-canvas" role="status" aria-label="Leeg netwerk: begin bij een bron">
	<div class="empty-inner">
		<h2 class="empty-title">Begin bij een bron</h2>
		<p class="empty-sub">
			Zoek een artikel, arrest, wet of dossier om het netwerk op te bouwen. De werking van de
			Verkenner staat onder <a href="/docs#aan-de-slag" class="empty-sub-link">Aan de slag</a>.
		</p>

		<button type="button" class="empty-search" onclick={openSearch}>
			<svg
				width="15"
				height="15"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				aria-hidden="true"
			>
				<circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
			</svg>
			<span>Zoek een artikel, arrest of wet…</span>
			<span class="empty-search__kbd">{modKey}K</span>
		</button>

		<div class="empty-laws">
			<p class="empty-laws__label">Of begin bij een wetboek:</p>
			<div class="empty-laws__grid">
				{#each ENTRY_LAWS as law, i (i)}
					<a class="empty-law no-underline" href={law.href} title={law.name}>
						<span class="empty-law__mono">{law.mono}</span>
						<span class="empty-law__name">{law.name}</span>
					</a>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	.empty-canvas {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2;
		pointer-events: none;
	}

	.empty-inner {
		pointer-events: auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--s-4, 16px);
		max-width: 480px;
		width: 100%;
		padding: 40px 32px;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2, 4px);
		box-shadow: 0 4px 24px rgba(20, 18, 14, 0.06);
	}

	.empty-title {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 22px;
		font-weight: 500;
		color: var(--ink);
		text-align: center;
	}

	.empty-sub {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 15px;
		color: var(--ink-3);
		text-align: center;
		line-height: 1.5;
	}

	.empty-sub-link {
		color: var(--ink-2);
		border-bottom: 1px solid var(--rule-strong);
		padding-bottom: 1px;
		transition:
			color var(--dur-1) var(--ease),
			border-color var(--dur-1) var(--ease);
	}
	.empty-sub-link:hover {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}

	.empty-search {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		height: 44px;
		padding: 0 14px;
		background: var(--paper-2);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1, 2px);
		font-family: var(--font-serif);
		font-size: 15px;
		font-style: italic;
		color: var(--ink-3);
		cursor: pointer;
		text-align: left;
		transition:
			border-color var(--dur-1) var(--ease),
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
	}

	.empty-search span:nth-child(2) {
		flex: 1;
	}

	.empty-search:hover {
		border-color: var(--ink);
		background: var(--paper-3);
		color: var(--ink);
	}

	.empty-search__kbd {
		font-family: var(--font-mono);
		font-style: normal;
		font-size: 10px;
		color: var(--fg-3);
		border: 1px solid var(--rule);
		padding: 2px 6px;
		border-radius: 3px;
		flex-shrink: 0;
	}

	.empty-laws {
		width: 100%;
	}

	.empty-laws__label {
		margin: 0 0 10px;
		font-family: var(--font-sans);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--fg-3);
	}

	.empty-laws__grid {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 6px;
	}

	.empty-law {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 10px 6px;
		background: var(--paper-2);
		border: 1px solid var(--rule);
		border-radius: var(--r-1, 2px);
		text-decoration: none;
		transition:
			background var(--dur-1) var(--ease),
			border-color var(--dur-1) var(--ease);
		overflow: hidden;
	}

	.empty-law:hover {
		background: var(--paper-3);
		border-color: var(--ink-3);
	}

	.empty-law__mono {
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--ink);
		font-weight: 500;
	}

	.empty-law__name {
		font-family: var(--font-sans);
		font-size: 9px;
		color: var(--fg-3);
		text-align: center;
		line-height: 1.3;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}

	@media (max-width: 480px) {
		.empty-inner {
			padding: 28px 20px;
		}
		.empty-laws__grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}
</style>
