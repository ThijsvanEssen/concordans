// ?uit names what is switched off, in one list: the chosen bronnen (`members/x`), the lijnsoorten
// of Relatie (`aanhaling`) and the groupings (`dossier`). The address holds it, so a reload
// or a shared link draws the same canvas.
import { isContainerKind, type ContainerKind } from '$lib/graph/container-membership';
import { isLineKind, type LineKind } from '$lib/graph/line-kind';
import { parseNodeId } from '$lib/vocabulary';

/** The word of the annexes switched off in Tonen. */
const ANNEXES = 'bijlagen';

type Off = {
	chosen: string[];
	lines: LineKind[];
	annexes: boolean;
	groups: ContainerKind[];
};

/** The parts of ?uit; what is none of them is left out. */
export function offOf(value: string | null): Off {
	const off: Off = { chosen: [], lines: [], annexes: false, groups: [] };
	for (const t of (value ?? '').split(',').map((s) => s.trim())) {
		if (parseNodeId(t) !== null) off.chosen.push(t);
		else if (t === ANNEXES) off.annexes = true;
		else if (isLineKind(t)) off.lines.push(t);
		else if (isContainerKind(t)) off.groups.push(t);
	}
	return off;
}

/** ?uit of its parts; null where nothing is off. */
export function offValue(off: Off): string | null {
	const all = [...off.chosen, ...off.lines, ...(off.annexes ? [ANNEXES] : []), ...off.groups];
	return all.length > 0 ? all.join(',') : null;
}

export const sameSet = <T>(a: Iterable<T>, b: Iterable<T>): boolean => {
	const x = new Set(a);
	const y = new Set(b);
	return x.size === y.size && [...x].every((v) => y.has(v));
};
