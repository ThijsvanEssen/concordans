// What a stemming is "Over": the stuk it votes on. The source links an eindstemming over a
// wetsvoorstel to the advice of the Raad van State of its dossier (36496: "Over: Advies Afdeling
// advisering Raad van State"); the advice is not what was voted on, so it is not named as such.
import type { Schema } from '$lib/api/types';

export const isAdvicePaper = (p: Pick<Schema<'DecisionPaperDTO'>, 'kind'> | null | undefined) =>
	/^advies afdeling advisering/i.test(p?.kind ?? '');
