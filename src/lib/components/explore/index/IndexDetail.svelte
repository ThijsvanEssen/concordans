<script lang="ts">
	// An opened row in Bladeren for the kinds without an open row of their own (a law, a
	// judgment, a stuk, a stemming, a member, a fractie, a commissie), in the one form of
	// OpenRij: one sentence with what the row does not say yet, the identifiers as text,
	// and the same two buttons. Only what the list item carries; no request.
	import type { Schema } from '$lib/api/types';
	import { bronHref } from '$lib/bron/href';
	import OpenRij from '$lib/components/open/OpenRij.svelte';
	import { chamberName } from '$lib/components/parliamentary/chamber';
	import { kamerstukCitation } from '$lib/components/parliamentary/kamerstuk';
	import { langeDatum } from '$lib/text/datum';
	import type { IndexCategory } from './categories';
	import { judgmentKind } from './judgment-kind';
	import { decisionMethod, decisionOutcome, isHammer } from './decision-kind';

	let {
		category,
		record,
		bron,
		chamber = 'TK'
	}: {
		category: IndexCategory;
		record:
			| Schema<'InstrumentListItemDTO'>
			| Schema<'JudgmentListItemDTO'>
			| Schema<'CommitteeDTO'>
			| Schema<'MemberDTO'>
			| Schema<'FactionDTO'>
			| Schema<'DecisionSummaryDTO'>
			| Schema<'DocumentListItemDTO'>;
		/** What a link names: `judgments/<key>`, `dossiers/<number>`. */
		bron: string;
		/** The Kamer the list shows: a member may sit in both, the list says which. */
		chamber?: string;
	} = $props();

	/** The word on the first button: what is opened. */
	const NAAM: Partial<Record<IndexCategory, string>> = {
		instruments: 'Wet',
		judgments: 'Uitspraak',
		committees: 'Commissie',
		members: 'Kamerlid',
		factions: 'Fractie',
		decisions: 'Stemming',
		documents: 'Stuk'
	};

	const n = (x: number) => x.toLocaleString('nl-NL');
	const meervoud = (x: number, een: string, meer: string) => `${n(x)} ${x === 1 ? een : meer}`;

	// The category says which record it is; the parent passes matching pairs.
	const open = $derived.by((): { zin: string | null; links: { label: string }[] } => {
		switch (category) {
			case 'instruments': {
				const w = record as Schema<'InstrumentListItemDTO'>;
				const orde = w.jurisdiction === 'eu' ? 'Europese Unie' : 'Nederlands recht';
				return {
					zin: `${orde}${w.article_count > 0 ? `, ${meervoud(w.article_count, 'artikel', 'artikelen')}` : ''}.`,
					links: [
						...(w.bwb_id ? [{ label: `BWB-id ${w.bwb_id.toUpperCase()}` }] : []),
						...(w.celex ? [{ label: `CELEX ${w.celex}` }] : [])
					]
				};
			}
			case 'judgments': {
				const j = record as Schema<'JudgmentListItemDTO'>;
				const by = j.inbound_citation_count ?? 0;
				const cites = j.outbound_citation_count ?? 0;
				return {
					zin: `${judgmentKind(j.decision_kind, j.tier)} van ${j.court ?? 'een instantie die niet in de gegevens staat'}${j.date ? `, ${langeDatum(j.date)}` : ''}.`,
					links: [
						...(j.ecli ? [{ label: j.ecli }] : []),
						...(by
							? [{ label: `Aangehaald door ${meervoud(by, 'uitspraak', 'uitspraken')}` }]
							: []),
						...(cites ? [{ label: `Haalt ${meervoud(cites, 'uitspraak', 'uitspraken')} aan` }] : [])
					]
				};
			}
			case 'committees': {
				const c = record as Schema<'CommitteeDTO'>;
				const k = c.active_dossier_count ?? 0;
				return {
					zin: `${chamberName(c.chamber)}. ${k ? `${meervoud(k, 'lopend dossier', 'lopende dossiers')}.` : 'Geen lopende dossiers.'}`,
					links: []
				};
			}
			case 'members': {
				const m = record as Schema<'MemberDTO'>;
				const ek = chamber === 'EK' ? (m.ek ?? null) : null;
				const fractie = ek?.abbreviation ?? m.party ?? null;
				const extra = [
					ek?.seniority_days != null ? `${n(ek.seniority_days)} dagen anciënniteit` : null,
					ek?.residence ? `woont in ${ek.residence}` : null
				].filter(Boolean);
				return {
					zin: `Lid van de ${chamberName(chamber)}${fractie ? ` voor ${fractie}` : ''}${extra.length ? `; ${extra.join(', ')}` : ''}.`,
					links: []
				};
			}
			case 'factions': {
				const f = record as Schema<'FactionDTO'>;
				const delen = [
					f.seats != null ? meervoud(f.seats, 'zetel', 'zetels') : null,
					f.member_count != null ? meervoud(f.member_count, 'lid', 'leden') : null
				].filter(Boolean);
				return {
					zin: `${chamberName(f.chamber)}${delen.length ? `: ${delen.join(', ')}` : ''}.`,
					links: []
				};
			}
			case 'decisions': {
				const s = record as Schema<'DecisionSummaryDTO'>;
				const uitslag = decisionOutcome(s);
				const wijze = decisionMethod(s);
				const unit = s.vote_kind === 'member' ? ['lid', 'leden'] : ['fractie', 'fracties'];
				const telling = isHammer(s)
					? null
					: Object.entries(s.tally ?? {})
							.map(
								([keuze, zetels]) =>
									`${keuze} ${meervoud(zetels, 'zetel', 'zetels')} (${meervoud(s.voters?.[keuze] ?? 0, unit[0], unit[1])})`
							)
							.join(', ');
				// The day stands above the vote in the list; the sentence does not repeat it.
				const delen = [uitslag, wijze && !isHammer(s) ? wijze.toLowerCase() : null].filter(Boolean);
				return {
					zin: delen.length ? `${delen.join(', ')}.` : null,
					links: telling ? [{ label: telling }] : []
				};
			}
			case 'documents': {
				const doc = record as Schema<'DocumentListItemDTO'>;
				const citeer = kamerstukCitation(doc);
				return {
					zin:
						[doc.kind, chamberName(doc.chamber), doc.date ? langeDatum(doc.date) : null]
							.filter(Boolean)
							.join(', ') + '.',
					links: citeer ? [{ label: citeer }] : []
				};
			}
			default:
				return { zin: null, links: [] };
		}
	});
</script>

<OpenRij
	zin={open.zin}
	links={open.links}
	lezen={bronHref(bron, { keepMode: false, mode: 'read' })}
	lezenLabel="{NAAM[category] ?? 'Bron'} lezen"
	netwerk={bronHref(bron, { keepMode: false, mode: 'graph' })}
/>
