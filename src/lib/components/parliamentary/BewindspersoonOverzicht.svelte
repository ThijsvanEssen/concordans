<script lang="ts">
	import Sectie from '$lib/components/ui/Sectie.svelte';
	// Wat een bewindspersoon toezegde en ondertekende,
	// bovenaan de lezer. Tellingen per stand zijn links naar Bladeren met het filter gezet.
	import { api, unwrap } from '$lib/api/client';
	import type { Schema } from '$lib/api/types';
	import { bronHref, indexHref } from '$lib/bron/href';
	import { stand, datum } from './stand';

	let { memberKey, ruim = false }: { memberKey: string; ruim?: boolean } = $props();

	type C = Schema<'CommitmentListResponse'>;
	type D = Schema<'ActorDossiersResponse'>;
	let commitments = $state<C | null>(null);
	let open = $state<C | null>(null);
	let dossiers = $state<D | null>(null);
	/** All of the dossiers, not the three newest: after "Alle … dossiers". */
	let alleDossiers = $state(false);

	$effect(() => {
		const key = memberKey;
		const ac = new AbortController();
		void alleDossiers;
		commitments = open = null;
		if (!alleDossiers) dossiers = null;
		const q = (status?: string) =>
			unwrap(
				api.GET('/api/commitments', {
					params: { query: { member: key, limit: status ? 3 : 1, ...(status ? { status } : {}) } },
					signal: ac.signal
				})
			).catch(() => null);
		q().then((r) => (commitments = r));
		q('Openstaand').then((r) => (open = r));
		unwrap(
			api.GET('/api/members/{key}/dossiers', {
				params: { path: { key }, query: { limit: alleDossiers ? 100 : 3 } },
				signal: ac.signal
			})
		)
			.then((r) => (dossiers = r))
			.catch(() => null);
		return () => ac.abort();
	});

	const statusCounts = $derived(commitments?.facets?.status ?? []);
	const href = (status?: string) =>
		indexHref('commitments', { member: memberKey, ...(status ? { status } : {}) });
	const lower = (s: string) => s.toLowerCase();
</script>

{#if commitments && commitments.total > 0}
	<Sectie titel="Toezeggingen" soort="commitments" id="toezeggingen">
		<div class="ov" class:ruim>
			<p class="zin">
				<a href={href()}>{commitments.total} toezeggingen</a>:
				{#each statusCounts as s, i (s.value)}{#if i > 0}{i === statusCounts.length - 1
							? ' en '
							: ', '}{/if}<a href={href(s.value ?? undefined)}>{s.count} {lower(s.value ?? '')}</a
					>{/each}.
			</p>
			{#if open && open.items.length}
				<ol class="items">
					{#each open.items as c (c.key)}
						<li>
							<a href={bronHref(`commitments/${c.key}`, { keepMode: false, mode: 'read' })}
								>{c.text}</a
							>
							<span class="meta"
								>{c.number}, toegezegd {datum(c.date)}{c.expected_resolution
									? `, verwacht ${datum(c.expected_resolution)}`
									: ''}</span
							>
						</li>
					{/each}
				</ol>
				{#if open.total > open.items.length}
					<a class="alle" href={href('Openstaand')}>Alle {open.total} openstaande toezeggingen</a>
				{/if}
			{/if}
			<p class="dekking">
				Toezeggingen in de gegevens: kabinet-Rutte IV (2), kabinet-Schoof en kabinet-Jetten.
			</p>
		</div>
	</Sectie>
{/if}

{#if dossiers && dossiers.total > 0}
	<Sectie titel="Dossiers" soort="dossiers" id="dossiers">
		<div class="ov" class:ruim>
			<p class="zin">{dossiers.total} dossiers met stukken die deze bewindspersoon ondertekende.</p>
			<ol class="items">
				{#each dossiers.items as d (d.key)}
					{@const st = stand(d)}
					<li>
						<a href={bronHref(`dossiers/${d.number}`, { keepMode: false, mode: 'read' })}
							>{d.short_title ?? d.title ?? d.number}</a
						>
						<span class="meta">{st?.zin ?? ''} {d.number}</span>
					</li>
				{/each}
			</ol>
			{#if !alleDossiers && dossiers.total > dossiers.items.length}
				<button type="button" class="alle" onclick={() => (alleDossiers = true)}
					>Alle {dossiers.total} dossiers</button
				>
			{/if}
		</div>
	</Sectie>
{/if}

<style>
	.ov {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.zin {
		margin: 0;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink);
	}
	a {
		color: inherit;
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
	}
	a:hover {
		color: var(--accent);
	}
	.items {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	/* A list ends without a rule: the next section brings its own. */
	.items li:last-child {
		border-bottom: 0;
	}
	.items li {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--s-2) 0;
		border-bottom: 1px solid var(--rule);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: var(--lh-snug);
	}
	.items li > a {
		text-decoration: none;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
	}
	.meta {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.alle {
		align-self: flex-start;
		padding: 0;
		border: 0;
		background: none;
		color: var(--ink);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
		cursor: pointer;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		font-weight: 500;
	}
	.dekking {
		margin: 0;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.ruim {
		gap: var(--s-3);
	}
	.ruim .items li {
		padding: var(--s-3) 0;
		gap: var(--s-1);
	}
</style>
