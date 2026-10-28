// The Blad of the Netwerkkeuze on a phone (Weergave, Aantal stappen, filters) is held by the
// werkplek; a weergave that wants to open it from its own top asks for it here (DS Verband,
// Telefoon: the button "Verband, 3 stappen").
import { getContext, setContext } from 'svelte';

const KEY = Symbol('weergave-blad');

type WeergaveBlad = { open: () => void; readonly isOpen: boolean };

/** The werkplek gives its opener and whether it is open; null where there is no Blad (a wide screen, a test). */
export const provideWeergaveBlad = (blad: WeergaveBlad) => setContext(KEY, blad);
export const useWeergaveBlad = (): WeergaveBlad | null =>
	getContext<WeergaveBlad | undefined>(KEY) ?? null;
