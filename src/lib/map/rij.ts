// A row of Verbonden as Gemarkeerd keeps it: its citation as its reader gives it, its group per
// law or dossier (an article under its law, a Kamerstuk under its dossier, a judgment as its
// own group, so its overwegingen join it, a vote under its dossier), the rest under its kind.
import { langeDatum } from '$lib/text/datum';
import { textOf } from '$lib/text/words';
import { get } from 'svelte/store';
import { focusOf } from '$lib/bron/href';
import { voteCitation } from '$lib/bron/naam';
import { instrumentMetaStore, lawName } from '$lib/api/instrument-cache';
import { lawIdOf } from '$lib/graph/types';
import { kamerstukCitation } from '$lib/components/parliamentary/kamerstuk';

import { type Row } from '$lib/verbonden/rows';
import { dossierNumberOf } from '$lib/bron/describe';
import { FILTER_GROUP_LABEL } from '$lib/verbonden/filter';
import { dossierLabel } from '$lib/bron/dossier-naam';
import { keyEcli } from '$lib/bron/leesbaar';
import { uitspraakKop, zaakNaam } from '$lib/text/judgment-cite';
import { bewaarItem, type MapItem } from './map';

const propsOf = (r: Row) => (r.props ?? {}) as Record<string, unknown>;

/** The dossier of a Kamerstuk or vote row, from its props as its reader reads them. */
const dossierOf = (r: Row) =>
	r.ref.collection === 'documents' || r.ref.collection === 'decisions'
		? dossierNumberOf(r.props)
		: null;

/** A judgment row as its reader heads it: `Rb. Den Haag 1 januari 2013`, with its ECLI in full. */
function judgmentHead(r: Row): { short: string; full: string } | null {
	if (r.ref.collection !== 'judgments') return null;
	const p = propsOf(r);
	const ecli = textOf(p.ecli) ?? keyEcli(r.ref.key);
	return ecli
		? uitspraakKop({
				ecli,
				props: p,
				advocate_general: textOf(p.advocate_general),
				advocate_general_role: textOf(p.advocate_general_role)
			})
		: null;
}

function groepVanRij(r: Row): string {
	switch (r.ref.collection) {
		case 'articles': {
			const bwb = lawIdOf(r.props);
			const m = bwb ? get(instrumentMetaStore).get(bwb) : null;
			// Where the law is not loaded yet, its name as the row's title carries it.
			const uitTitel = /^(?:artikel|art\.)\s+\S+\s+(.+)$/i.exec(r.title)?.[1];
			return lawName(m, uitTitel ?? bwb ?? FILTER_GROUP_LABEL[r.filterGroup]);
		}
		case 'documents':
		case 'decisions': {
			const nr = dossierOf(r);
			const kort = textOf(propsOf(r).dossier_short_title);
			return nr
				? dossierLabel({ number: nr, short_title: kort })
				: FILTER_GROUP_LABEL[r.filterGroup];
		}
		case 'judgments': {
			const names = propsOf(r).names;
			const head = judgmentHead(r);
			return head
				? zaakNaam(
						head.short,
						Array.isArray(names) ? names.filter((n): n is string => typeof n === 'string') : []
					)
				: r.title;
		}
		default:
			return FILTER_GROUP_LABEL[r.filterGroup];
	}
}

/**
 * The bron as its reader cites it: a Kamerstuk by its number, a vote as a vote, a judgment by
 * its court and date; else null.
 */
function readerCitation(r: Row): { kort: string; voluit?: string } | null {
	const head = judgmentHead(r);
	if (head) return { kort: head.short, voluit: head.full };
	const p = propsOf(r);
	if (r.ref.collection === 'decisions')
		return voteCitation({
			date: textOf(p.date) ?? r.date,
			chamber: textOf(p.chamber),
			subject: textOf(p.subject) ?? textOf(p.title) ?? r.title
		});
	if (r.ref.collection !== 'documents') return null;
	const kort = kamerstukCitation({
		chamber: textOf(p.chamber),
		session_year: textOf(p.session_year),
		date: textOf(p.date) ?? r.date,
		dossier_number: dossierNumberOf(p),
		dossier_suffix: textOf(p.dossier_suffix),
		number: p.sequence != null ? String(p.sequence) : textOf(p.number)
	});
	return kort ? { kort } : null;
}

/**
 * The row's citation: its reader's, at the place the row names; a date in words. Never the
 * row's lid: that is a lid of the selected article, not a place in this bron.
 */
function citationOf(r: Row): { kort: string; voluit?: string | null } {
	const own = readerCitation(r);
	const place = (s: string) =>
		[s, r.position, own ? null : (r.identifier ?? langeDatum(r.date))].filter(Boolean).join(', ');
	return { kort: place(own?.kort ?? r.title), voluit: own?.voluit ? place(own.voluit) : null };
}

/** The row as an item; null for a row without an address (a bron not in the data). */
export function itemVanRij(r: Row): MapItem | null {
	const id = focusOf(r.ref);
	if (!id || r.missing) return null;
	const c = r.ref.collection;
	const wet = c === 'articles' || c === 'instruments' ? lawIdOf(r.props) : null;
	return bewaarItem(
		id,
		{ ...citationOf(r), at: r.at },
		{ groep: groepVanRij(r), dossier: dossierOf(r), wet }
	);
}
