// The words before the peildatum of a law and of its article (WholeLawReaderPeildatum), one
// source for that line and for the first paint of an article's address ($lib/first-paint).

/** "Tekst geldend op" today's text; of an expired law, its last one by the day it began. */
export const peildatumLabel = (lastText: boolean): string =>
	lastText ? 'Laatste tekst geldend sinds' : 'Tekst geldend op';
