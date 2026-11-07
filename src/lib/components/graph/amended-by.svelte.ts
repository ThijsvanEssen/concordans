// The lanes ask `amended-by` for each chosen wet (B82, lane-amended.ts): one request per wet, asked
// once and shared with Verbonden; a failure says nothing, the lines still do.
import { ignore } from '$lib/api/errors';
import { getAmendedBy } from '$lib/api/records';
import {
	amendedKey,
	chosenLaws,
	lawAmended,
	NOT_AMENDED,
	type Amended
} from '$lib/graph/lane-amended';

async function askAmended(laws: string): Promise<Amended> {
	const found = await Promise.all(
		(laws ? laws.split(' ') : []).map((bwb) =>
			getAmendedBy(bwb).then(
				(data) => [amendedKey(`instruments/${bwb}`), lawAmended(data)] as const,
				(e: unknown) => (ignore('Banen amended-by')(e), null)
			)
		)
	);
	return new Map(found.filter((f) => f !== null));
}

/** What `amended-by` says of the chosen wetten, as it comes in; until then nothing. */
export function amendedOf(chosen: () => readonly string[]): { readonly current: Amended } {
	let amended = $state.raw<Amended>(NOT_AMENDED);
	const laws = $derived(chosenLaws(chosen()));
	$effect(() => {
		let current = true;
		askAmended(laws)
			.then((a) => current && (amended = a))
			.catch(ignore('Banen amended-by'));
		return () => (current = false);
	});
	return {
		get current() {
			return amended;
		}
	};
}
