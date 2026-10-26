// The camera of the netwerk, kept in this module: GraphView is unmounted when the mode leaves
// Netwerk and mounted again on return, and the view should not re-fit then.
import { onForget } from '$lib/util/forget';

type Camera = { x: number; y: number; ratio: number };

let camera: Camera | null = null;
let drawn: ReadonlySet<string> | undefined;
onForget(() => {
	camera = null;
	drawn = undefined;
});

/**
 * The canvas now draws these bronnen. True when the view keeps its camera: the bronnen drawn
 * before are all still there. Otherwise the kept camera is dropped.
 */
export function keepsCamera(ids: ReadonlySet<string>): boolean {
	const before = drawn;
	drawn = ids;
	if (before && before.size > 0 && [...before].every((id) => ids.has(id))) return true;
	camera = null;
	return false;
}

export const savedCamera = (): Camera | null => camera;

export const saveCamera = (next: Camera) => void (camera = next);
