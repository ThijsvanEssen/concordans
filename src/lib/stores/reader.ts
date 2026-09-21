import { writable } from 'svelte/store';

/** Key of the citation the pointer or focus is on, so the text and the rail can highlight it together. */
export const focusedCitationKey = writable<string | null>(null);

export const setFocusedCitation = (key: string | null) => focusedCitationKey.set(key);
