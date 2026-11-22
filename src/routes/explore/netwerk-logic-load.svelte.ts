// The chunk netwerk-logic, asked once: by the page when a netwerk is shown, and ahead of that once
// the page has had its answers (B178). A chunk that does not come is reported and the page loads
// again once from the new release ($lib/util/reload.ts).
import { ignore, report } from '$lib/api/errors';
import { reloadForNewVersion } from '$lib/util/reload';

type Logic = typeof import('./netwerk-logic').netwerkLogic;

let loaded = $state.raw<Logic | null>(null);
let asked: Promise<Logic> | null = null;

/** The logic, once its chunk is in. */
export const logicIn = () => loaded;

export function loadLogic(): Promise<Logic> {
	asked ??= import('./netwerk-logic').then(
		(m) => (loaded = m.netwerkLogic),
		(e: unknown) => {
			asked = null;
			report('Netwerk laden', e);
			reloadForNewVersion();
			throw e;
		}
	);
	return asked;
}

/** Asks it ahead of its use: a failure comes where it is used. */
export const askLogic = () => void loadLogic().catch(ignore('Netwerk vooraf laden'));
