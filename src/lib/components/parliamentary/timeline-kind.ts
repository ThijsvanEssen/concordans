// The kind of an entry of a dossier's timeline, as a filter and a label name it. The API
// gives a decision the kind of the case it decided (`Motie`, the Zaak.Soort), and a document
// its own kind (`Motie`): two different things that read as one.

type EntryLike = { kind?: string | null; node_type?: string | null };

/** `Stemming over motie` for the vote, `Motie` for the paper. */
export function timelineKind(e: EntryLike): string {
	const kind = e.kind?.trim() || '';
	if (e.node_type === 'decision') return kind ? `Stemming over ${kind.toLowerCase()}` : 'Stemming';
	return kind ? kind.charAt(0).toUpperCase() + kind.slice(1) : 'Overig';
}
