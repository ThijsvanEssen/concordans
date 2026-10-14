// The camera of the netwerk, kept in this module: GraphView is unmounted when the mode leaves
// Netwerk and mounted again on return, and the view should not re-fit then. The canvas is
// narrower beside a reader (`compact`), so each width keeps its own camera.
import { onForget } from '$lib/util/forget';

export type Camera = { x: number; y: number; ratio: number };
export type CameraWidth = 'full' | 'compact';

const cameras = new Map<CameraWidth, Camera>();
const drawn = new Map<CameraWidth, ReadonlySet<string>>();
onForget(() => {
	cameras.clear();
	drawn.clear();
});

/**
 * The canvas of this width now draws these bronnen. True when the view keeps its camera:
 * the bronnen drawn before are all still there. Otherwise the kept camera is dropped.
 */
export function keepsCamera(width: CameraWidth, ids: ReadonlySet<string>): boolean {
	const before = drawn.get(width);
	drawn.set(width, ids);
	if (before && before.size > 0 && [...before].every((id) => ids.has(id))) return true;
	cameras.delete(width);
	return false;
}

export const savedCamera = (width: CameraWidth): Camera | null => cameras.get(width) ?? null;

export const saveCamera = (width: CameraWidth, camera: Camera) => void cameras.set(width, camera);
