<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// The kind list comes from the unfiltered result; a filtered result would offer one kind only.
	let kinds = $state<string[]>([]);
	$effect(() => {
		if (data.kind) return;
		const counts = new Map<string, number>();
		for (const d of data.documents) if (d.kind) counts.set(d.kind, (counts.get(d.kind) ?? 0) + 1);
		kinds = [...counts].sort((a, b) => b[1] - a[1]).map(([kind]) => kind);
	});

	let form: HTMLFormElement;
	function submit() {
		const params = new URLSearchParams();
		for (const [name, value] of new FormData(form)) if (value) params.set(name, String(value));
		goto(`?${params}`, { keepFocus: true });
	}
</script>

<svelte:head>
	<title>Parlementaire documenten. Concordans.</title>
</svelte:head>

<div class="pubs-shell">
	{#if data.error}
		<div class="pubs-error">
			<p class="pubs-error-title">Niet beschikbaar</p>
			<p class="pubs-error-msg">{data.error}</p>
		</div>
	{/if}

	<header class="pubs-header">
		<div class="pubs-top">
			<a href="/" class="pubs-back">← Terug</a>
			<div class="pubs-top-right">
				<h1 class="pubs-title">
					<span class="pubs-sigil" aria-hidden="true">‡</span>
					Parlementaire documenten
				</h1>
			</div>
		</div>

		<form
			class="pubs-controls"
			bind:this={form}
			onsubmit={(e) => {
				e.preventDefault();
				submit();
			}}
		>
			<input
				type="search"
				name="q"
				class="pubs-search"
				placeholder="Zoek op titel of soort"
				value={data.q}
				autocomplete="off"
				spellcheck="false"
			/>
			<select name="kind" class="pubs-select" aria-label="Soort" onchange={submit}>
				<option value="">Alle soorten</option>
				{#each kinds as kind (kind)}
					<option value={kind} selected={kind === data.kind}>{kind}</option>
				{/each}
			</select>
			<select name="chamber" class="pubs-select" aria-label="Kamer" onchange={submit}>
				<option value="">Beide kamers</option>
				<option value="TK" selected={data.chamber === 'TK'}>Tweede Kamer</option>
				<option value="EK" selected={data.chamber === 'EK'}>Eerste Kamer</option>
			</select>
		</form>
	</header>

	<div class="pubs-table-wrap">
		<table class="pubs-table">
			<thead>
				<tr>
					<th class="col-datum">Datum</th>
					<th class="col-soort">Soort</th>
					<th class="col-title">Titel</th>
					<th class="col-links" title="Gekoppelde artikelen in het netwerk">Art.</th>
				</tr>
			</thead>
			<tbody>
				{#each data.documents as doc (doc.key)}
					<tr class="pubs-row" class:has-text={doc.has_text}>
						<td class="col-datum">
							<span class="datum-val">{doc.date ?? '—'}</span>
						</td>
						<td class="col-soort">
							<span class="soort-label">{doc.kind ?? '—'}</span>
						</td>
						<td class="col-title">
							<a href="/publications/{doc.key}" class="pub-title-link">
								{doc.title || '(zonder titel)'}
							</a>
						</td>
						<td class="col-links">
							{#if doc.linked_articles}
								<span class="linked-count">{doc.linked_articles}</span>
							{:else}
								<span class="linked-none">—</span>
							{/if}
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="4" class="pubs-empty">Geen documenten gevonden.</td>
					</tr>
				{/each}
			</tbody>
		</table>

		{#if data.documents.length === data.limit}
			<p class="pubs-note">
				De eerste {data.limit.toLocaleString('nl-NL')} documenten, nieuwste eerst. Zoeken of filteren
				beperkt de selectie.
			</p>
		{/if}
	</div>
</div>

<style>
	.pubs-shell {
		max-width: 1100px;
		margin: 0 auto;
		padding: var(--s-6) var(--s-6) var(--s-9);
		box-sizing: border-box;
	}

	.pubs-error {
		padding: var(--s-5) var(--s-5);
		margin-bottom: var(--s-5);
		background: var(--paper-2);
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}

	.pubs-error-title {
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		color: var(--ink);
		margin: 0;
	}

	.pubs-error-msg {
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-3);
		margin: 0;
	}

	/* Header */
	.pubs-header {
		margin-bottom: var(--s-5);
	}

	.pubs-top {
		display: flex;
		align-items: flex-start;
		gap: var(--s-4);
		margin-bottom: var(--s-5);
	}

	.pubs-back {
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--ink-3);
		text-decoration: none;
		margin-top: 6px;
		flex-shrink: 0;
		background: none;
		border: 0;
		cursor: pointer;
		padding: 0;
	}

	.pubs-back:hover {
		color: var(--accent);
	}

	.pubs-top-right {
		flex: 1;
	}

	.pubs-title {
		font-family: var(--font-serif);
		font-weight: 500;
		font-size: 26px;
		margin: 0 0 4px;
		color: var(--ink);
		display: flex;
		align-items: baseline;
		gap: 10px;
	}

	.pubs-sigil {
		font-style: italic;
		color: var(--ink-3);
	}

	/* Controls */
	.pubs-controls {
		display: flex;
		align-items: center;
		gap: var(--s-5);
		margin-bottom: var(--s-4);
	}

	.pubs-search {
		flex: 1;
		max-width: 480px;
		padding: 8px var(--s-4);
		font-family: var(--font-sans);
		font-size: 13px;
		color: var(--ink);
		background: var(--paper-2);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		outline: none;
		appearance: none;
	}

	.pubs-search:focus {
		border-color: var(--ink-3);
		background: var(--paper);
	}

	.pubs-select {
		padding: 8px var(--s-3);
		font-family: var(--font-sans);
		font-size: 13px;
		color: var(--ink);
		background: var(--paper-2);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		max-width: 260px;
	}

	.pubs-note {
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--fg-3);
		padding: var(--s-2) 0 var(--s-3);
	}

	.pubs-table-wrap {
		overflow-x: auto;
	}

	.pubs-table {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--font-sans);
		font-size: 13px;
	}

	.pubs-table thead th {
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-3);
		font-weight: 500;
		text-align: left;
		padding: var(--s-2) var(--s-3) var(--s-2) 0;
		border-bottom: 1px solid var(--rule-strong);
		white-space: nowrap;
	}

	.col-datum {
		width: 90px;
	}
	.col-soort {
		width: 200px;
	}
	.col-links {
		width: 44px;
		text-align: right;
	}

	.pubs-table thead .col-links {
		text-align: right;
	}

	.pubs-row td {
		padding: 9px var(--s-3) 9px 0;
		border-bottom: 1px solid var(--rule);
		vertical-align: top;
		line-height: 1.4;
	}

	.pubs-row:hover td {
		background: var(--paper-2);
	}

	.datum-val {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-3);
		white-space: nowrap;
	}

	.soort-label {
		font-size: 11px;
		color: var(--ink-3);
		line-height: 1.4;
	}

	.pub-title-link {
		font-family: var(--font-serif);
		font-size: 15px;
		color: var(--ink);
		text-decoration: none;
		line-height: 1.4;
	}

	.pub-title-link:hover {
		color: var(--accent);
	}

	.linked-count {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--accent);
		font-weight: 600;
		display: block;
		text-align: right;
	}

	.linked-none {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--fg-4);
		display: block;
		text-align: right;
	}

	.pubs-empty {
		padding: var(--s-6) 0;
		color: var(--fg-3);
		font-style: italic;
	}
</style>
