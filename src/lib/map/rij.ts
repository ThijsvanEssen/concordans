// A row of Verbonden as Gemarkeerd keeps it: its citation as Verzamel wrote it, its group per
// law or dossier (an article under its law, a Kamerstuk under its dossier, a judgment as its
// own group, so its overwegingen join it, a vote under its dossier), the rest under its kind.
import { get } from 'svelte/store';
import { focusOf } from '$lib/bron/href';
import { instrumentMetaStore } from '$lib/api/instrument-cache';
import { lawIdOf } from '$lib/graph/types';
import { rowsToText } from '$lib/verbonden/export';
import { dossierNumbersOf, type Row } from '$lib/verbonden/rows';
import { BRON_KIND_LABEL } from '$lib/verbonden/filter';
import { dossierLabel } from '$lib/bron/dossier-naam';
import { bewaarItem, type MapItem } from './map';

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
			const nr = dossierNumbersOf(r.props)[0];
			const p = (r.props ?? {}) as Record<string, unknown>;
			const kort = typeof p.dossier_short_title === 'string' ? p.dossier_short_title : null;
			return nr ? dossierLabel({ number: nr, short_title: kort }) : BRON_KIND_LABEL[r.kind];
		}
		case 'judgments':
			return r.title;
		default:
			return BRON_KIND_LABEL[r.kind];
	}
}

/** The row as an item; null for a row without an address (a bron not in the data). */
export function itemVanRij(r: Row): MapItem | null {
	const id = focusOf(r.ref);
	if (!id || r.missing) return null;
	const c = r.ref.collection;
	const dossier = c === 'documents' || c === 'decisions' ? dossierNumbersOf(r.props)[0] : null;
	const wet = c === 'articles' || c === 'instruments' ? lawIdOf(r.props) : null;
	return bewaarItem(
		id,
		{ kort: rowsToText([r]), at: r.at },
		{ groep: groepVanRij(r), dossier, wet }
	);
}
