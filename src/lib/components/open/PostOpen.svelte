<script lang="ts">
	import { naamVanId } from '$lib/bron/menselijk';
	// Een geopende post in Bewindspersonen, in de vorm
	// van OpenRij. Wat de bewindspersoon deed staat er meteen: de laatste toezeggingen (met
	// hun stand), de laatste stukken die hij of zij ondertekende, en de dossiers.
	import { api, unwrap } from '$lib/api/client';
	import { neighborsOf } from '$lib/api/nodes';
	import { bronHref, indexHref } from '$lib/bron/href';
	import { datum } from '$lib/components/parliamentary/stand';
	import OpenRij from './OpenRij.svelte';
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

	let regels = $state<TijdRegel[] | null>(null);
	let tz = $state<{ total: number; open: number } | null>(null);
	let stukken = $state(0);

	$effect(() => {
		const key = memberKey;
		const ac = new AbortController();
		regels = null;
		Promise.all([
			unwrap(
				api.GET('/api/commitments', {
					params: { query: { member: key, limit: 3, sort: 'date' } },
					signal: ac.signal
				})
			).catch(() => null),
			unwrap(
				api.GET('/api/nodes/{collection}/{key}', {
					params: {
						path: { collection: 'members', key },
						query: { relations: 'AUTHORED', limit: 200 }
					},
					signal: ac.signal
				})
			).catch(() => null)
		]).then(([c, n]) => {
			if (ac.signal.aborted) return;
			const out: TijdRegel[] = [];
			if (c) {
				tz = {
					total: c.total,
					open: c.facets?.status?.find((s) => s.value === 'Openstaand')?.count ?? 0
				};
				for (const t of c.items)
					out.push({
						id: t.key,
						datum: t.date ?? null,
						teken: t.status === 'Afgedaan' ? 'ja' : t.status === 'Vervallen' ? 'nee' : 'open',
						soort: 'commitments',
						label: `Toezegging, ${(t.status ?? '').toLowerCase()}`,
						zin: t.text ?? '',
						href: bronHref(`commitments/${t.key}`, { keepMode: false, mode: 'read' }),
						ref: `commitments/${t.key}`
					});
			}
			if (n) {
				const nb = neighborsOf(n);
				stukken = nb.length;
				const recent = [...nb]
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
						ref: x.id
					});
			}
			regels = out.sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? '')).slice(0, 5);
		});
		return () => ac.abort();
	});

	const bron = $derived(`members/${memberKey}`);
	const zin = $derived(
		`${naam}${partij ? ` (${partij})` : ''}: ${functie.charAt(0).toLowerCase()}${functie.slice(1)}, ${tot ? `van ${datum(van)} tot ${datum(tot)}` : `sinds ${datum(van)}`}.`
	);
</script>

<OpenRij
	{zin}
	laden={regels === null}
	groepen={regels ? [{ id: 'recent', titel: 'Recent', regels }] : []}
	links={[
		{
			label: tz ? `${tz.total} toezeggingen, ${tz.open} openstaand` : 'Toezeggingen',
			href: toezeggingenHref ?? indexHref('commitments', { member: memberKey })
		},
		{ label: `${stukken} stukken ondertekend` },
		...(geteld
			? [{ label: `${dossiers} dossiers in deze post, ${wetsvoorstellen} wetsvoorstellen` }]
			: [])
	]}
	{opmerkingen}
	lezen={bronHref(bron, { keepMode: false, mode: 'read' })}
	lezenLabel="Bewindspersoon lezen"
	netwerk={bronHref(bron, { keepMode: false, mode: 'graph' })}
/>
