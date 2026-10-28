// The measures of the drawing that the werkplek's canvas and the Netwerkschets share
// (Netwerkcanvas, Maten): the hull's margin, line and fill, the rim of a cluster's disc, the
// ring of the chosen one. GraphCanvas, hulls.ts and nodeSprites.ts read them here, and so does
// the sketch; a number changed here changes both drawings, and the guard (draw-spec.test)
// holds the canvas's CSS to it. Colours and dashes are not here: nodeSprites.ts reads them
// from the tokens (`hullColorFor`, `hullDashFor`, `edgeColorFor`).

/** A hull: a disc round its members plus this margin, the line, its fill and its halo. */
export const HULL = {
	margin: 16,
	line: 1.6,
	/** The rim of a chosen hull: ink on a halo of paper. */
	lineChosen: 2.4,
	halo: 6.4,
	/** The fill, a part of the colour of its kind. */
	fill: 0.05,
	/** Between a hull's top and its name. */
	labelGap: 6,
	/** The height of its name's pill, one line. */
	labelHeight: 22
} as const;

/** A cluster's disc: its colour fills this part of its paper rim (19 of 21.5). */
export const CLUSTER_FILL = 19 / 21.5;

/** The focus: 18 px of ink on a halo of paper (the sketch's bron in the middle). */
export const FOCUS = { size: 18, halo: 4.5 } as const;

/** The radius of a bron in the sketch, and the ring round the chosen one. */
export const NODE = { radius: 6.5, ring: 11 } as const;
