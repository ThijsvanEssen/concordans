<script lang="ts">
	// Toolbar shared by every category of the index: search and sort on top,
	// below either filter pills or a custom filter snippet (the stage
	// filter of dossiers).

	export type Facet =
		| { sep: true }
		| {
				id: string;
				label: string;
				on: boolean;
				count?: number;
				swatch?: string;
				onClick: () => void;
		  };

	export type SortOption = { id: string; label: string };

	let {
		query,
		onQueryChange,
		searchPlaceholder = '',
		facets = null,
		customFilter = null,
		sortOptions = [],
		sort,
		onSortChange,
		dir,
		onDirToggle
	}: {
		query: string;
		onQueryChange: (v: string) => void;
		searchPlaceholder?: string;
		facets?: Facet[] | null;
		/** Render een willekeurig fragment (snippet) in plaats van facets. */
		customFilter?: import('svelte').Snippet | null;
		sortOptions?: SortOption[];
		sort: string;
		onSortChange: (v: string) => void;
		/** Only for a sort the client does; the server fixes the direction of its own. */
		dir?: 'asc' | 'desc';
		onDirToggle?: () => void;
	} = $props();
</script>

<div class="toolbar">
	<div class="toolbar-top">
		<label class="toolbar-search">
			<svg
				width="15"
				height="15"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.6"
				aria-hidden="true"
			>
				<circle cx="11" cy="11" r="7" />
				<line x1="20" y1="20" x2="16.5" y2="16.5" />
			</svg>
			<input
				type="search"
				value={query}
				placeholder={searchPlaceholder}
				oninput={(e) => onQueryChange((e.currentTarget as HTMLInputElement).value)}
			/>
			{#if query}
				<button type="button" class="clear" onclick={() => onQueryChange('')}>wis</button>
			{/if}
		</label>

		{#if sortOptions.length > 0}
			<span class="toolbar-sort">
				<span class="sort-lbl">Sorteer</span>
				<select
					value={sort}
					onchange={(e) => onSortChange((e.currentTarget as HTMLSelectElement).value)}
					aria-label="Sorteer op"
				>
					{#each sortOptions as opt (opt.id)}
						<option value={opt.id}>{opt.label}</option>
					{/each}
				</select>
				{#if dir && onDirToggle}
					<button
						type="button"
						class="dir"
						onclick={onDirToggle}
						title={dir === 'asc' ? 'Oplopend' : 'Aflopend'}
						aria-label={dir === 'asc' ? 'Sorteer aflopend' : 'Sorteer oplopend'}
						>{dir === 'asc' ? '↑' : '↓'}</button
					>
				{/if}
			</span>
		{/if}
	</div>

	{#if customFilter}
		<div class="toolbar-bot toolbar-bot--custom">
			{@render customFilter()}
		</div>
	{:else if facets && facets.length > 0}
		<div class="toolbar-bot">
			<span class="filter-lbl">Filter</span>
			<span class="pills">
				{#each facets as f, i (!('id' in f) ? `s${i}` : f.id)}
					{#if !('id' in f)}
						<span class="pills-sep" aria-hidden="true"></span>
					{:else}
						<button type="button" class="pill-btn" class:pill-btn--on={f.on} onclick={f.onClick}>
							{#if f.swatch}
								<span class="pill-swatch" style:background={f.swatch}></span>
							{/if}
							<span class="pill-label">{f.label}</span>
							{#if f.count !== undefined}
								<span class="pill-count">{f.count}</span>
							{/if}
						</button>
					{/if}
				{/each}
			</span>
		</div>
	{/if}
</div>

<style>
	.toolbar {
		margin-bottom: 18px;
		border: 1px solid var(--rule);
		background: var(--paper);
		border-radius: 2px;
	}
	.toolbar-top {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 10px 14px;
		border-bottom: 1px solid var(--rule);
	}
	.toolbar-search {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--fg-3);
		min-width: 0;
	}
	.toolbar-search input {
		flex: 1;
		border: 0;
		outline: none;
		background: transparent;
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--ink);
		height: 28px;
		min-width: 0;
	}
	.toolbar-search input::placeholder {
		color: var(--fg-4);
		font-style: italic;
	}
	.toolbar-search .clear {
		border: 0;
		background: transparent;
		cursor: pointer;
		color: var(--fg-4);
		font-family: var(--font-sans);
		font-size: 11px;
		padding: 2px 6px;
		border-radius: 2px;
	}
	.toolbar-search .clear:hover {
		color: var(--ink);
		background: var(--paper-2);
	}

	.toolbar-sort {
		display: inline-flex;
		align-items: baseline;
		gap: 8px;
		font-family: var(--font-sans);
		font-size: 11px;
		letter-spacing: 0.04em;
		color: var(--fg-3);
	}
	.sort-lbl {
		text-transform: uppercase;
	}
	.toolbar-sort select {
		font-family: var(--font-serif);
		font-size: 14px;
		color: var(--ink);
		font-style: italic;
		background: transparent;
		border: 0;
		padding: 2px 18px 2px 4px;
		cursor: pointer;
		outline: none;
		appearance: none;
		background-image:
			linear-gradient(45deg, transparent 50%, var(--fg-3) 50%),
			linear-gradient(135deg, var(--fg-3) 50%, transparent 50%);
		background-position:
			calc(100% - 8px) 9px,
			calc(100% - 4px) 9px;
		background-size:
			4px 4px,
			4px 4px;
		background-repeat: no-repeat;
	}
	.toolbar-sort .dir {
		border: 0;
		background: transparent;
		cursor: pointer;
		color: var(--fg-3);
		font-family: var(--font-mono);
		font-size: 13px;
		padding: 2px 4px;
		border-radius: 2px;
	}
	.toolbar-sort .dir:hover {
		color: var(--ink);
		background: var(--paper-2);
	}

	.toolbar-bot {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 10px 14px;
		flex-wrap: wrap;
	}
	.toolbar-bot--custom {
		padding: 4px 14px 8px;
	}

	.filter-lbl {
		font-family: var(--font-sans);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-3);
	}

	.pills {
		display: inline-flex;
		gap: 6px;
		flex-wrap: wrap;
		align-items: center;
	}
	.pill-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 26px;
		padding: 0 12px;
		border: 1px solid var(--rule-strong);
		border-radius: 999px;
		background: var(--paper);
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--ink-2);
		cursor: pointer;
		line-height: 1;
		transition:
			background 120ms,
			color 120ms,
			border-color 120ms;
	}
	.pill-btn:hover {
		background: var(--paper-2);
		border-color: var(--ink-3);
	}
	.pill-btn--on {
		background: var(--ink);
		color: var(--paper);
		border-color: var(--ink);
	}
	.pill-count {
		font-family: var(--font-mono);
		font-size: 10.5px;
		color: var(--fg-4);
		line-height: 1;
	}
	.pill-btn--on .pill-count {
		color: var(--paper);
		opacity: 0.65;
	}
	.pill-swatch {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.pills-sep {
		width: 1px;
		height: 18px;
		background: var(--rule);
		align-self: center;
		display: inline-block;
	}
</style>
