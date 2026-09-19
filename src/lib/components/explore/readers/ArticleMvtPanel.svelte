<script lang="ts">
	// Collapsible "Toelichting (MvT)" panel under an article. Fetches passages
	// on first open; full publication text loads per passage on request.
	import { getMvtContext, getPublicationText, type MvtPassage } from '$lib/api/mvt';

	let { bwbId, articleNumber }: { bwbId: string; articleNumber: string | null } = $props();

	type MvtState =
		| { kind: 'idle' }
		| { kind: 'loading' }
		| { kind: 'loaded'; passages: MvtPassage[] }
		| { kind: 'empty' }
		| { kind: 'error' };

	// Per passage: 'idle' (collapsed), 'loading', 'error', or the loaded text.
	type Expansion = 'idle' | 'loading' | 'error' | (string & {});

	let open = $state(false);
	let mvt = $state<MvtState>({ kind: 'idle' });
	let expansion = $state(new Map<string, Expansion>());

	function setExpansion(key: string, value: Expansion) {
		expansion = new Map(expansion).set(key, value);
	}

	function toggle() {
		open = !open;
		if (!open || mvt.kind !== 'idle' || !articleNumber) return;
		mvt = { kind: 'loading' };
		getMvtContext(bwbId, articleNumber)
			.then((res) => {
				mvt = res.total > 0 ? { kind: 'loaded', passages: res.passages } : { kind: 'empty' };
			})
			.catch(() => {
				mvt = { kind: 'error' };
			});
	}

	async function expandPassage(key: string) {
		const current = expansion.get(key);
		if (current && current !== 'idle') return;
		setExpansion(key, 'loading');
		try {
			const res = await getPublicationText(key);
			setExpansion(key, res.text ?? 'error');
		} catch {
			setExpansion(key, 'error');
		}
	}

	function paragraphs(text: string): string[] {
		return text.split(/\r?\n\s*\r?\n+/).filter((p) => p.trim());
	}
</script>

