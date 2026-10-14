<script lang="ts">
	// What a row shows when it opens (Actueel, Gevolgd; a Kamerstuk in Verbonden, Bronnen and
	// Gemarkeerd): the bron's own content, read in place, not a panel of actions (Thijs, 10 Oct: "doet niet zoveel behalve een extra klik
	// toevoegen"). Nothing the row says already comes back. A motie its dictum, an amendement
	// its toelichting, another stuk the opening of its text, a stemming its bar, a uitspraak its
	// inhoudsindicatie, a publication its changes, an inwerkingtreding the publication that
	// brought it (Wijzigingen); asked when the row opens (one request, shared with the reader), a motie's
	// dictum from the feed itself where it has one. A paper the feed says has no text yet does
	// not open (inhoudVan). The reader stays one step further: the title, or Lees verder.
	import { getDocument } from '$lib/api/records';
	import { bronHref } from '$lib/bron/href';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import Wijzigingen from './Wijzigingen.svelte';
	import {
		inhoudVan,
		kernSoort,
		kernUitLijst,
		kernVan,
		type Inhoud,
		type MetInhoud
	} from './rij-inhoud';

	let {
		item,
		als = null
	}: {
		item: MetInhoud;
		/** What to show where the item's kind does not say it (a paper of a procedure). */
		als?: Inhoud;
	} = $props();

	const soort = $derived(als ?? inhoudVan(item));
	// An inwerkingtreding is read in its law; the version itself has no reader.
	const wet = $derived(item.commencement?.instrument?.key);
	const ref = $derived(
		soort === 'inwerkingtreding' && wet
			? `instruments/${wet}`
			: `${item.node.collection}/${item.node.key}`
	);

	let tekst = $state<string | null | 'laden'>(null);
	/** What the text is, once the stuk has said its kind (`kern`). */
	let gelezen = $state<Inhoud>(null);
	$effect(() => {
		const s = soort;
		const key = item.node.key;
		tekst = null;
		gelezen = s;
		if (s !== 'dictum' && s !== 'toelichting' && s !== 'opening' && s !== 'kern') return;
		// A motion's dictum or an amendment's explanation as the list gives it: no request (API
		// 0.79.42, 0.79.55).
		const lijst = kernUitLijst(s, item);
		if (lijst) {
			tekst = lijst.tekst;
			gelezen = lijst.als;
			return;
		}
		tekst = 'laden';
		let stale = false;
		getDocument(key)
			.then((d) => {
				if (stale) return;
				// The API's dictum before the one read from the text; the feed's summary where the
				// stuk has no text in the data yet (the newest papers).
				const k = s === 'kern' ? kernSoort(d.kind) : s;
				gelezen = k;
				tekst = kernVan(k, d) ?? (item.summary?.trim() || null);
			})
			.catch(() => {
				if (!stale) tekst = null;
			});
		return () => (stale = true);
	});

	const tally = $derived.by(() => {
		const t = (item.vote?.tally ?? {}) as Record<string, number>;
		return { voor: t['Voor'] ?? 0, tegen: t['Tegen'] ?? 0 };
	});
</script>

<div class="inhoud">
	{#if soort === 'stemming'}
		<!-- The tally is in the row; here its picture: the share voor. -->
		<div
			class="balk"
			role="img"
			aria-label="{tally.voor} voor, {tally.tegen} tegen"
			title="{tally.voor} voor, {tally.tegen} tegen"
		>
			<div class="voor" style:width="{(tally.voor / (tally.voor + tally.tegen)) * 100}%"></div>
		</div>
	{:else if soort === 'samenvatting'}
		<p class="tekst">{item.summary}</p>
	{:else if soort === 'wijzigingen' || soort === 'inwerkingtreding'}
		{#if item.summary?.trim()}<p class="tekst">{item.summary}</p>{/if}
		<Wijzigingen {item} {soort} />
	{:else if tekst === 'laden'}
		<p class="stil">Laden…</p>
	{:else if tekst}
		<p class="tekst" class:dictum={gelezen === 'dictum'}>{tekst}</p>
	{:else}
		<p class="stil">Tekst nog niet in de gegevens.</p>
	{/if}
	<p class="verder">
		<TekstLink href={bronHref(ref, { keepMode: false, mode: 'read' })}>Lees verder</TekstLink>
	</p>
</div>

<style>
	.inhoud {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		max-width: 680px;
	}
	.tekst {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		line-height: var(--lh-body);
		color: var(--ink);
	}
	.dictum {
		font-style: italic;
	}
	.stil {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.verder {
		margin: 0;
		font-size: var(--t-meta);
	}
	.balk {
		height: var(--s-3);
		max-width: 320px;
		background: var(--rule);
		border-radius: var(--r-2);
		overflow: hidden;
	}
	.voor {
		height: 100%;
		background: var(--ink-2);
	}
</style>
