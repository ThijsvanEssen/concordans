// What was made in an activity (`/api/activities/{key}/records`, API 0.79.55) as the groups of
// its reader, in the one form of a timeline: the verslag and stenogram, the moties submitted
// in it, the toezeggingen made in it, the besluiten taken. A stuk opens in place on its core
// text (a motie its dictum, from the answer itself), a besluit on its bar; a toezegging is its
// text. The bron is one step further.

import { shortKind } from '$lib/text/document-kind';
import type { Schema } from '$lib/api/types';
import type { TijdGroep, TijdRegel } from '$lib/components/tijdlijn/tijdlijn';
import type { Inhoud, MetInhoud } from '$lib/components/open/rij-inhoud';
import { kamerstukName, withoutKamerstuk } from '$lib/components/parliamentary/kamerstuk';
import { votesShort } from '$lib/components/parliamentary/stemming';

type Records = Schema<'ActivityRecordsResponse'>;
type Stuk = Schema<'ActivityPaperDTO'>;

/** What a line opens in place: the item RijInhoud reads, and as what. */
type RegelInhoud = { item: MetInhoud; als: Inhoud };

/** `Kamerstuk 36764, nr. 32`; null for a paper without a dossier. */
export const stukNummer = (s: Pick<Stuk, 'dossier_number' | 'dossier_suffix' | 'sequence'>) =>
	kamerstukName({ ...s, number: s.sequence });

export function activiteitGroepen(r: Records): {
	groepen: TijdGroep[];
	inhoud: Map<string, RegelInhoud>;
} {
	const inhoud = new Map<string, RegelInhoud>();

	const stuk = (s: Stuk, als: 'opening' | 'dictum'): TijdRegel => {
		const kan = als === 'dictum' ? !!s.dictum?.trim() || s.has_text : s.has_text;
		if (kan)
			inhoud.set(s.id, {
				item: { node: { collection: 'documents', key: s.key }, dictum: s.dictum ?? null },
				als: als === 'dictum' ? 'dictum' : 'kern'
			});
		return {
			id: s.id,
			datum: s.date ?? null,
			teken: 'stuk',
			soort: 'documents',
			label: s.kind ? shortKind(s.kind) : null,
			zin: (s.title ? withoutKamerstuk(s.title) : null) || s.kind || 'Kamerstuk',
			meta: stukNummer(s),
			ref: { collection: 'documents', key: s.key },
			heeftTekst: s.has_text
		};
	};

	const besluiten = (r.decisions ?? []).map((d): TijdRegel => {
		const t = votesShort(d.tally);
		if (t)
			inhoud.set(d.id, {
				item: {
					node: { collection: 'decisions', key: d.key },
					kind: 'stemming',
					// An activity is the Tweede Kamer's.
					vote: { chamber: 'TK', tally: d.tally }
				},
				als: 'stemming'
			});
		return {
			id: d.id,
			datum: d.date ?? null,
			teken: d.passed === true ? 'ja' : d.passed === false ? 'nee' : 'stuk',
			soort: 'decisions',
			label: d.kind ?? null,
			zin: d.subject?.trim() || d.decision_text || 'Besluit',
			meta: [d.decision_text?.replace(/\.$/, '') ?? null, t].filter(Boolean).join(', ') || null,
			ref: { collection: 'decisions', key: d.key }
		};
	});

	const groepen: TijdGroep[] = [
		{
			id: 'verslag',
			titel: 'Verslag en stenogram',
			regels: (r.documents ?? []).map((s) => stuk(s, 'opening'))
		},
		{
			id: 'moties',
			titel: 'Moties ingediend in dit debat',
			regels: (r.motions ?? []).map((s) => stuk(s, 'dictum'))
		},
		{
			id: 'toezeggingen',
			titel: 'Toezeggingen gedaan in dit debat',
			regels: (r.commitments ?? []).map(
				(c): TijdRegel => ({
					id: c.id,
					datum: c.registered_on ?? null,
					teken: 'stuk',
					soort: 'commitments',
					label: c.minister_role ?? c.minister_name ?? null,
					zin: c.text?.trim() || 'Toezegging zonder tekst',
					meta: c.status ?? null,
					ref: { collection: 'commitments', key: c.key }
				})
			)
		},
		{ id: 'besluiten', titel: 'Besluiten', regels: besluiten }
	].filter((g) => g.regels.length > 0);

	return { groepen, inhoud };
}
