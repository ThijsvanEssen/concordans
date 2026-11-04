// A law named in an address by its abbreviation or name, /wetten/wft/artikel/1:1, as a reader
// types it: the data knows it by its id. The API resolves what the address cites, and the page
// goes on to the law's own address; without a match it says the bron is not found.
import { articleRef } from '$lib/text/bw';
import { resolveQuery } from '$lib/api/search';
import { isLawId } from './address';
import type { Pad } from './address';

/** The citation an address of a law by name stands for (`art. 1:1 WFT`); null for an id. */
export function citedByName(pad: Pad): string | null {
	if (pad.kind === 'artikel' && !isLawId(pad.law))
		return `${articleRef(null, pad.number)} ${pad.law}`;
	if (pad.kind === 'wet' && !isLawId(pad.law)) return pad.law;
	return null;
}

/** The address of the bron the API resolves the name to, of the same kind; null without. */
export async function pathByName(pad: Pad, signal?: AbortSignal): Promise<string | null> {
	const cited = citedByName(pad);
	if (!cited) return null;
	const answer = await resolveQuery(cited, signal);
	const kind = pad.kind === 'artikel' ? 'article' : 'instrument';
	return answer.kind === kind ? (answer.match?.path ?? null) : null;
}
