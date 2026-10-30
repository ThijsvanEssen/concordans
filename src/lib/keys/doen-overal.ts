// What ⌘K does on every page with a bron typed after the word: `keten awb` opens the keten of
// the Awb, `netwerk 36764` the netwerk of the dossier, each in a netwerk of its own. Offered by
// the shell, under the doer of the page (doen.svelte.ts), which answers first where it can.
import { goto } from '$app/navigation';
import { bronHref } from '$lib/bron/href';
import type { Doer, DoRow, Target } from './doen.svelte';

const WHAT = { keten: 'Keten van', netwerk: 'Netwerk van' } as const;

function werkplek(target: Target, keten: boolean): string {
	const params: Record<string, string> = keten ? { weergave: 'keten' } : {};
	return bronHref(target.ref, { keepMode: false, keepNetwerk: false, mode: 'graph', params });
}

export const overalDoer: Doer = {
	rows: (p, target): DoRow[] => {
		const id = p.command.id;
		if ((id !== 'keten' && id !== 'netwerk') || !p.rest) return [];
		const label = `${WHAT[id]} ${target?.label ?? p.rest}`;
		return [
			target
				? { id, label, run: () => goto(werkplek(target, id === 'keten')) }
				: { id, label, why: 'zoekt de bron…', pending: true }
		];
	}
};
