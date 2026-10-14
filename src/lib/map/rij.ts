// A row of Verbonden as Gemarkeerd keeps it: its citation as its reader gives it, its group per
// law or dossier (an article under its law, a Kamerstuk under its dossier, a judgment as its
// own group, so its overwegingen join it, a vote under its dossier), the rest under its kind.
import { get } from 'svelte/store';
import { focusOf } from '$lib/bron/href';
import { voteCitation } from '$lib/bron/naam';
import { instrumentMetaStore } from '$lib/api/instrument-cache';
import { lawIdOf } from '$lib/graph/types';
import { kamerstukCitation } from '$lib/components/parliamentary/kamerstuk';
import { text } from '$lib/verbonden/edge-meta';
import { dossierNumberOf, longDate, type Row } from '$lib/verbonden/rows';
import { BRON_KIND_LABEL } from '$lib/verbonden/filter';
import { dossierLabel } from '$lib/bron/dossier-naam';
import { bewaarItem, type MapItem } from './map';

const propsOf = (r: Row) => (r.props ?? {}) as Record<string, unknown>;

/** The dossier of a Kamerstuk or vote row, from its props as its reader reads them. */
const dossierOf = (r: Row) =>
	r.ref.collection === 'documents' || r.ref.collection === 'decisions'
		? dossierNumberOf(r.props)
		: null;

export function groepVanRij(r: Row): string {
	switch (r.ref.collection) {
		case 'articles': {
			const bwb = lawIdOf(r.props);
			const m = bwb ? get(instrumentMetaStore).get(bwb) : null;
			// Where the law is not loaded yet, its name as the row's title carries it.
			const uitTitel = /^(?:artikel|art\.)\s+\S+\s+(.+)$/i.exec(r.title)?.[1];
			return m?.citationTitle ?? m?.shortTitle ?? uitTitel ?? bwb ?? BRON_KIND_LABEL[r.kind];
		}
		case 'documents':
		case 'decisions': {
			const nr = dossierOf(r);
			const kort = text(propsOf(r).dossier_short_title);
			return nr ? dossierLabel({ number: nr, short_title: kort }) : BRON_KIND_LABEL[r.kind];
		}
		case 'judgments':
			return r.title;
		default:
			return BRON_KIND_LABEL[r.kind];
	}
}

/** The bron as its reader cites it: a Kamerstuk by its number, a vote as a vote; else null. */
function readerCitation(r: Row): { kort: string; voluit?: string } | null {
	const p = propsOf(r);
	if (r.ref.collection === 'decisions')
		return voteCitation({
			date: text(p.date) ?? r.date,
			chamber: text(p.chamber),
			subject: text(p.subject) ?? text(p.title) ?? r.title
		});
	if (r.ref.collection !== 'documents') return null;
	const kort = kamerstukCitation({
		chamber: text(p.chamber),
		session_year: text(p.session_year),
		dossier_number: dossierNumberOf(p),
		dossier_suffix: text(p.dossier_suffix),
		number: p.sequence != null ? String(p.sequence) : text(p.number)
	});
	return kort ? { kort } : null;
}

/** The row's citation: its reader's, at the place the row names; a date in words. */
function citationOf(r: Row): { kort: string; voluit?: string | null } {
	const own = readerCitation(r);
	const place = (s: string) =>
		[
			s,
			r.lid ? `lid ${r.lid}` : null,
			r.position,
			own ? null : (r.identifier ?? longDate(r.date ?? null))
		]
			.filter(Boolean)
			.join(', ');
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