<div class="reader-mvt-wrap">
	<button type="button" class="reader-mvt-toggle" onclick={toggle} aria-expanded={open}>
		<span class="reader-mvt-label">Toelichting (MvT)</span>
		<span class="reader-mvt-chevron" class:open aria-hidden="true">›</span>
	</button>
	{#if open}
		<div class="reader-mvt-body">
			{#if mvt.kind === 'loading'}
				<p class="reader-mvt-status">Laden…</p>
			{:else if mvt.kind === 'loaded'}
				{#each mvt.passages as passage (passage.publication_key)}
					{@const expanded = expansion.get(passage.publication_key)}
					{@const label = passage.title ?? passage.soort ?? 'MvT'}
					<div class="reader-mvt-passage">
						<div class="reader-mvt-source">
							{#if passage.external_id}
								<a
									class="reader-mvt-source-link"
									href="https://zoek.officielebekendmakingen.nl/{passage.external_id}"
									target="_blank"
									rel="noopener noreferrer">{label}</a
								>
							{:else}
								<span>{label}</span>
							{/if}
							{#if passage.datum}
								<span class="reader-mvt-datum">· {passage.datum}</span>
							{/if}
						</div>
						{#if passage.snippet}
							<blockquote class="reader-mvt-snippet">{passage.snippet}</blockquote>
						{/if}
						<div class="reader-mvt-actions">
							{#if !expanded || expanded === 'idle'}
								<button
									type="button"
									class="reader-mvt-readmore"
									onclick={() => expandPassage(passage.publication_key)}
									>Lees volledig document ↓</button
								>
							{:else if expanded === 'loading'}
								<span class="reader-mvt-status">Laden…</span>
							{:else if expanded === 'error'}
								<span class="reader-mvt-status reader-mvt-status--error"
									>Kon document niet laden.</span
								>
							{:else}
								<button
									type="button"
									class="reader-mvt-readmore"
									onclick={() => setExpansion(passage.publication_key, 'idle')}
									>Verberg tekst ↑</button
								>
							{/if}
							{#if passage.external_id}
								<a
									href="https://zoek.officielebekendmakingen.nl/{passage.external_id}"
									target="_blank"
									rel="noopener noreferrer"
									class="reader-mvt-readmore reader-mvt-readmore--secondary">Bekijk origineel →</a
								>
							{/if}
						</div>
						{#if expanded && expanded !== 'idle' && expanded !== 'loading' && expanded !== 'error'}
							<div class="reader-mvt-fulltext">
								{#each paragraphs(expanded) as para, i (i)}
									<p class="reader-mvt-fulltext-para">{para}</p>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			{:else if mvt.kind === 'empty'}
				<p class="reader-mvt-status">Geen directe koppeling gevonden voor dit artikel.</p>
				<a
					href="https://zoek.officielebekendmakingen.nl/zoeken/resultaat/?q={encodeURIComponent(
						bwbId + ' memorie toelichting'
					)}&dt[0]=Kamerstuk"
					target="_blank"
					rel="noopener noreferrer"
					class="reader-mvt-readmore reader-mvt-readmore--link">Zoek memorie van toelichting →</a
				>
			{:else if mvt.kind === 'error'}
				<p class="reader-mvt-status">Toelichting kon niet worden geladen.</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.reader-mvt-wrap {
		margin-top: var(--s-6);
		border-top: 1px solid var(--rule);
		padding-top: var(--s-4);
	}

	.reader-mvt-toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: var(--s-2) var(--s-4);
		background: var(--paper-2);
		border: 1px solid var(--rule);
		border-radius: var(--r-1);
		cursor: pointer;
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--ink-3);
		text-align: left;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
	}

	.reader-mvt-toggle:hover {
		background: var(--paper-3);
		color: var(--ink);
	}

	.reader-mvt-label {
		flex: 1;
	}

	.reader-mvt-chevron {
		display: inline-block;
		font-size: 16px;
		line-height: 1;
		transition: transform var(--dur-1) var(--ease);
	}

	.reader-mvt-chevron.open {
		transform: rotate(90deg);
	}

	.reader-mvt-body {
		background: var(--paper-2);
		padding: var(--s-3) var(--s-4) var(--s-4);
	}

	.reader-mvt-passage {
		padding: var(--s-3) 0;
		border-top: 1px solid var(--rule);
	}

	.reader-mvt-passage:first-child {
		border-top: 0;
		padding-top: 0;
	}

	.reader-mvt-source {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 4px;
		font-family: var(--font-sans);
		font-size: 10px;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--ink-3);
		margin-bottom: 6px;
	}

	.reader-mvt-source-link {
		color: var(--ink-3);
		text-decoration: none;
		border-bottom: 1px solid var(--rule-strong);
		cursor: pointer;
	}

	.reader-mvt-source-link:hover {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}

	.reader-mvt-datum {
		color: var(--ink-4);
		text-transform: none;
		letter-spacing: 0;
	}

	.reader-mvt-snippet {
		margin: 0;
		padding: 0 0 0 var(--s-4);
		border-left: 2px solid var(--rule-strong);
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 15px;
		line-height: 1.55;
		color: var(--ink-2);
	}

	.reader-mvt-status {
		font-family: var(--font-sans);
		font-size: 13px;
		color: var(--fg-3);
		font-style: italic;
		margin: 0;
	}

	.reader-mvt-status--error {
		color: var(--accent);
		font-style: normal;
	}

	.reader-mvt-actions {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: var(--s-3);
		margin-top: var(--s-3);
	}

	.reader-mvt-readmore {
		display: inline-block;
		margin-top: var(--s-3);
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--ink-3);
		background: none;
		border: 0;
		border-bottom: 1px solid var(--rule-strong);
		cursor: pointer;
		padding: 0;
		letter-spacing: 0.04em;
		text-decoration: none;
	}

	.reader-mvt-readmore:hover {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}

	.reader-mvt-readmore--link {
		display: block;
		margin-top: var(--s-4);
	}

	.reader-mvt-readmore--secondary {
		color: var(--ink-4);
		border-bottom-color: var(--rule);
	}

	.reader-mvt-readmore--secondary:hover {
		color: var(--ink-3);
		border-bottom-color: var(--ink-3);
	}

	.reader-mvt-fulltext {
		margin-top: var(--s-3);
		padding-top: var(--s-3);
		border-top: 1px solid var(--rule);
		font-family: var(--font-serif);
		font-size: 15px;
		line-height: 1.62;
		color: var(--ink-2);
	}

	.reader-mvt-fulltext-para {
		margin: 0 0 1em;
	}

	.reader-mvt-fulltext-para:last-child {
		margin-bottom: 0;
	}
</style>
