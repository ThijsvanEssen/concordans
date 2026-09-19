import { recordInstrument } from '$lib/api/instrument-cache';
import { getGlobalGraph, getInstrumentLayerGraph, getJudgmentLayerGraph } from '$lib/api/nodes';
import { perfStart } from '$lib/util/perf';
import { compareArticleNumbers } from '$lib/util/sort';
import { nodeToGraphNode, classifyEdgeKind, SCAFFOLDING_RELATIONS } from '../types';
import type { GraphNode } from '../types';
import type { GraphContext } from './context';
import type { GraphStore } from './types';

export function createGlobalLoaders(ctx: GraphContext): Pick<GraphStore, 'loadGlobalGraph' | 'loadInstrumentLayerGraph' | 'loadJudgmentLayerGraph'> {
  const {
    nodes,
    edges,
    cache,
    history,
    selectionStore,
    breadcrumbsStore,
    loadingStore,
    graphModeStore,
    updateNodes,
    updateEdges,
    touchNode,
    prepareBulkLoad,
    placeAdditiveLayer,
    state
  } = ctx;

  return {

    loadGlobalGraph: async () => {
      const endTotal = perfStart('loadGlobalGraph total');
      loadingStore.set({ kind: 'global', phase: 'fetching' });
      try {
        const endFetch = perfStart('loadGlobalGraph fetch');
        const resp = await getGlobalGraph();
        endFetch(`${resp.articles.length} articles, ${resp.judgments.length} judgments, ${resp.edges.length} edges`);

        const instrumentsById = new Map<string, typeof resp.instruments[number]>();
        for (const inst of resp.instruments) {
          recordInstrument(inst);
          instrumentsById.set(inst.id, inst);
        }

        loadingStore.set({ kind: 'global', phase: 'building' });
        const endBuild = perfStart('loadGlobalGraph build');

        const articlesById = new Map<string, typeof resp.articles[number]>();
        for (const a of resp.articles) {
          if (!articlesById.has(a.id)) articlesById.set(a.id, a);
        }

        const judgmentsById = new Map<string, typeof resp.judgments[number]>();
        for (const j of resp.judgments) {
          if (!judgmentsById.has(j.id)) judgmentsById.set(j.id, j);
        }


        // Cluster articles by instrument (bwb_id), sorted by article number
        // within each cluster. Each cluster gets a proportional arc on the
        // outer ring; articles within a cluster arrange on a mini inner ring.
        const articleList = [...articlesById.values()].sort((a, b) => {
          const bwbCmp = (a.bwb_id ?? '').localeCompare(b.bwb_id ?? '');
          if (bwbCmp !== 0) return bwbCmp;
          return compareArticleNumbers(a.article_number, b.article_number);
        });

        const clusters = new Map<string, typeof articleList>();
        for (const a of articleList) {
          // For EU articles bwb_id is null — derive celex from the article key
          // (e.g. "32010l0064_1" → "32010l0064") so they cluster by directive.
          const celex = !a.bwb_id && a.article_number && a.key.endsWith('_' + a.article_number)
            ? a.key.slice(0, -(a.article_number.length + 1))
            : null;
          const key = a.bwb_id ?? celex ?? 'overig';
          let arr = clusters.get(key);
          if (!arr) { arr = []; clusters.set(key, arr); }
          arr.push(a);
        }

        const positions = new Map<string, { x: number; y: number }>();
        const clusterKeys = [...clusters.keys()].sort();

        // Spacing between adjacent nodes on a ring (graph units).
        const NODE_SPACING = 9;
        const CLUSTER_GAP = 30; // minimum gap between adjacent cluster edges

        // Starting radius of the innermost ring for a cluster of n articles.
        // Grows with sqrt(n) — no cap, so large laws get the space they need.
        const innerRingRadius = (n: number) => Math.max(10, 5 + Math.sqrt(n) * 3);

        // Simulate the concentric-ring placement to find the actual outermost
        // radius reached. Used for ring spacing so clusters never overlap.
        function actualClusterRadius(n: number): number {
          if (n <= 1) return 0;
          const baseR = innerRingRadius(n);
          const maxInitRings = Math.ceil(Math.log2(Math.max(n, 2)));
          let placed = 0, ring = 0, maxR = baseR * 0.4;
          while (placed < n) {
            const r = baseR * (0.4 + 0.6 * (ring / maxInitRings));
            const slots = Math.max(6, Math.floor((2 * Math.PI * r) / NODE_SPACING));
            placed += Math.min(slots, n - placed);
            maxR = r;
            ring++;
          }
          return maxR;
        }

        // Outer ring radius: derived from the actual extent of every cluster so
        // no two adjacent clusters ever overlap, regardless of their size.
        const clusterActualR = new Map(clusterKeys.map(k => [k, actualClusterRadius((clusters.get(k) ?? []).length)]));
        const totalPerimeter = clusterKeys.reduce(
          (sum, k) => sum + 2 * (clusterActualR.get(k) ?? 0) + CLUSTER_GAP, 0
        );
        const ringR = Math.max(80, totalPerimeter / (2 * Math.PI));

        clusterKeys.forEach((key, ci) => {
          const members = clusters.get(key) ?? [];
          const clusterR = clusterActualR.get(key) ?? 0;

          // Arc slot sized to the cluster's actual diameter plus the gap.
          const slotArc = (2 * clusterR + CLUSTER_GAP) / ringR;
          const startAngle = clusterKeys
            .slice(0, ci)
            .reduce((acc, k) => acc + (2 * (clusterActualR.get(k) ?? 0) + CLUSTER_GAP) / ringR, 0)
            - Math.PI / 2;
          const cAngle = startAngle + slotArc / 2;
          const cx = Math.cos(cAngle) * ringR;
          const cy = Math.sin(cAngle) * ringR;

          if (members.length <= 1) {
            members.forEach(a => positions.set(a.id, { x: cx, y: cy }));
          } else {
            // Concentric rings expanding outward from 40 % to 100 %+ of baseR.
            // No hard ring cap — the while condition guarantees every article
            // gets a position (fixes the "pile at centre" bug for large laws).
            const baseR = innerRingRadius(members.length);
            const maxInitRings = Math.ceil(Math.log2(Math.max(members.length, 2)));
            let placed = 0, ring = 0;
            while (placed < members.length) {
              const r = baseR * (0.4 + 0.6 * (ring / maxInitRings));
              const slots = Math.max(6, Math.floor((2 * Math.PI * r) / NODE_SPACING));
              const batch = members.slice(placed, placed + slots);
              batch.forEach((a, mi) => {
                const ang = (mi / slots) * Math.PI * 2 + ring * 0.5; // slight per-ring rotation
                positions.set(a.id, { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r });
              });
              placed += batch.length;
              ring++;
            }
          }
        });

        const judgmentList = [...judgmentsById.values()];
        const J = Math.max(judgmentList.length, 1);
        judgmentList.forEach((j, i) => {
          const angle = (i / J) * Math.PI * 2 + Math.PI / 4;
          positions.set(j.id, { x: Math.cos(angle) * 55, y: Math.sin(angle) * 55 });
        });

        nodes.clear();
        edges.clear();
        cache.clear();
        history.length = 0;
        state.historyIndex = -1;

        for (const a of articlesById.values()) {
          const node = nodeToGraphNode({
            id: a.id, key: a.key, collection: 'instrument_articles', type: 'instrument_article',
            display_name: a.display_name ?? null, labels: ['Artikel'],
            props: {
              bwb_id: a.bwb_id,
              // EU articles have no bwb_id; derive celex from key so ArticleReader
              // can fall back to it when loading article detail.
              celex: !a.bwb_id && a.article_number && a.key.endsWith('_' + a.article_number)
                ? a.key.slice(0, -(a.article_number.length + 1))
                : null,
              article_number: a.article_number,
              // GlobalGraphResponse.articles items are ArticleGraphNodeDTO,
              // which doesn't carry geldig_vanaf / breadcrumb / stub. If the
              // user drills into a specific article, the dedicated
              // /api/articles/{bwb_id}/{article_number} call enriches those.
            }
          });
          (node as GraphNode & { x?: number; y?: number }).x = positions.get(a.id)?.x;
          (node as GraphNode & { x?: number; y?: number }).y = positions.get(a.id)?.y;
          nodes.set(node.id, node);
        }

        for (const j of judgmentsById.values()) {
          const node = nodeToGraphNode({
            id: j.id, key: j.key, collection: 'judgments', type: 'judgment',
            display_name: j.display_name ?? j.ecli ?? 'Uitspraak', labels: ['Arrest'],
            props: { ecli: j.ecli, stub: j.stub ?? false }
          });
          (node as GraphNode & { x?: number; y?: number }).x = positions.get(j.id)?.x;
          (node as GraphNode & { x?: number; y?: number }).y = positions.get(j.id)?.y;
          nodes.set(node.id, node);
        }

        for (const e of resp.edges) {
          if (!nodes.has(e.from_id) || !nodes.has(e.to_id)) continue;
          const rel = e.relation_type ?? 'verwijst_naar';
          if (SCAFFOLDING_RELATIONS.has(rel)) continue;
          const id = `${e.from_id}->${e.to_id}:${rel}`;
          edges.set(id, {
            id, source: e.from_id, target: e.to_id,
            kind: classifyEdgeKind(rel, nodes.get(e.from_id)?.kind, nodes.get(e.to_id)?.kind),
            label: rel.replace(/_/g, ' '), directed: true,
            confidence: e.confidence ?? null, relation: rel
          });
        }

        selectionStore.set(null);
        breadcrumbsStore.set([]);
        graphModeStore.set('bulk');
        updateNodes();
        updateEdges();

        endBuild(`${nodes.size} nodes, ${edges.size} edges in graph`);
        return { count: nodes.size };
      } catch (err) {
        console.warn('[graph-store] loadGlobalGraph failed:', err);
        return null;
      } finally {
        loadingStore.set({ kind: 'idle' });
        endTotal();
      }
    },
    loadInstrumentLayerGraph: async (opts) => {
      const additive = opts?.additive ?? false;
      const endTotal = perfStart('loadInstrumentLayerGraph total');
      loadingStore.set({ kind: 'global', phase: 'fetching' });
      try {
        const resp = await getInstrumentLayerGraph();

        for (const inst of resp.instruments) {
          recordInstrument(inst as Parameters<typeof recordInstrument>[0]);
        }

        loadingStore.set({ kind: 'global', phase: 'building' });

        const N = resp.instruments.length;

        // Degree-concentric layout:
        //   ring 1 (innermost) = top 7% by citation count  (hubs: Awb, WvSr, …)
        //   ring 2             = next 13%
        //   ring 3             = next 25%
        //   ring 4 (outermost) = remaining 55%  (peripheral laws)
        // Radii are computed so each ring has comfortable label spacing.
        // Node size scales with degree so hub laws appear visually larger.

        // 1. Build degree map from the edge list
        const degreeMap = new Map<string, number>();
        for (const inst of resp.instruments) degreeMap.set(inst.id, 0);
        for (const e of resp.edges) {
          if (degreeMap.has(e.from_id)) degreeMap.set(e.from_id, (degreeMap.get(e.from_id) ?? 0) + 1);
          if (degreeMap.has(e.to_id))   degreeMap.set(e.to_id,   (degreeMap.get(e.to_id)   ?? 0) + 1);
        }

        // 2. Sort by degree descending
        const sorted = [...resp.instruments].sort(
          (a, b) => (degreeMap.get(b.id) ?? 0) - (degreeMap.get(a.id) ?? 0)
        );
        const maxDeg = degreeMap.get(sorted[0]?.id ?? '') ?? 1;

        // 3. Slice into rings and compute radii
        // Each ring radius = max(previous + gap, minimum non-overlapping radius).
        const ringSliceFracs = [0.07, 0.20, 0.45, 1.0]; // cumulative
        const MIN_SPACING = 24; // graph units between node centres
        const RING_GAP    = 70; // minimum gap between successive rings
        const rings: { slice: typeof sorted; r: number }[] = [];
        let prevR = 0;
        let prevEnd = 0;
        for (const cumFrac of ringSliceFracs) {
          const end = Math.min(Math.ceil(N * cumFrac), N);
          const slice = sorted.slice(prevEnd, end);
          if (!slice.length) break;
          const minR = Math.ceil((slice.length * MIN_SPACING) / (2 * Math.PI));
          const r = Math.max(prevR + RING_GAP, minR);
          rings.push({ slice, r });
          prevR = r;
          prevEnd = end;
        }

        // 4. Assign (x, y) positions and per-node sizes
        const positions = new Map<string, { x: number; y: number; size: number }>();
        for (const { slice, r } of rings) {
          slice.forEach((inst, i) => {
            const angle = (i / slice.length) * 2 * Math.PI - Math.PI / 2;
            const deg = degreeMap.get(inst.id) ?? 0;
            const size = 3 + (deg / maxDeg) * 10; // range [3, 13]
            positions.set(inst.id, { x: Math.cos(angle) * r, y: Math.sin(angle) * r, size });
          });
        }

        prepareBulkLoad(additive);
        const seqBefore = state.seq;

        for (const inst of resp.instruments) {
          const node = nodeToGraphNode({
            id: inst.id, key: inst.key,
            collection: 'instruments', type: 'instrument',
            display_name: inst.display_name ?? inst.citation_title ?? inst.title ?? inst.key,
            labels: ['Wet'],
            props: {
              bwb_id: inst.bwb_id,
              citation_title: inst.citation_title,
              title: inst.title,
              shorthand: inst.shorthand,
              stub: inst.stub ?? false
            }
          });
          // Additive: skip the structural ring layout so the new layer mixes
          // into existing context via FA2 instead of overlapping the origin.
          if (!additive) {
            const pos = positions.get(inst.id);
            (node as GraphNode & { x?: number; y?: number; size?: number }).x = pos?.x;
            (node as GraphNode & { x?: number; y?: number; size?: number }).y = pos?.y;
            (node as GraphNode & { x?: number; y?: number; size?: number }).size = pos?.size;
          }
          touchNode(node.id, node);
        }

        const nodeSet = new Set(nodes.keys());
        for (const e of resp.edges) {
          if (!nodeSet.has(e.from_id) || !nodeSet.has(e.to_id)) continue;
          const rel = e.relation_type ?? 'verwijst_naar';
          if (SCAFFOLDING_RELATIONS.has(rel)) continue;
          const id = `${e.from_id}->${e.to_id}:${rel}`;
          if (!edges.has(id)) {
            edges.set(id, {
              id, source: e.from_id, target: e.to_id,
              kind: 'structural',
              label: rel.replace(/_/g, ' '), directed: true,
              confidence: e.confidence ?? null, relation: rel
            });
          }
        }

        if (additive) placeAdditiveLayer(seqBefore);
        if (!additive) {
          selectionStore.set(null);
          breadcrumbsStore.set([]);
          graphModeStore.set('bulk');
        }
        updateNodes();
        updateEdges();

        console.log(`[graph-store] loadInstrumentLayerGraph: ${nodes.size} instruments, ${edges.size} edges${additive ? ' (additive)' : ''}`);
        return { count: nodes.size };
      } catch (err) {
        console.warn('[graph-store] loadInstrumentLayerGraph failed:', err);
        return null;
      } finally {
        loadingStore.set({ kind: 'idle' });
        endTotal();
      }
    },

    loadJudgmentLayerGraph: async (opts) => {
      const additive = opts?.additive ?? false;
      const endTotal = perfStart('loadJudgmentLayerGraph total');
      loadingStore.set({ kind: 'global', phase: 'fetching' });
      try {
        const resp = await getJudgmentLayerGraph({ maxJudgments: opts?.maxJudgments ?? 1000 });

        loadingStore.set({ kind: 'global', phase: 'building' });

        // Build degree map from edges so we can scale node sizes.
        const degreeMap = new Map<string, number>();
        for (const j of resp.judgments) degreeMap.set(j.id, 0);
        for (const inst of resp.instruments) degreeMap.set(inst.id, 0);
        for (const e of resp.edges) {
          if (degreeMap.has(e.from_id)) degreeMap.set(e.from_id, (degreeMap.get(e.from_id) ?? 0) + (e.weight ?? 1));
          if (degreeMap.has(e.to_id))   degreeMap.set(e.to_id,   (degreeMap.get(e.to_id)   ?? 0) + (e.weight ?? 1));
        }

        // Layout: instruments form a fixed outer ring; judgments use force-directed
        // positions seeded on a tighter ring. We set initial x/y so sigma's force
        // atlas starts from a reasonable state.
        const instrIds = resp.instruments.map(i => i.id);
        const jIds     = resp.judgments.map(j => j.id);
        const INST_R   = Math.max(200, instrIds.length * 22);
        const J_R      = Math.max(80, Math.sqrt(jIds.length) * 18);
        const maxDeg   = Math.max(1, ...degreeMap.values());

        const positions = new Map<string, { x: number; y: number; size: number }>();

        instrIds.forEach((id, i) => {
          const angle = (i / instrIds.length) * 2 * Math.PI - Math.PI / 2;
          const deg = degreeMap.get(id) ?? 0;
          const size = 4 + (deg / maxDeg) * 9;
          positions.set(id, { x: Math.cos(angle) * INST_R, y: Math.sin(angle) * INST_R, size });
        });

        jIds.forEach((id, i) => {
          const angle = (i / Math.max(jIds.length, 1)) * 2 * Math.PI - Math.PI / 2;
          const deg = degreeMap.get(id) ?? 0;
          // Jitter radius so judgments don't all pile on the same ring.
          const r = J_R + ((i * 37) % 60) - 30;
          const size = 2 + (deg / maxDeg) * 6;
          positions.set(id, { x: Math.cos(angle) * r, y: Math.sin(angle) * r, size });
        });

        prepareBulkLoad(additive);
        const seqBefore = state.seq;

        // Add instrument nodes (anchor ring).
        for (const inst of resp.instruments) {
          const node = nodeToGraphNode({
            id: inst.id, key: inst.key,
            collection: 'instruments', type: 'instrument',
            display_name: inst.display_name ?? inst.citation_title ?? inst.title ?? inst.key,
            labels: ['Wet'],
            props: {
              bwb_id: inst.bwb_id,
              citation_title: inst.citation_title,
              title: inst.title,
              shorthand: inst.shorthand,
              stub: inst.stub ?? false,
            }
          });
          if (!additive) {
            const pos = positions.get(inst.id);
            (node as GraphNode & { x?: number; y?: number; size?: number }).x = pos?.x;
            (node as GraphNode & { x?: number; y?: number; size?: number }).y = pos?.y;
            (node as GraphNode & { x?: number; y?: number; size?: number }).size = pos?.size;
          }
          touchNode(node.id, node);
        }

        // Add judgment nodes.
        for (const j of resp.judgments) {
          const node: GraphNode = {
            id: j.id, key: j.key, collection: 'judgments',
            kind: 'judgment',
            label: (() => {
              const ecli = j.ecli ?? j.key;
              const m = ecli.match(/(?:ECLI:)?(?:NL:)?([^:]+):(\d{4}):(\d+)/);
              return m ? `${m[1]} ${m[2]}/${m[3]}` : ecli.replace(/^ECLI:/, '');
            })(),
            stub: j.stub ?? false,
            raw: {
              id: j.id, key: j.key,
              collection: 'judgments', type: 'judgment',
              display_name: j.display_name ?? j.key,
              labels: ['Arrest'],
              props: { ecli: j.ecli, stub: j.stub ?? false }
            }
          };
          if (!additive) {
            const pos = positions.get(j.id);
            (node as GraphNode & { x?: number; y?: number; size?: number }).x = pos?.x;
            (node as GraphNode & { x?: number; y?: number; size?: number }).y = pos?.y;
            (node as GraphNode & { x?: number; y?: number; size?: number }).size = pos?.size;
          }
          touchNode(node.id, node);
        }

        const nodeSet = new Set(nodes.keys());
        for (const e of resp.edges) {
          if (!nodeSet.has(e.from_id) || !nodeSet.has(e.to_id)) continue;
          const rel = e.relation_type ?? 'citeert';
          if (SCAFFOLDING_RELATIONS.has(rel)) continue;
          const id = `${e.from_id}->${e.to_id}:${rel}`;
          if (!edges.has(id)) {
            edges.set(id, {
              id, source: e.from_id, target: e.to_id,
              kind: 'citation',
              label: rel.replace(/_/g, ' '), directed: true,
              confidence: e.confidence ?? null, relation: rel
            });
          }
        }

        if (additive) placeAdditiveLayer(seqBefore);
        if (!additive) {
          selectionStore.set(null);
          breadcrumbsStore.set([]);
          graphModeStore.set('bulk');
        }
        updateNodes();
        updateEdges();

        console.log(`[graph-store] loadJudgmentLayerGraph: ${nodes.size} nodes (${resp.judgments.length} judgments, ${resp.instruments.length} instruments), ${edges.size} edges${additive ? ' (additive)' : ''}`);
        return { count: nodes.size };
      } catch (err) {
        console.warn('[graph-store] loadJudgmentLayerGraph failed:', err);
        return null;
      } finally {
        loadingStore.set({ kind: 'idle' });
        endTotal();
      }
    },
  };
}
