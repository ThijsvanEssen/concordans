<script lang="ts">
	// Search and sort, shared by every category of the index. The filters are in the
	// column beside the list (IndexFacets).
	import Caret from '$lib/components/ui/Caret.svelte';

	export type SortOption = { id: string; label: string };

	let {
		query,
		onQueryChange,
		searchPlaceholder = '',
		searchLabel = 'Zoeken',
		sortOptions = [],
		sort,
		onSortChange,
		dir,
		onDirToggle
	}: {
		query: string;
		onQueryChange: (v: string) => void;
		searchPlaceholder?: string;
		/** The name of the field; the placeholder goes once something is typed. */
		searchLabel?: string;
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
				aria-label={searchLabel}
				oninput={(e) => onQueryChange((e.currentTarget as HTMLInputElement).value)}
			/>
			{#if query}
				<button
					type="button"
					class="clear"
					aria-label="Wis de zoektekst"
					onclick={() => onQueryChange('')}>wis</button
				>
			{/if}
		</label>

		{#if sortOptions.length > 0}
			<span class="toolbar-sort">
				<span class="sort-lbl">Sorteer</span>
				<span class="sort-select">
					<select
						value={sort}
						onchange={(e) => onSortChange((e.currentTarget as HTMLSelectElement).value)}
						aria-label="Sorteer op"
					>
						{#each sortOptions as opt (opt.id)}
							<option value={opt.id}>{opt.label}</option>
						{/each}
					</select>
					<Caret />
				</span>
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
</div>

<style>
	.toolbar {
		margin-bottom: 18px;
		border: 1px solid var(--rule);
		background: var(--paper);
		border-radius: var(--r-2);
	}
	.toolbar-top {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 10px 14px;
	}
	.toolbar-search {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--ink-3);
		min-width: 0;
		border-radius: var(--r-1);
	}
	/* The field has no outline of its own: the ring is drawn around the search as a whole. */
	.toolbar-search:focus-within {
		outline: 2px solid var(--accent);
		outline-offset: 4px;
	}
	.toolbar-search input {
		flex: 1;
		border: 0;
		outline: none;
		background: transparent;
		font-family: var(--font-serif);
		font-size: var(--t-input);
		color: var(--ink);
		height: 28px;
		min-width: 0;
	}
	.toolbar-search input::placeholder {
		color: var(--ink-3);
		font-style: italic;
	}
	.toolbar-search .clear {
		border: 0;
		background: transparent;
		cursor: pointer;
		color: var(--ink-3);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		min-height: 24px;
		padding: 2px 6px;
		border-radius: var(--r-1);
	}
	.toolbar-search .clear:hover {
		color: var(--ink);
		background: var(--paper-2);
	}

	.toolbar-sort {
		display: inline-flex;
		align-items: baseline;
		gap: var(--s-2);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.sort-lbl {
		font-weight: 500;
	}
	/* The list reads as the other menus of the app: interface type, the one chevron. */
	.sort-select {
		position: relative;
		display: inline-flex;
		align-items: center;
		color: var(--ink-3);
	}
	.sort-select select {
		appearance: none;
		padding: 2px var(--s-4) 2px 0;
		border: 0;
		background: transparent;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		font-weight: 500;
		color: var(--ink);
		cursor: pointer;
	}
	.sort-select select:hover {
		color: var(--accent);
	}
	.sort-select :global(.caret) {
		position: absolute;
		right: 0;
		margin: 0;
		pointer-events: none;
	}
	.toolbar-sort .dir {
		border: 0;
		background: transparent;
		cursor: pointer;
		color: var(--ink-3);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		min-width: 24px;
		min-height: 24px;
		padding: 2px var(--s-1);
		border-radius: var(--r-1);
	}
	.toolbar-sort .dir:hover {
		color: var(--ink);
		background: var(--paper-2);
	}

	/* On a phone the search takes the whole line and the sort goes under it. */
	@media (max-width: 480px) {
		.toolbar-top {
			flex-wrap: wrap;
		}
		.toolbar-search {
			flex-basis: 100%;
		}
	}
</style>
