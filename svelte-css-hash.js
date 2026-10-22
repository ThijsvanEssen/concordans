// The class Svelte scopes a component's styles by, from the component's path in the
// project: the same in every build, so the first paint of a reader's address
// ($lib/first-paint, vite.config.ts) can set the app's own classes on the elements it
// paints, and the app's own stylesheets lay them out.
import { createHash } from 'node:crypto';
import { relative, sep } from 'node:path';

/**
 * The scoping class of the component at `filename` (absolute, or relative to the project).
 * @param {string} filename
 * @returns {string}
 */
export function cssHashOf(filename) {
	const path = relative(process.cwd(), filename).split(sep).join('/');
	return `svelte-${createHash('sha256').update(path).digest('hex').slice(0, 10)}`;
}
