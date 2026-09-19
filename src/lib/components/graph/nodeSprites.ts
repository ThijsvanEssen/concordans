// Per-kind shape sprites for sigma's NodeImageProgram.
//
// We keep solid kind colours (NODE_FILL / NODE_STROKE in GraphView.svelte) and
// vary only the silhouette. Sprites are generated once at module init as
// data: URLs so there are no asset files to manage and colours stay sourced
// from a single table here.
//
// Selection: when a node is the current focus, swap to the `focused` sprite
// variant, which redraws the same shape with a crimson outer stroke. The
// `border` program retains its own selection ring for circle kinds — only the
// shapes rendered via NodeImageProgram need this swap.

import type { GraphNodeKind } from '$lib/graph/types';

export type NodeShape = 'circle' | 'diamond' | 'roundedRect' | 'hexagon';

// Live-canvas palette aligned met de homepage-legenda (Hero-grafiek + Drie
// domeinen-tegels): artikel = open ring (paper-vulling, ink stroke); arrest
// = vol indigo; dossier = open accent-diamant. Instrument blijft het
// donkere "drager"-symbool. Kept duplicated here on purpose: sprites need
// the colour at module-init time, and re-importing the Svelte file would
// pull in the whole graph view.
const PAPER = '#FFFDF4';
const FILL: Record<GraphNodeKind, string> = {
  article:    PAPER,
  instrument: '#1A1814',
  judgment:   '#2B3A5C',
  dossier:    PAPER,
  commissie:  '#8A6B3A',
  fractie:    '#44505E',
  lid:        '#44505E',
  tkstuk:     '#7A1F1A',
  activity:   '#8A6B3A',
  other:      PAPER,
};
const STROKE: Record<GraphNodeKind, string> = {
  article:    '#1A1814',
  instrument: '#1A1814',
  judgment:   '#2B3A5C',
  dossier:    '#7A1F1A',
  commissie:  '#8A6B3A',
  fractie:    '#44505E',
  lid:        '#44505E',
  tkstuk:     '#7A1F1A',
  activity:   '#8A6B3A',
  other:      '#9A9485',
};
const STUB_FILL = '#FFFDF4';
const STUB_STROKE = '#B8B0A4';
const FOCUS_STROKE = '#7A1F1A'; // crimson — matches the existing selectionColor

export const KIND_SHAPE: Record<GraphNodeKind, NodeShape> = {
  article:    'circle',     // open ring (paper fill, ink stroke) — homepage legend
  instrument: 'diamond',    // filled dark diamond — top-level wet
  judgment:   'circle',     // solid indigo dot — homepage legend
  dossier:    'diamond',    // open accent diamond — homepage legend
  tkstuk:     'hexagon',
  commissie:  'hexagon',
  activity:   'hexagon',
  fractie:    'hexagon',
  lid:        'hexagon',
  other:      'circle',
};

export function shapeFor(kind: GraphNodeKind): NodeShape {
  return KIND_SHAPE[kind] ?? 'circle';
}

// Sprite viewBox is 32×32 with shapes centred at (16,16) and "radius" 14.
// Sigma renders the image into a square of side 2*size centred on the node;
// the shape's bounding box matches that square so visual weight tracks
// `size` the same way circles do.
const VB = 32;
const C = 16;
const R = 14;

function pathFor(shape: NodeShape): string {
  switch (shape) {
    case 'circle':
      return `<circle cx="${C}" cy="${C}" r="${R}" />`;
    case 'diamond':
      return `<polygon points="${C},${C - R} ${C + R},${C} ${C},${C + R} ${C - R},${C}" />`;
    case 'hexagon': {
      // Flat-top hexagon — wider than tall feels more "card-like" for hubs.
      const dx = R;
      const dy = R * 0.866; // sin(60°)
      const hx = R * 0.5;   // cos(60°)
      const pts = [
        [C - dx, C],
        [C - hx, C - dy],
        [C + hx, C - dy],
        [C + dx, C],
        [C + hx, C + dy],
        [C - hx, C + dy],
      ];
      return `<polygon points="${pts.map((p) => p.join(',')).join(' ')}" />`;
    }
    case 'roundedRect': {
      const s = R * 1.7; // side length — area parity with the circle
      const x = C - s / 2;
      const rr = s * 0.22;
      return `<rect x="${x}" y="${x}" width="${s}" height="${s}" rx="${rr}" ry="${rr}" />`;
    }
  }
}

