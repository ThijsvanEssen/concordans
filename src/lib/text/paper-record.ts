// The record a Kamerstuk is cited by (Kamerstukken II 2025/26, 37020 XVI, nr. 57), from its
// answer and its light node's props: its reader's head (paper-cite) and its first paint alike.
import { citationRecord } from '$lib/text/citation-record';
import { ownKind } from '$lib/text/document-kind';
import { textOf } from '$lib/text/words';

/** What a document gives to cite it: its record (its light node's props apart). */
export type CitedPaper = {
	key: string;
	kind?: string | null;
	title?: string | null;
	chamber?: string | null;
	number?: string | number | null;
	dossier_numbers?: string[] | null;
};

/** Its record, or null for a paper without a number (no Kamerstuk). */
export function paperRecord(doc: CitedPaper, props: Record<string, unknown> = {}) {
	return doc.number == null || doc.number === ''
		? null
		: citationRecord({
				kind: 'kamerstuk',
				paperKind: ownKind(doc.kind),
				chamber: doc.chamber,
				session_year: textOf(props.session_year),
				dossier_number: textOf(props.dossier_number) ?? doc.dossier_numbers?.[0],
				dossier_suffix: textOf(props.dossier_suffix),
				number: doc.number
			});
}
