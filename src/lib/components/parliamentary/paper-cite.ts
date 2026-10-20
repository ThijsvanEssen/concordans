// A Kamerstuk as a lawyer cites it (Kamerstukken II 2025/26, 37020 XVI, nr. 57) and an alinea
// of it after that (…, nr. 57, alinea 4). Its reader's head and menus, and a bundel that
// shows a kept alinea, cite it from here, so a paper is kept and cited alike everywhere.
import { naamVan } from '$lib/bron/menselijk';
import { kamerstukCitation } from './kamerstuk';
import { bewaarItem, type MapItem } from '$lib/map/map';
import { ownKind } from '$lib/text/document-kind';
import { textOf } from '$lib/text/words';

/** What a document gives to cite it: its record (its light node's props apart). */
type CitedPaper = {
	key: string;
	kind?: string | null;
	title?: string | null;
	chamber?: string | null;
	number?: string | number | null;
	dossier_numbers?: string[] | null;
};

/**
 * A paper as it is cited and kept: `citation` its Kamerstuk (null for a paper that is none),
 * `name` that or its title, `full` with its kind (`… nr. 57 (Motie)`), and the `item` Bewaar
 * keeps, under its dossier.
 */
export function citePaper(doc: CitedPaper, props: Record<string, unknown> = {}) {
	const kind = ownKind(doc.kind);
	const citation = kamerstukCitation({
		chamber: doc.chamber,
		session_year: textOf(props.session_year),
		dossier_number: textOf(props.dossier_number) ?? doc.dossier_numbers?.[0],
		dossier_suffix: textOf(props.dossier_suffix),
		number: doc.number
	});
	const name = citation ?? doc.title ?? naamVan('documents', doc);
	const full = citation && kind ? `${citation} (${kind})` : name;
	const dossier = doc.dossier_numbers?.[0] ?? null;
	const context = dossier ? { dossier } : { groep: name };
	const id = `documents/${doc.key}`;
	return {
		id,
		kind,
		citation,
		name,
		full,
		context,
		item: bewaarItem(id, { kort: name, voluit: full }, context)
	};
}
export type PaperCitation = ReturnType<typeof citePaper>;

/**
 * The alineas of a paper as their menu cites and keeps them: kort and voluit with `alinea 4`,
 * the link to its place, and the item Bewaar keeps, under the paper's dossier. Per alinea only
 * its number and its anchor as the API gives them (`paperParagraphs`: `4`, `p-360a090c`) and
 * its link are added.
 */
export const paperParagraphCite =
	(paper: PaperCitation) =>
	(
		n: number,
		at: string,
		link: string
	): { kort: string; voluit: string; link: string; bewaar: MapItem } => {
		const place = `alinea ${n}`;
		const kort = `${paper.name}, ${place}`;
		const voluit = `${paper.full}, ${place}`;
		return {
			kort,
			voluit,
			link,
			bewaar: bewaarItem(paper.id, { at, kort, voluit }, paper.context)
		};
	};

/**
 * A passage of a paper, a section as the API gives it (a memorie's toelichting on an article),
 * as its menu cites and keeps it: after the paper, `§` and its heading as the memorie prints it
 * (`…, nr. 3, § Artikel X, onderdeel A (…)`), kept at its id (`s-300`). The form its row under
 * the article keeps it in (map/rij.ts): one item, from either.
 */
export const paperSectionCite =
	(paper: PaperCitation) =>
	(
		section: { id: string; heading: string },
		link: string
	): { kort: string; voluit: string; link: string; bewaar: MapItem } => {
		const place = `§ ${section.heading.trim()}`;
		const kort = `${paper.name}, ${place}`;
		const voluit = `${paper.full}, ${place}`;
		return {
			kort,
			voluit,
			link,
			bewaar: bewaarItem(paper.id, { at: section.id, kort, voluit }, paper.context)
		};
	};