function svgFor(shape: NodeShape, fill: string, stroke: string, strokeWidth: number): string {
  // The path string starts with the tag name (circle/polygon/rect); inject
  // fill/stroke as attributes by string-splicing — cheaper than building a
  // DOM and serialising it.
  const raw = pathFor(shape);
  const attrs = `fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"`;
  const withAttrs = raw.replace(/^<(\w+)\s/, `<$1 ${attrs} `);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}">${withAttrs}</svg>`;
}

function toDataUrl(svg: string): string {
  // SVG data URLs don't strictly need base64, but base64 avoids any % / # /
  // quote escaping bugs across browsers and keeps the URL stable.
  if (typeof btoa === 'function') return `data:image/svg+xml;base64,${btoa(svg)}`;
  // SSR fallback — node-image only runs in the browser anyway, but the
  // module gets imported during SSR so we must not throw at import time.
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

type Variant = 'normal' | 'focused' | 'stub';
const cache: Map<string, string> = new Map();

function key(kind: GraphNodeKind, variant: Variant): string {
  return `${kind}:${variant}`;
}

function buildSprite(kind: GraphNodeKind, variant: Variant): string {
  const shape = shapeFor(kind);
  if (variant === 'stub') {
    // Stubs houden hun paper-vulling (signaleert "nog niet ingeladen"),
    // maar krijgen de kind-eigen stroke-kleur in plaats van neutraal
    // grijs. Anders zien een stub-Publicatie (hexagon), stub-Artikel
    // (cirkel) en stub-Dossier (ruit) er bij ver uitzoomen alle drie
    // uit als een naamloos wit puntje.
    return svgFor(shape, STUB_FILL, STROKE[kind] ?? STUB_STROKE, 1.5);
  }
  if (variant === 'focused') return svgFor(shape, FILL[kind], FOCUS_STROKE, 2.8);
  // Open silhouetten (artikel-ring, dossier-diamant) hebben extra stroke
  // nodig anders verdwijnt het paper-vlak in de papier-achtergrond bij
  // uitgezoomd kijken. Gevulde vormen (arrest, instrument) zijn al
  // contrastrijk genoeg met de minimale stroke.
  const isOpen = FILL[kind] === PAPER;
  return svgFor(shape, FILL[kind], STROKE[kind], isOpen ? 2.4 : 1);
}

export function spriteFor(kind: GraphNodeKind, stub: boolean, focused: boolean): string {
  const variant: Variant = stub ? 'stub' : focused ? 'focused' : 'normal';
  const k = key(kind, variant);
  let url = cache.get(k);
  if (!url) {
    url = toDataUrl(buildSprite(kind, variant));
    cache.set(k, url);
  }
  return url;
}

// With keepWithinCircle:true the sprite is clipped to the inscribed circle
// of the node's nominal radius, and the shape (drawn at 14/16 of the sprite
// viewBox) ends up at ~0.875 × node_radius on screen. That's close enough to
// the border program's circles that no size bump is needed — kept as a
// constant for future tuning rather than baking the literal 1.0 into the
// call site.
export const IMAGE_SIZE_BUMP = 1.0;

// Per-axis badge offset at 45° (top-right), in units of node radius. The
// reference is the border-program circle, where the badge sits on the
// silhouette at cos(45°) = 0.707. Non-circle silhouettes at 45° sit inside
// that circle: a diamond's 45° edge is at half the vertex radius, a hexagon
// is between vertex and flat, and a rounded square's near-corner is just
// inside the inscribed circle.
const BADGE_AXIS_OFFSET: Record<NodeShape, number> = {
  circle:      0.707,
  diamond:     0.44,
  hexagon:     0.55,
  roundedRect: 0.62,
};

export function badgeAxisOffset(kind: GraphNodeKind): number {
  return BADGE_AXIS_OFFSET[shapeFor(kind)];
}
