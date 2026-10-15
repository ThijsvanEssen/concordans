// The switch Netwerk / Tekst stands in the frame of the reader, top right beside the band
// (Thijs, 10 Oct: no bar under the TopBar). The explore page knows what the switch does;
// the frame learns it through this context.

type ViewSide = 'netwerk' | 'tekst';

export type Weergave = {
	stand: ViewSide;
	onKies: (s: ViewSide) => void;
	/** A bron without a text of its own: the reader already stands beside the network. */
	tekstMogelijk: boolean;
};

export const WEERGAVE_KEY = Symbol('weergave');
