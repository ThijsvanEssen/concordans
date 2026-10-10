// A vote in a dossier's timeline: the API gives the Eerste Kamer's its own keys.

/**
 * A vote of the Eerste Kamer (API 0.59), taken from its own site.
 * TODO(backend): `chamber`, `result` and `method` on a timeline decision; until then its key.
 */
export const isEkDecision = (nodeId: string | null | undefined) =>
	!!nodeId?.startsWith('decisions/ek_');
