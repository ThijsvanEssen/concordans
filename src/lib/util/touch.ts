// A device without a keyboard: a phone, or a tablet without one attached. It shows no key hints
// (Thijs, 29 Oct: "De telefoon heeft geen toetsenbord"); the keys themselves keep working.
export const TOUCH_ONLY = '(hover: none) and (pointer: coarse)';

/** Whether the device is touch only now; false where there is no window. */
export const touchOnly = (): boolean =>
	typeof window !== 'undefined' && window.matchMedia(TOUCH_ONLY).matches;
