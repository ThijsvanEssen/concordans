<script lang="ts">
	import { naamVanId } from '$lib/bron/menselijk';
	// Een geopende post in Bewindspersonen, in de vorm
	// van OpenRij. Wat de bewindspersoon deed staat er meteen: de laatste toezeggingen (met
	// hun stand), de laatste stukken die hij of zij ondertekende, en de dossiers.
	import { bronHref, indexHref } from '$lib/bron/href';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { load } from '$lib/util/load.svelte';
	import { postRecord } from './requests';
	import { datum } from '$lib/components/parliamentary/stand';
	import OpenRij from './OpenRij.svelte';
	import RijInhoud from './RijInhoud.svelte';
	import ToezeggingInhoud from './ToezeggingInhoud.svelte';
	import type { TijdRegel } from '$lib/components/tijdlijn/tijdlijn';

	let {
		memberKey,
		naam,
		partij,
		functie,
		van,
		tot,
		dossiers,
		wetsvoorstellen,
		geteld = true,
		toezeggingenHref = null,
		opmerkingen = []
	}: {
		memberKey: string;
		naam: string;
		partij: string | null;
		functie: string;
		van: string | null;
		tot: string | null;
		dossiers: number;
		wetsvoorstellen: number;
		/** False for a short stand-in beside a longer post: the API counts per person. */
		geteld?: boolean;
		toezeggingenHref?: string | null;
		/** What the row needs said: an older name, why acting, a missing ministry. */
		opmerkingen?: string[];
	} = $props();

	// A new bewindspersoon starts from loading: nothing of the one before stays (load()).
	const post = load(() => memberKey, postRecord, 'Post');
	const record = $derived(post.state.status === 'ready' ? post.state.data : null);
	/** The toezeggingen of the lines, for what a line opens. */
	const toezeggingen = $derived(record?.commitments.items ?? []);
	const tz = $derived(
		record && {
			total: record.commitments.total,
			open: record.commitments.facets?.status?.find((s) => s.value === 'Openstaand')?.count ?? 0
		}
	);
	/** The newest of the toezeggingen and the stukken signed, five at most. */
	const regels = $derived.by<TijdRegel[]>(() => {
		if (!record) return [];
		const out: TijdRegel[] = record.commitments.items.map((t) => ({
			id: t.key,
			datum: t.date ?? null,
			teken: t.status === 'Afgedaan' ? 'ja' : t.status === 'Vervallen' ? 'nee' : 'open',
			soort: 'commitments',
			label: `Toezegging, ${(t.status ?? '').toLowerCase()}`,
			zin: t.text ?? '',
			href: bronHref(`commitments/${t.key}`, { keepMode: false, mode: 'read' }),
			ref: `commitments/${t.key}`,
			inhoud
		}));
		const recent = record.authored
			.filter((x) => typeof x.props?.date === 'string')
			.sort((a, b) => String(b.props?.date).localeCompare(String(a.props?.date)))
			.slice(0, 3);
		for (const x of recent)
			out.push({
				id: x.id,
				datum: String(x.props?.date),
				teken: 'stuk',
				soort: (x.id.split('/')[0] as import('$lib/vocabulary').Collection) ?? 'documents',
				label: 'Ondertekend',
				zin: naamVanId(x.id, x.display_name),
				href: bronHref(x.id, { keepMode: false, mode: 'read' }),
				ref: x.id,
				// A paper opens its text in place; another bron (a besluit) is its title.
				inhoud: x.id.startsWith('documents/') ? inhoud : null
			});
		return out.sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? '')).slice(0, 5);
	});

	const bron = $derived(`members/${memberKey}`);
	const zin = $derived(
		`${naam}${partij ? ` (${partij})` : ''}: ${functie.charAt(0).toLowerCase()}${functie.slice(1)}, ${tot ? `van ${datum(van)} tot ${datum(tot)}` : `sinds ${datum(van)}`}.`
	);
</script>

<!-- What a line opens in place: a toezegging its facts, a paper its opening. -->
{#snippet inhoud(id: string)}
	{@const t = toezeggingen.find((c) => c.key === id)}
	{#if t}<ToezeggingInhoud toezegging={t} />{:else}<RijInhoud
			item={{
				kind: 'Brief regering',
				node: { collection: 'documents', key: id.split('/')[1] ?? '' },
				summary: null,
				vote: null
			}}
			als="opening"
		/>{/if}
{/snippet}

{#snippet failure()}
	{#if post.state.status === 'error'}
		<LoadState state={post.state} what="Het overzicht van de post" retry={post.retry} />
	{/if}
{/snippet}

<OpenRij
	{zin}
	laden={post.state.status === 'loading'}
	boven={failure}
	groepen={[{ id: 'recent', titel: 'Recent', regels }]}
	links={[
		{
			label: tz ? `${tz.total} toezeggingen, ${tz.open} openstaand` : 'Toezeggingen',
			href: toezeggingenHref ?? indexHref('commitments', { member: memberKey })
		},
		...(record ? [{ label: `${record.signed} stukken ondertekend` }] : []),
		...(geteld
			? [{ label: `${dossiers} dossiers in deze post, ${wetsvoorstellen} wetsvoorstellen` }]
			: [])
	]}
	{opmerkingen}
	lezen={bronHref(bron, { keepMode: false, mode: 'read' })}
	lezenLabel="Bewindspersoon lezen"
	netwerk={bronHref(bron, { keepMode: false, mode: 'graph' })}
/>
