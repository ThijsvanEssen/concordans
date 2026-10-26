<script lang="ts">
	import { OPEN_STATUS } from '$lib/components/explore/index/government';
	import BronLink from '$lib/bron/BronLink.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import AlleN from '$lib/components/ui/AlleN.svelte';
	import Tijdlijn from '$lib/components/tijdlijn/Tijdlijn.svelte';
	import ToezeggingInhoud from '$lib/components/open/ToezeggingInhoud.svelte';
	// Wat een bewindspersoon toezegde en ondertekende,
	// bovenaan de lezer. Tellingen per stand zijn links naar Bladeren met het filter gezet.
	import { abortable, getMemberCommitments, getMemberDossiers } from '$lib/api/records';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { load, type LoadState as State } from '$lib/util/load.svelte';
	import { bronHref, indexHref } from '$lib/bron/href';
	import { stand } from './stand';
	import { officialNumber } from '$lib/bron/dossier-naam';

	let { memberKey, ruim = false }: { memberKey: string; ruim?: boolean } = $props();

	// The same counts the kop above asks for: one request serves both (records.ts).
	const counts = load(
		() => memberKey,
		(key, signal) => abortable(getMemberCommitments(key, 1), signal),
		'Bewindspersoon toezeggingen'
	);
	const openCommitments = load(
		() => memberKey,
		(key, signal) => abortable(getMemberCommitments(key, 3, OPEN_STATUS), signal),
		'Bewindspersoon openstaand'
	);
	// One request of a hundred; the three newest shown until "Alle … dossiers".
	const memberDossiers = load(
		() => memberKey,
		(key, signal) => abortable(getMemberDossiers(key), signal),
		'Bewindspersoon dossiers'
	);
	function ready<T>(state: State<T>) {
		return state.status === 'ready' ? state.data : null;
	}
	const commitments = $derived(ready(counts.state));
	const open = $derived(ready(openCommitments.state));
	const dossiers = $derived(ready(memberDossiers.state));
	/** All of the dossiers, not the three newest: after "Alle … dossiers". */
	let alleDossiers = $state(false);
	const dossierItems = $derived(
		dossiers ? (alleDossiers ? dossiers.items : dossiers.items.slice(0, 3)) : []
	);

	const statusCounts = $derived(commitments?.facets?.status ?? []);
	const href = (status?: string) =>
		indexHref('commitments', { persoon: memberKey, ...(status ? { status } : {}) });
	const lower = (s: string) => s.toLowerCase();
</script>

<!-- The heading stands from the first paint, loading or failed, so the sections under it do
     not drop when the answer comes. -->
{#if counts.state.status !== 'ready'}
	<Sectie title="Toezeggingen" id="toezeggingen">
		<LoadState state={counts.state} what="De toezeggingen" retry={counts.retry} />
	</Sectie>
{:else if commitments && commitments.total > 0}
	<Sectie title="Toezeggingen" id="toezeggingen">
		<div class="ov" class:ruim>
			<p class="zin">
				<a class="raak-rij" href={href()}>{commitments.total} toezeggingen</a>:
				{#each statusCounts as s, i (s.value)}{#if i > 0}{i === statusCounts.length - 1
							? ' en '
							: ', '}{/if}<a class="raak-rij" href={href(s.value ?? undefined)}
						>{s.count} {lower(s.value ?? '')}</a
					>{/each}.
			</p>
			{#if openCommitments.state.status === 'error'}
				<LoadState
					state={openCommitments.state}
					what="De openstaande toezeggingen"
					retry={openCommitments.retry}
				/>
			{:else if open && open.items.length}
				{@const items = open.items}
				<!-- The open ones as in a post in Bladeren (PostOpen): the shared timeline, newest
				     first, a line opening in place. -->
				{#snippet inhoud(id: string)}
					{@const t = items.find((c) => c.key === id)}
					{#if t}<ToezeggingInhoud toezegging={t} />{/if}
				{/snippet}
				<Tijdlijn
					groepen={[
						{
							id: 'openstaand',
							titel: OPEN_STATUS,
							regels: items.map((c) => ({
								id: c.key,
								datum: c.date ?? null,
								teken: 'open',
								soort: 'commitments',
								zin: c.text ?? c.number ?? 'Toezegging',
								meta: c.number ?? null,
								ref: `commitments/${c.key}`,
								href: bronHref(`commitments/${c.key}`, { keepMode: false, mode: 'read' }),
								inhoud
							}))
						}
					]}
					volgorde="aflopend"
				>
					{#snippet meer()}
						{#if open && open.total > items.length}<AlleN
								aantal={open.total}
								noun="openstaande toezeggingen"
								href={href(OPEN_STATUS)}
							/>{/if}
					{/snippet}
				</Tijdlijn>
			{/if}
			<p class="dekking">
				Toezeggingen in de gegevens: kabinet-Rutte IV (2), kabinet-Schoof en kabinet-Jetten.
			</p>
		</div>
	</Sectie>
{/if}

{#if memberDossiers.state.status !== 'ready'}
	<Sectie title="Dossiers met ondertekende stukken" id="dossiers">
		<LoadState state={memberDossiers.state} what="De dossiers" retry={memberDossiers.retry} />
	</Sectie>
{:else if dossiers && dossiers.total > 0}
	<!-- The heading says what is listed, the count beside it (Thijs, 10 Oct: no sentence). -->
	<Sectie title="Dossiers met ondertekende stukken" aantal={dossiers.total} id="dossiers">
		<div class="ov" class:ruim>
			<ol class="items">
				{#each dossierItems as d (d.key)}
					{@const st = stand(d)}
					<li>
						<BronLink ref={`dossiers/${d.number}`}
							>{d.short_title ?? d.title ?? officialNumber(d.number)}</BronLink
						>
						<span class="meta">{st?.zin ?? ''} {officialNumber(d.number)}</span>
					</li>
				{/each}
			</ol>
			{#if !alleDossiers && dossiers.total > dossierItems.length}
				<AlleN aantal={dossiers.total} noun="dossiers" onclick={() => (alleDossiers = true)} />
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
	.ov :global(.alle-n) {
		align-self: flex-start;
	}
	.zin {
		margin: 0;
		font-family: var(--font-serif);
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
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
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
		gap: var(--s-1);
		padding: var(--s-2) 0;
		border-bottom: 1px solid var(--rule);
		font-size: var(--t-body-2);
		line-height: var(--lh-snug);
	}
	.items li > :global(a) {
		min-height: var(--veld-h-raak);
		text-decoration: none;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
	}
	.meta {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.dekking {
		margin: 0;
		font-family: var(--font-serif);
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
