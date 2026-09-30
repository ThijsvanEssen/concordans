// The kind of an entry of a dossier's timeline, as a filter and a label name it. The API
// gives a decision the kind of the case it decided (`Motie`, the Zaak.Soort), and a document
// its own kind (`Motie`): two different things that read as one.

type EntryLike = { kind?: string | null; node_type?: string | null; node_id?: string | null };

/**
 * A vote of the Eerste Kamer (API 0.59), taken from its own site.
 * TODO(backend): `chamber`, `result` and `method` on a timeline decision; until then its key.
 */
export const isEkDecision = (nodeId: string | null | undefined) =>
	!!nodeId?.startsWith('decisions/ek_');

/** `Stemming over motie` for the vote, `Motie` for the paper, `Stemming Eerste Kamer`. */
export function timelineKind(e: EntryLike): string {
	const kind = e.kind?.trim() || '';
	if (e.node_type === 'decision') {
		if (isEkDecision(e.node_id)) return 'Stemming Eerste Kamer';
		return kind && kind.toLowerCase() !== 'stemming'
			? `Stemming over ${kind.toLowerCase()}`
			: 'Stemming';
	}
	return kind ? kind.charAt(0).toUpperCase() + kind.slice(1) : 'Overig';
}
