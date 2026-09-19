import { recordInstrument } from '$lib/api/instrument-cache';
import { getInstrumentCitations } from '$lib/api/nodes';
import { perfStart } from '$lib/util/perf';
import { nodeToGraphNode, classifyEdgeKind, SCAFFOLDING_RELATIONS } from '../types';
import type { GraphNode } from '../types';
import type { GraphContext } from './context';
import type { GraphStore } from './types';

export function createWetCitations(ctx: GraphContext): Pick<GraphStore, 'loadInstrumentCitations'> {
  const {
    nodes,
    edges,
    updateNodes,
    updateEdges,
    touchNode
  } = ctx;

  return {

    loadInstrumentCitations: async (bwbId, opts) => {
      const endTotal = perfStart(`loadInstrumentCitations(${bwbId})`);
      try {
        const resp = await getInstrumentCitations(bwbId, {
          maxEdges: 20000,
          relations: opts?.relations,
        });
        let added = 0;
        // 1. Materialise foreign nodes from the side payload, indexed by id.
        //    Every side-payload node carries its fields under `.props` — the
        //    backend serializes them inside an envelope (probed live; the
        //    spec docs claimed a flat shape but actual delivery is wrapped).
        const foreignArticles = resp.nodes.instrument_articles ?? [];
        // 1a. Cluster foreign articles by bwb so they land in tidy
        //     per-wet groups on an outer ring instead of being dumped wherever
        //     FA2 first happens to place them.
        const foreignByBwb = new Map<string, typeof foreignArticles>();
        for (const a of foreignArticles) {
          const k = a.props.bwb_id ?? a.props.celex ?? 'unknown';
          let arr = foreignByBwb.get(k);
          if (!arr) { arr = []; foreignByBwb.set(k, arr); }
          arr.push(a);
        }
        const foreignPositions = new Map<string, { x: number; y: number }>();
        const totalForeign = foreignArticles.length;
        if (totalForeign > 0) {
          // Foreign wets sit on a ring around the focal wet, one disc per
          // wet, sized by article count. The data is long-tail (live: ~175
          // wets, of which ~150 contribute 1–4 articles), so two decisions
          // shape the layout:
          //
          //   • Long-tail wets (< BIG_THRESHOLD articles) are dropped from
          //     the canvas. Materialising 150 tiny clusters costs a ring of
          //     real-estate without producing readable structure — the
          //     article-per-wet signal lives in the Index tab. We keep only
          //     the wets that carry a recognisable citation pattern.
          //
          //   • Big-wet discs get their own angular slot on a ring sized to
          //     the disc, with explicit gaps between discs. The earlier
          //     version allocated arcs proportional to article count on a
          //     fixed-radius ring, which guaranteed adjacent discs touched
          //     and squashed small big-wets into slivers. Sizing the arc
          //     from the disc diameter (plus a fixed gap) ensures every wet
          //     reads as a separate cluster regardless of count.
          const BIG_THRESHOLD = 5;
          const DISC_GAP = 80;       // px between adjacent discs on the ring
          const FOCAL_MARGIN = 140;  // px of breathing room outside focal articles
          const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

          const sortedWets = [...foreignByBwb.entries()].sort(
            ([, a], [, b]) => b.length - a.length
          );
          const bigWets = sortedWets.filter(([, m]) => m.length >= BIG_THRESHOLD);

          // Measure the outermost focal-article position so the foreign
          // ring sits clearly outside it. Read from current article nodes
          // (the focal wet was loaded by a previous step); fall back to a
          // sane default when nothing's on canvas yet.
          let focalExtent = 0;
          for (const [, n] of nodes) {
            if (n.kind !== 'article') continue;
            const nn = n as GraphNode & { x?: number; y?: number };
            if (typeof nn.x === 'number' && typeof nn.y === 'number') {
              const d = Math.hypot(nn.x, nn.y);
              if (d > focalExtent) focalExtent = d;
            }
          }
          if (focalExtent === 0) focalExtent = 500;

          // Disc radius scales with √N. The constant (×9) is much larger
          // than the old packing's effective radius (~50 px for a
          // 130-article wet) — large enough that each wet reads as a blob
          // rather than a speck.
          const discs = bigWets.map(([, members]) => ({
            members,
            r: Math.max(34, Math.sqrt(members.length) * 9),
          }));

          // Pick ring radius so the ring's circumference accommodates every
          // disc's diameter plus the minimum gap. Also enforce a minimum
          // that clears the focal cluster. If the focal-clearance minimum
          // gives us *more* circumference than we need, the surplus gets
          // redistributed below as extra inter-disc gap so discs stay
          // spread evenly around 2π instead of bunching at the top.
          const minNeeded = discs.reduce((s, d) => s + 2 * d.r + DISC_GAP, 0);
          const maxDiscR = discs.reduce((m, d) => Math.max(m, d.r), 0);
          const ringR = Math.max(
            focalExtent + FOCAL_MARGIN + maxDiscR,
            minNeeded / (2 * Math.PI)
          );

          // Surplus circumference (zero if ring is sized exactly to fit)
          // distributed equally across discs so adjacent gaps are uniform.
          const sumDiameter = discs.reduce((s, d) => s + 2 * d.r, 0);
          const surplus = 2 * Math.PI * ringR - sumDiameter;
          const perDiscGap = discs.length > 0 ? surplus / discs.length : 0;

          // Place largest discs first, starting at top (-π/2) and going
          // clockwise. Each disc's arc = its own diameter + the equal share
          // of remaining circumference; arcs therefore sum to exactly 2π
          // and discs sit at evenly spaced angular positions, regardless of
          // whether the ring is large or small relative to disc count.
          let accAngle = -Math.PI / 2;
          for (const d of discs) {
            const arc = (2 * d.r + perDiscGap) / ringR;
            const centerAngle = accAngle + arc / 2;
            const cx = Math.cos(centerAngle) * ringR;
            const cy = Math.sin(centerAngle) * ringR;
            // Sunflower-pack the wet's articles inside its disc. Spacing
            // chosen so the outermost member sits at ~d.r.
            const spacing = d.r / Math.max(Math.sqrt(d.members.length), 1);
            d.members.forEach((a, mi) => {
              const rr = spacing * Math.sqrt(mi);
              const ang = mi * GOLDEN_ANGLE;
              foreignPositions.set(a.id, {
                x: cx + Math.cos(ang) * rr,
                y: cy + Math.sin(ang) * rr,
              });
            });
            accAngle += arc;
          }
        }
        // 1b. Touch the foreign article nodes with seeded positions and feed
        //     short_title into the instrument cache so nodeLabel can render
        //     "Art. 68 Sv" instead of bare "Art. 68".
        //     Articles from long-tail wets (no entry in foreignPositions)
        //     are skipped entirely — see the BIG_THRESHOLD comment above.
        //     Edges to those articles drop out automatically at the edge
        //     loop below because their endpoints aren't on canvas. We do
        //     still feed their short_title into the instrument cache so
        //     references via the instrument node (if any) read correctly.
        for (const a of foreignArticles) {
          const p = a.props;
          if (p.bwb_id && p.short_title) {
            recordInstrument({ bwb_id: p.bwb_id, short_title: p.short_title });
          }
          const pos = foreignPositions.get(a.id);
          // No position → long-tail wet, dropped from canvas. If the node
          // happens to be already on canvas (loadInstrument's articles
          // endpoint emits cross-wet references), leave it alone; the next
          // step's foreign-position logic owns the layout for big-wet
          // articles.
          if (!pos) continue;
          const existing = nodes.get(a.id);
          if (existing) {
            // Override the focal layout's position with the foreign-disc
            // position. Without this, foreign articles emitted by the
            // /instruments/{bwb}/articles endpoint keep the per-bwb arc
            // they got on the focal ring — exactly the bug the new layout
            // is trying to fix.
            (existing as GraphNode & { x?: number; y?: number }).x = pos.x;
            (existing as GraphNode & { x?: number; y?: number }).y = pos.y;
            touchNode(a.id, existing);
            continue;
          }
          const node = nodeToGraphNode({
            id: a.id, key: a.key, collection: 'instrument_articles', type: 'instrument_article',
            display_name: p.display_name ?? (p.article_number ? `Art. ${p.article_number}` : a.key),
            labels: ['Artikel'],
            props: {
              bwb_id: p.bwb_id,
              celex: p.celex,
              article_number: p.article_number,
              stub: p.stub,
            },
          });
          (node as GraphNode & { x?: number; y?: number }).x = pos.x;
          (node as GraphNode & { x?: number; y?: number }).y = pos.y;
          touchNode(a.id, node);
          added++;
        }
        for (const j of resp.nodes.judgments ?? []) {
          if (nodes.has(j.id)) continue;
          const p = j.props;
          touchNode(j.id, nodeToGraphNode({
            id: j.id, key: j.key, collection: 'judgments', type: 'judgment',
            display_name: p.display_name ?? p.ecli ?? 'Uitspraak',
            labels: ['Arrest'],
            props: { ecli: p.ecli ?? null },
          }));
          added++;
        }
        for (const pub of resp.nodes.publications ?? []) {
          if (nodes.has(pub.id)) continue;
          const p = pub.props;
          touchNode(pub.id, nodeToGraphNode({
            id: pub.id, key: pub.key, collection: 'publications', type: 'publication',
            display_name: p.display_name ?? p.titel ?? p.title ?? p.soort ?? pub.key,
            labels: ['Publicatie'],
            props: {
              soort: p.soort ?? null,
              titel: p.titel ?? p.title ?? null,
              datum: p.datum ?? null,
              volgnummer: p.volgnummer ?? null,
              dossier_nummer: p.dossier_nummer ?? null,
              tk_url: p.tk_url ?? null,
            },
          }));
          added++;
        }
        for (const d of resp.nodes.kamerstukdossiers ?? []) {
          if (nodes.has(d.id)) continue;
          const p = d.props;
          touchNode(d.id, nodeToGraphNode({
            id: d.id, key: d.key, collection: 'kamerstukdossiers', type: 'dossier',
            display_name: p.display_name ?? p.titel ?? p.kamerstuknummer ?? d.key,
            labels: ['Dossier'],
            props: {
              kamerstuknummer: p.kamerstuknummer ?? null,
              titel: p.titel ?? null,
              huidige_fase: p.huidige_fase ?? null,
            },
          }));
          added++;
        }
        for (const inst of resp.nodes.instruments ?? []) {
          const p = inst.props;
          // Feed the metadata cache so foreign articles' nodeLabel lookup
          // (instrumentMetaStore.get(bwb_id)) finds the citation_title even
          // when the article's own short_title was null.
          if (p.bwb_id) {
            recordInstrument({
              bwb_id: p.bwb_id,
              citation_title: p.citation_title ?? null,
            });
          }
          if (nodes.has(inst.id)) continue;
          touchNode(inst.id, nodeToGraphNode({
            id: inst.id, key: inst.key, collection: 'instruments', type: 'instrument',
            display_name: p.display_name ?? p.citation_title ?? inst.key,
            labels: ['Wet'],
            props: { bwb_id: p.bwb_id, citation_title: p.citation_title ?? null },
          }));
          added++;
        }
        // 2. Edges. Skip any whose endpoints aren't on canvas (defensive —
        //    shouldn't happen with the side payload, but cheap insurance).
        let addedEdges = 0;
        for (const e of resp.edges) {
          if (!nodes.has(e.from) || !nodes.has(e.to)) continue;
          const rel = e.relation;
          if (SCAFFOLDING_RELATIONS.has(rel)) continue;
          const eId = `${e.from}->${e.to}:${rel}`;
          if (edges.has(eId)) continue;
          edges.set(eId, {
            id: eId, source: e.from, target: e.to,
            kind: classifyEdgeKind(rel, nodes.get(e.from)?.kind, nodes.get(e.to)?.kind),
            label: rel.replace(/_/g, ' '), directed: true, confidence: null, relation: rel,
            meta: e.meta as Record<string, unknown> | null | undefined ?? null,
          });
          addedEdges++;
        }
        // No placeAdditiveLayer here. The foreign-article positions computed
        // above are structural (one disc per wet on a ring around the focal
        // cluster); the additive-scatter would wipe them and pile every new
        // article into one 60° wedge. Other layer loaders (Arresten,
        // Dossiers) still use it because they have no structural layout.
        updateNodes();
        updateEdges();
        console.log(`[graph-store] loadInstrumentCitations(${bwbId}): +${added} nodes, +${addedEdges} edges (${resp.total_edges} edges available)`);
        return { count: added };
      } catch (err) {
        console.warn('[graph-store] loadInstrumentCitations failed:', err);
        return null;
      } finally {
        endTotal();
      }
    },
  };
}
