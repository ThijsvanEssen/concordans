<script lang="ts">
	import type { PageData } from './$types';
	import type { EndpointDoc } from './+page';

	let { data }: { data: PageData } = $props();

	// Per-endpoint open/close, kept while scrolling.
	let openOps = $state<Record<string, boolean>>({});

	function toggleOp(opId: string) {
		openOps = { ...openOps, [opId]: !openOps[opId] };
	}

	function methodClass(method: string): string {
		return `method-${method.toLowerCase()}`;
	}

	function paramTypeLabel(p: EndpointDoc['parameters'][number]): string {
		const schema = p.schema;
		if (schema?.type === 'array') return `${schema.items?.type ?? 'any'}[]`;
		if (schema?.type) return schema.type;
		const types = schema?.anyOf?.map((a) => a.type).filter((t) => t && t !== 'null') ?? [];
		return types.join(' | ') || 'any';
	}
</script>

<svelte:head>
	<title>API-referentie. Concordans.</title>
</svelte:head>

<div class="page-wrap">
	<div class="container">
		<header class="page-header">
			<div class="eyebrow">OpenAPI {data.version} · {data.totalEndpoints} endpoints</div>
			<h1 class="page-title">API-referentie</h1>
			<p class="page-lede">
				De endpoints van de LawGraph-API, zoals het OpenAPI-schema ze beschrijft. Lezen is openbaar.
				Schrijven vraagt een sleutel in een header.
			</p>
			<dl class="api-terms">
				<dt>Sleutel</dt>
				<dd>
					{data.keyedEndpoints} endpoints vragen {#each data.keyHeaders as h, i (h)}{i > 0
							? ' of '
							: ''}<code>{h}</code>{/each}. De sleutel staat op de server, niet in de browser.
				</dd>
				<dt>Foutcodes</dt>
				<dd>401 bij een ontbrekende of onjuiste sleutel. 503 als de server geen sleutel heeft.</dd>
				<dt>Limiet</dt>
				<dd>
					200 verzoeken per minuut. Daarboven volgt 429 met <code>Retry-After</code>. Herkomsten op
					de toegestane lijst zijn vrijgesteld.
				</dd>
				<dt>Cache</dt>
				<dd>Artikelen 30 minuten, uitspraken een uur, statistieken vijf minuten.</dd>
			</dl>
		</header>

		<aside class="toc" aria-label="Inhoudsopgave">
			<div class="toc-title">Inhoud</div>
			<ul class="toc-list">
				{#each data.tags as t, i (i)}
					<li>
						<a href="#{t.tag}">
							<span class="toc-name">{t.label}</span>
							<span class="toc-count">{t.endpoints.length}</span>
						</a>
					</li>
				{/each}
			</ul>
		</aside>

		<div class="api-doc">
			{#each data.tags as t, i (i)}
				<section id={t.tag} class="api-tag">
					<header class="api-tag-head">
						<h2 class="api-tag-title">{t.label}</h2>
					</header>
					{#if t.description}
						<p class="api-tag-desc">{t.description}</p>
					{/if}

					<ul class="api-endpoints">
						{#each t.endpoints as ep (ep.operationId)}
							{@const opOpen = openOps[ep.operationId] ?? false}
							<li class="api-endpoint">
								<button
									type="button"
									class="api-endpoint-head"
									aria-expanded={opOpen}
									onclick={() => toggleOp(ep.operationId)}
								>
									<span class="api-method {methodClass(ep.method)}">{ep.method}</span>
									<code class="api-path">{ep.path}</code>
									{#if ep.summary}
										<span class="api-summary">{ep.summary}</span>
									{/if}
									{#if ep.keys.length > 0}
										<span class="api-key" title="Vraagt de header {ep.keys.join(', ')}"
											>sleutel</span
										>
									{/if}
									<span class="api-chev" aria-hidden="true" class:open={opOpen}>▸</span>
								</button>

								{#if opOpen}
									<div class="api-endpoint-body">
										{#if ep.description}
											<p class="api-desc">{ep.description}</p>
										{/if}

										{#if ep.keys.length > 0}
											<div class="api-block">
												<div class="api-block-head">Sleutel</div>
												<p class="api-desc">
													Header <code>{ep.keys.join(', ')}</code>. De server stuurt de sleutel mee.
												</p>
											</div>
										{/if}

										{#if ep.parameters.length > 0}
											<div class="api-block">
												<div class="api-block-head">Parameters</div>
												<table class="api-params">
													<thead>
														<tr>
															<th>Naam</th>
															<th>Plaats</th>
															<th>Type</th>
															<th>Vereist</th>
															<th>Beschrijving</th>
														</tr>
													</thead>
													<tbody>
														{#each ep.parameters as p, i (i)}
															<tr>
																<td><code>{p.name}</code></td>
																<td><span class="api-in">{p.in}</span></td>
																<td><code>{paramTypeLabel(p)}</code></td>
																<td>{p.required ? 'ja' : 'nee'}</td>
																<td>
																	{p.description ?? p.schema?.description ?? ''}
																	{#if p.schema?.default !== undefined}
																		<span class="api-default"
																			>standaard <code>{String(p.schema.default)}</code></span
																		>
																	{/if}
																</td>
															</tr>
														{/each}
													</tbody>
												</table>
											</div>
										{/if}

										{#if ep.requestSchema}
											<div class="api-block">
												<div class="api-block-head">Body</div>
												<p class="api-desc"><code>{ep.requestSchema}</code> als JSON.</p>
											</div>
										{/if}

										{#if ep.responses.length > 0}
											<div class="api-block">
												<div class="api-block-head">Antwoorden</div>
												<table class="api-responses">
													<thead>
														<tr><th>Status</th><th>Schema</th><th>Beschrijving</th></tr>
													</thead>
													<tbody>
														{#each ep.responses as r, i (i)}
															<tr>
																<td
																	><code class="api-status api-status-{r.status[0]}xx"
																		>{r.status}</code
																	></td
																>
																<td
																	>{#if r.schema}<code>{r.schema}</code>{:else}-{/if}</td
																>
																<td>{r.description}</td>
															</tr>
														{/each}
													</tbody>
												</table>
											</div>
										{/if}
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		</div>

		<div class="api-footer">
			<p>
				De werkomgeving staat in de <a href="/docs">documentatie</a>, de herkomst van de gegevens in
				de <a href="/docs/methode">methode-bijlage</a>. Voor grootschalig gebruik:
				<a href="/contact">contact</a>.
			</p>
		</div>
	</div>
</div>

<style>
	.page-wrap {
		padding: 72px 0 96px;
	}
	.container {
		max-width: 1080px;
		margin: 0 auto;
		padding: 0 32px;
		display: grid;
		grid-template-columns: 220px 1fr;
		column-gap: 48px;
		row-gap: 48px;
	}

	.page-header {
		grid-column: 1 / -1;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding-bottom: 24px;
		border-bottom: 1px solid var(--rule);
	}
	.eyebrow {
		font-family: var(--font-sans);
		font-size: 12px;
		font-weight: 500;
		color: var(--ink-3);
	}
	.page-title {
		font-family: var(--font-serif);
		font-size: var(--t-h1);
		font-weight: 500;
		color: var(--ink);
		margin: 0;
		line-height: var(--lh-tight);
	}
	.page-lede {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink);
		margin: 0;
		max-width: var(--measure);
	}
	.api-terms {
		display: grid;
		grid-template-columns: max-content 1fr;
		column-gap: var(--s-4);
		row-gap: 4px;
		margin: 6px 0 0;
		max-width: 72ch;
		font-family: var(--font-sans);
		font-size: 13px;
		line-height: 1.55;
	}
	.api-terms dt {
		font-weight: 500;
		color: var(--ink-3);
	}
	.api-terms dd {
		margin: 0;
		color: var(--ink-2);
	}
	.api-terms code {
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--ink);
		background: var(--paper-2);
		padding: 1px 5px;
		border-radius: var(--r-1);
	}

	/* ── TOC ──────────────────────────────────────────────────────────────── */
	.toc {
		grid-column: 1;
		grid-row: 2;
		align-self: start;
		position: sticky;
		top: 90px;
	}
	.toc-title {
		font-family: var(--font-sans);
		font-size: 12px;
		font-weight: 500;
		color: var(--ink-3);
		margin-bottom: 8px;
	}
	.toc-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
	}
	.toc-list a {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding: 5px 0;
		color: var(--ink-2);
		text-decoration: none;
		font-family: var(--font-sans);
		font-size: 13px;
		border-bottom: 1px dotted transparent;
	}
	.toc-list a:hover {
		color: var(--accent);
		border-bottom-color: var(--rule);
	}
	.toc-name {
		flex: 1;
	}
	.toc-count {
		font-family: var(--font-sans);
		font-variant-numeric: tabular-nums;
		font-size: 12px;
		color: var(--ink-3);
		margin-left: 8px;
	}

	/* ── Endpoint sections ────────────────────────────────────────────────── */
	.api-doc {
		grid-column: 2;
		grid-row: 2;
		display: flex;
		flex-direction: column;
		gap: 56px;
	}

	.api-tag {
		display: flex;
		flex-direction: column;
		gap: 12px;
		scroll-margin-top: 90px;
	}
	.api-tag-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		border-bottom: 1px solid var(--rule);
		padding-bottom: 8px;
	}
	.api-tag-title {
		font-family: var(--font-serif);
		font-size: 22px;
		font-weight: 500;
		color: var(--ink);
		margin: 0;
	}
	.api-tag-desc {
		font-family: var(--font-sans);
		font-size: 13px;
		line-height: 1.55;
		color: var(--ink-3);
		margin: 0 0 8px;
		max-width: 60ch;
	}

	.api-endpoints {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
	}
	.api-endpoint-head {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 0;
		background: none;
		border: 0;
		border-radius: var(--r-1);
		cursor: pointer;
		text-align: left;
		transition: background var(--dur-1) var(--ease);
	}
	.api-endpoint-head:hover {
		background: var(--paper-2);
	}

	.api-method {
		font-family: var(--font-sans);
		font-size: 12px;
		font-weight: 500;
		color: var(--ink-2);
		flex-shrink: 0;
		min-width: 48px;
	}

	.api-path {
		font-family: var(--font-sans);
		font-variant-numeric: tabular-nums;
		font-size: 13px;
		color: var(--ink);
		flex-shrink: 0;
	}
	.api-summary {
		font-family: var(--font-serif);
		font-size: 13px;
		color: var(--ink-3);
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.api-key {
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--ink-3);
		flex-shrink: 0;
	}
	.api-default {
		display: block;
		color: var(--ink-3);
		font-size: 12px;
	}
	.api-chev {
		color: var(--ink-3);
		font-size: 12px;
		transition: transform 120ms;
		margin-right: 4px;
	}
	.api-chev.open {
		transform: rotate(90deg);
	}

	.api-endpoint-body {
		padding: 4px 0 18px 60px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.api-desc {
		font-family: var(--font-sans);
		font-size: 13px;
		line-height: 1.6;
		color: var(--ink-2);
		margin: 0;
		max-width: 60ch;
	}
	.api-block {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.api-block-head {
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--ink-3);
		font-weight: 500;
	}

	table.api-params,
	table.api-responses {
		border-collapse: collapse;
		font-family: var(--font-sans);
		font-size: 12px;
		width: 100%;
	}
	.api-params th,
	.api-params td,
	.api-responses th,
	.api-responses td {
		text-align: left;
		padding: 6px 10px 6px 0;
		border-bottom: 1px solid var(--rule);
		vertical-align: top;
	}
	.api-params th,
	.api-responses th {
		font-weight: 500;
		color: var(--ink-3);
		font-size: 12px;
	}
	.api-params code,
	.api-responses code {
		font-family: var(--font-sans);
		font-variant-numeric: tabular-nums;
		font-size: 12px;
		color: var(--ink);
		background: var(--paper-2);
		padding: 1px 5px;
		border-radius: var(--r-1);
	}
	.api-in {
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--ink-3);
	}
	.api-status {
		color: var(--ink);
	}

	.api-footer {
		grid-column: 1 / -1;
		margin-top: 24px;
		padding-top: 24px;
		border-top: 1px solid var(--rule);
		font-family: var(--font-sans);
		font-size: 13px;
		color: var(--ink-3);
		line-height: 1.65;
	}
	.api-footer a {
		color: var(--ink-2);
		border-bottom: 1px solid var(--rule-strong);
		text-decoration: none;
	}
	.api-footer a:hover {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}

	@media (max-width: 820px) {
		.container {
			grid-template-columns: 1fr;
		}
		.toc {
			position: static;
			grid-column: 1;
			grid-row: auto;
		}
		.api-doc {
			grid-column: 1;
			grid-row: auto;
		}
		.api-endpoint-body {
			padding-left: 0;
		}
		.api-summary {
			display: none;
		}
	}
</style>
