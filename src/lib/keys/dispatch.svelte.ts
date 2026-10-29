// The one listener of the keys of `pagina` (register.ts). A component that answers a key says so
// with `answer(handler, fn)` for as long as it stands; the last to say so answers first, and
// answers `false` to let the key go on. Nothing here knows what a key does: the register says
// what it is, the component what happens.
import { modalOpen } from '$lib/actions/keys';
import { isCombo, TOETSEN, type Combo, type Toets } from './register';

type Answer = (e: KeyboardEvent, combo: Combo, toets: Toets) => boolean | void;
const answers = new Map<string, Answer[]>();

/** Answers the key(s) of `handler` until the returned function is called. */
export function answer(handler: string, fn: Answer): () => void {
	const stack = answers.get(handler) ?? [];
	stack.push(fn);
	answers.set(handler, stack);
	return () => {
		const now = answers.get(handler) ?? [];
		now.splice(now.indexOf(fn), 1);
	};
}

/** Whether something answers `handler` now: the key is only bound where its page stands. */
export const answered = (handler: string) => (answers.get(handler)?.length ?? 0) > 0;

/** The window's keydown: install once, at the root. */
export function onKeydown(e: KeyboardEvent): void {
	if (e.defaultPrevented || e.repeat) return;
	for (const toets of TOETSEN) {
		if (toets.soort !== 'pagina') continue;
		const combo = toets.keys.find((c) => isCombo(e, c));
		if (!combo) continue;
		// A Blad, a dialog or a menu holds the page: only the keys that belong to it go through.
		if (!toets.inDialoog && modalOpen()) return;
		const stack = answers.get(toets.handler) ?? [];
		for (let i = stack.length - 1; i >= 0; i--) {
			if (stack[i](e, combo, toets) !== false) {
				e.preventDefault();
				return;
			}
		}
		return;
	}
}
