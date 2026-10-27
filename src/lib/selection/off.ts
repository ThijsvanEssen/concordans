// ?uit names what is switched off, in one list: the chosen bronnen (`members/x`), the lijnsoorten
// of Relatie (`aanhaling`) and the groupings (`dossier`). The address holds it, so a reload
// or a shared link draws the same canvas.
import { isContainerKind, type ContainerKind } from '$lib/graph/container-membership';
import { isLijnsoort, type Lijnsoort } from '$lib/graph/lijnsoort';
import { parseNodeId } from '$lib/vocabulary';

/** The word of the bijlagen switched off in Tonen. */
const BIJLAGEN = 'bijlagen';

type Off = {
	chosen: string[];
	lijnen: Lijnsoort[];
	bijlagen: boolean;
	groups: ContainerKind[];
};

/** The parts of ?uit; what is none of them is left out. */
export function offOf(value: string | null): Off {
	const off: Off = { chosen: [], lijnen: [], bijlagen: false, groups: [] };
	for (const t of (value ?? '').split(',').map((s) => s.trim())) {
		if (parseNodeId(t) !== null) off.chosen.push(t);
		else if (t === BIJLAGEN) off.bijlagen = true;
		else if (isLijnsoort(t)) off.lijnen.push(t);
		else if (isContainerKind(t)) off.groups.push(t);
	}
	return off;
}

/** ?uit of its parts; null where nothing is off. */
export function offValue(off: Off): string | null {
	const all = [...off.chosen, ...off.lijnen, ...(off.bijlagen ? [BIJLAGEN] : []), ...off.groups];
	return all.length > 0 ? all.join(',') : null;
}

export const sameSet = <T>(a: Iterable<T>, b: Iterable<T>): boolean => {
	const x = new Set(a);
	const y = new Set(b);
	return x.size === y.size && [...x].every((v) => y.has(v));
};
