<script lang="ts">
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import Inhoudsopgave from '$lib/components/ui/Inhoudsopgave.svelte';
	import Caret from '$lib/components/ui/Caret.svelte';
	import type { PageData } from './$types';
	import { RELATIONS } from '$lib/vocabulary';
	import { relationLabel } from '$lib/verbonden/relation-words';

	let { data }: { data: PageData } = $props();

	// Per-endpoint open/close, kept while scrolling.
	let openOps = $state<Record<string, boolean>>({});

	function toggleOp(opId: string) {
		openOps = { ...openOps, [opId]: !openOps[opId] };
	}
</script>

<RouteKop />

<div class="page-wrap">
	<div class="container blad blad__indeling">
		<header class="blad__kop"><h1 class="blad__titel">API-referentie</h1></header>
		<div class="page-header">
			<p class="page-lede">
				De routes van de API achter Concordans. Elke route is een GET-verzoek zonder sleutel. De
				beschrijving per route komt uit het OpenAPI-schema en is Engels.
			</p>
			<dl class="api-terms">
				<dt>Versie</dt>
				<dd>OpenAPI {data.version}, {data.totalEndpoints} routes</dd>
				<dt>Adres</dt>
				<dd><code>https://concordans.nl</code>; elke route begint met <code>/api</code>.</dd>
				<dt>Limiet</dt>
				<dd>
					Het aantal verzoeken per minuut per IP-adres is begrensd. Daarboven volgt 429 met
					<code>Retry-After</code>.
				</dd>
				<dt>Licentie</dt>
				<dd>
					Zie <a href="/bronnen#hergebruik">Bronnen en hergebruik</a>.
				</dd>
				<dt>Techniek</dt>
				<dd>Een FastAPI-service (LawGraph); de site is gebouwd met SvelteKit.</dd>
			</dl>
		</div>

		<div class="toc">
			<Inhoudsopgave
				items={[
					...data.tags.map((t) => ({ label: t.label, id: t.tag })),
					{ label: 'Relatienamen', id: 'relaties' }
				]}
			/>
		</div>

		<div class="api-doc">
			{#each data.tags as t, i (i)}
				<Sectie id={t.tag} title={t.label} aantal={t.endpoints.length} sleutel="api-{t.tag}">
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
									<span class="api-method">{ep.method}</span>
									<code class="api-path">{ep.path}</code>
									{#if ep.summary}
										<span class="api-summary">{ep.summary}</span>
									{/if}
									<Caret open={opOpen} side />
								</button>

								{#if opOpen}
									<div class="api-endpoint-body">
										{#if ep.description}
											<p class="api-desc">{ep.description}</p>
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
																<td><code>{p.type}</code></td>
																<td>{p.required ? 'ja' : 'nee'}</td>
																<td>
																	{p.description}
																	{#if p.default !== null}
																		<span class="api-default"
																			>standaard <code>{p.default}</code></span
																		>
																	{/if}
																</td>
															</tr>
														{/each}
													</tbody>
												</table>
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
																<td><code class="api-status">{r.status}</code></td>
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
				</Sectie>
			{/each}
			<Sectie id="relaties" title="Relatienamen" aantal={RELATIONS.length} sleutel="api-relaties">
				<p class="api-tag-desc">
					De naam van een verbinding in de API (<code>relation</code>) en zoals de site haar noemt.
				</p>
				<table class="api-params">
					<thead>
						<tr><th>API</th><th>Op de site</th></tr>
					</thead>
					<tbody>
						{#each RELATIONS as relation (relation)}
							<tr><td><code>{relation}</code></td><td>{relationLabel(relation)}</td></tr>
						{/each}
					</tbody>
				</table>
			</Sectie>
		</div>

		<div class="api-footer">
			<p>
				De uitleg staat in de <a href="/docs">documentatie</a>, de herkomst van de gegevens in de
				<a href="/docs/methode">methode</a>. Voor grootschalig gebruik:
				<a href="/over#contact">contact</a>.
			</p>
		</div>
	</div>
</div>

<style>
	/* The frame and grid of Bladeren (lib/styles/frame.css): the contents in the facet column. */
	.container {
		row-gap: var(--s-7);
	}

	/* Under the one head at its own distance (lib/styles/frame.css), not the grid's row gap. */
	.page-header {
		grid-column: 1 / -1;
		grid-row: 2;
		margin-top: calc(-1 * var(--s-7));
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
		padding-bottom: var(--s-5);
		border-bottom: 1px solid var(--rule);
	}
	.page-lede {
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink);
		margin: 0;
		max-width: var(--regel);
	}
	.api-terms {
		display: grid;
		grid-template-columns: max-content 1fr;
		column-gap: var(--s-4);
		row-gap: var(--s-1);
		margin: var(--s-2) 0 0;
		max-width: 72ch;
		font-size: var(--t-meta);
		line-height: 1.55;
	}
	.api-terms dt {
		font-weight: 600;
		color: var(--ink-3);
	}
	.api-terms dd {
		margin: 0;
		color: var(--ink-2);
	}
	.api-terms code {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink);
		background: var(--paper-2);
		padding: 1px var(--s-1);
		border-radius: var(--r-1);
	}

	/* ── TOC ──────────────────────────────────────────────────────────────── */
	.toc {
		grid-column: 1;
		grid-row: 3;
		align-self: start;
		position: sticky;
		top: calc(var(--balk-h) + var(--s-6));
	}

	/* ── Endpoint sections ────────────────────────────────────────────────── */
	.api-doc {
		grid-column: 2;
		grid-row: 3;
		display: flex;
		flex-direction: column;
		gap: var(--s-8);
	}

	.api-tag-desc {
		font-size: var(--t-meta);
		line-height: 1.55;
		color: var(--ink-3);
		margin: 0 0 var(--s-2);
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
		gap: var(--s-3);
		padding: var(--s-3) 0;
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
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-2);
		flex-shrink: 0;
		min-width: 48px;
	}

	.api-path {
		font-family: var(--font-serif);
		font-variant-numeric: tabular-nums;
		font-size: var(--t-meta);
		color: var(--ink);
		flex-shrink: 0;
	}
	.api-summary {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.api-default {
		display: block;
		color: var(--ink-3);
		font-size: var(--t-micro);
	}

	.api-endpoint-body {
		padding: var(--s-1) 0 var(--s-4) 60px;
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
	}
	.api-desc {
		font-size: var(--t-meta);
		line-height: var(--lh-body);
		color: var(--ink-2);
		margin: 0;
		max-width: 60ch;
	}
	.api-block {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.api-block-head {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
		font-weight: 600;
	}

	table.api-params,
	table.api-responses {
		border-collapse: collapse;
		font-size: var(--t-micro);
		width: 100%;
	}
	.api-params th,
	.api-params td,
	.api-responses th,
	.api-responses td {
		text-align: left;
		padding: var(--s-1) var(--s-3) var(--s-1) 0;
		border-bottom: 1px solid var(--rule);
		vertical-align: top;
	}
	.api-params th,
	.api-responses th {
		font-weight: 600;
		color: var(--ink-3);
		font-size: var(--t-micro);
	}
	.api-params code,
	.api-responses code {
		font-family: var(--font-serif);
		font-variant-numeric: tabular-nums;
		font-size: var(--t-micro);
		color: var(--ink);
		background: var(--paper-2);
		padding: 1px var(--s-1);
		border-radius: var(--r-1);
	}
	.api-in {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.api-status {
		color: var(--ink);
	}

	.api-footer {
		grid-column: 1 / -1;
		margin-top: var(--s-5);
		padding-top: var(--s-5);
		border-top: 1px solid var(--rule);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
		line-height: 1.65;
	}
	.api-footer a {
		color: var(--ink-2);
		border-bottom: 1px solid var(--rule-strong);
		text-decoration: none;
	}
	.api-footer a:hover {
		color: var(--ink);
		border-bottom-color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}

	@media (max-width: 768px) {
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
		/* A long route breaks after a slash instead of widening the page. */
		.api-path {
			flex-shrink: 1;
			min-width: 0;
			overflow-wrap: anywhere;
		}
	}
</style>
