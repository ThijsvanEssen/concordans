import { getArticleDetail } from '$lib/api/articles';
import { recordInstrument } from '$lib/api/instrument-cache';
import { getInstrumentArticles, getInstrumentDossiers, getInstrumentJudgments, getInstrumentRelatedInstruments } from '$lib/api/nodes';
import { perfStart } from '$lib/util/perf';
import { compareArticleNumbers } from '$lib/util/sort';
import { nodeToGraphNode, classifyEdgeKind, SCAFFOLDING_RELATIONS } from '../types';
import type { GraphEdgeDTO, JudgmentGraphNodeDTO } from '$lib/api/types';
import type { GraphNode } from '../types';
import type { GraphContext } from './context';
import type { GraphStore } from './types';

export function createWetLoaders(ctx: GraphContext): Pick<GraphStore, 'loadInstrument' | 'prefetchInstrumentLayerCounts' | 'loadInstrumentJudgmentsLayer' | 'loadInstrumentDossiersLayer' | 'loadInstrumentRelatedLayer'> {
  const {
    nodes,
    edges,
    cache,
    history,
    selectionStore,
    breadcrumbsStore,
    loadingStore,
    graphModeStore,
    currentInstrumentBwbStore,
    wetLayerTotals,
    recomputePotentialCounts,
    updateNodes,
    updateEdges,
    touchNode,
    placeAdditiveLayer,
    state
  } = ctx;

  return {
    loadInstrument: async (bwbId) => {
      const endTotal = perfStart(`loadInstrument(${bwbId}) total`);
      loadingStore.set({ kind: 'instrument', bwbId, phase: 'fetching' });
      try {
        const endFetch = perfStart(`loadInstrument fetch`);
        // `/api/instruments/{bwb}/articles` is the list endpoint the backend
        // added for exactly this case — the generic `/api/nodes/instruments/{key}`
        // surface omits PART_OF_INSTRUMENT children, and `/api/graph/instruments`
        // only ships instrument hubs. Adapt the list response into the shape
        // the rest of this function already expects so the structural layout
        // code stays put. Use the bulk limit so we get the full wet — the
        // breadcrumb-cluster layout assumes the complete article set.
        const articleListResp = await getInstrumentArticles(bwbId, {
          includeStubs: false,
          textPreviewChars: 0,
          limit: 2000,
        });
        const resp = {
          instrument: {
            id: '',
            key: bwbId,
            bwb_id: articleListResp.bwb_id,
            display_name: null as string | null,
            shorthand: null,
            title: null as string | null,
            citation_title: null as string | null,
            jurisdiction: null as 'NL' | 'EU' | null,
            geldig_vanaf: null as string | null,
          },
          citation_title: null as string | null,
          articles: articleListResp.items.map((a) => ({
            id: a.id,
            key: a.key,
            bwb_id: a.bwb_id,
            article_number: a.article_number,
            display_name: a.display_name,
            shorthand: null,
            text: null as string | null,
            jurisdiction: null as 'NL' | 'EU' | null,
            geldig_vanaf: null as string | null,
            breadcrumb: a.breadcrumb ?? null,
            stub: a.stub,
          })),
          // The /articles endpoint returns articles only — no judgments and
          // no inter-article edges. Judgments expand on-demand when the user
          // clicks an individual article (generic /api/nodes path picks up
          // citations from there).
          judgments: [] as JudgmentGraphNodeDTO[],
          edges: [] as GraphEdgeDTO[],
          metadata: null,
        };
        endFetch(`${resp.articles.length} of ${articleListResp.total} articles`);
        // Defensive: don't wipe the existing canvas when the response carries
        // nothing to render. Callers (handleNodeClick) treat a null return as
        // "fall through to generic expansion", which needs the prior canvas
        // intact to make sense.
        if (resp.articles.length === 0) {
          console.warn(`[graph-store] loadInstrument(${bwbId}): backend returned 0 articles — canvas preserved`);
          return null;
        }
        recordInstrument({
          ...resp.instrument,
          citation_title: resp.citation_title ?? resp.instrument.citation_title ?? null
        });
        loadingStore.set({ kind: 'instrument', bwbId, phase: 'building' });

        // Background fetch: pull a single article so the bibtex shorttitle
        // (e.g. "Sr") lands in the instrument cache. Article labels in the
        // graph and hover panel will show the abbreviation as soon as it
        // resolves — they refresh reactively via the cache subscription.
        const sampleArticle = resp.articles.find((a) => a.bwb_id === bwbId && a.article_number);
        if (sampleArticle?.bwb_id && sampleArticle?.article_number) {
          void getArticleDetail(sampleArticle.bwb_id, sampleArticle.article_number)
            .then((d) => {
              // citation_formats was removed from the API; fall back to metadata if present.
              const meta = d.metadata as Record<string, unknown> | null | undefined;
              const bibtex = meta?.['bibtex'] as string | undefined;
              if (!bibtex) return;
              const shortMatch = bibtex.match(/shorttitle\s*=\s*\{([^}]+)\}/);
              const lawMatch = bibtex.match(/\blaw\s*=\s*\{([^}]+)\}/);
              recordInstrument({
                bwb_id: bwbId,
                short_title: shortMatch?.[1] ?? null,
                citation_title: lawMatch?.[1] ?? null,
                title: lawMatch?.[1] ?? null
              });
            })
            .catch(() => { /* non-fatal */ });
        }
        const endBuild = perfStart(`loadInstrument build`);

        const articlesById = new Map<string, typeof resp.articles[number]>();
        for (const a of resp.articles) {
          if (!articlesById.has(a.id)) articlesById.set(a.id, a);
        }
        const judgmentsById = new Map<string, typeof resp.judgments[number]>();
        for (const j of resp.judgments) {
          if (!judgmentsById.has(j.id)) judgmentsById.set(j.id, j);
        }

        // Structural layout. Cluster articles by breadcrumb top level
        // (boek/titel/etc.) so each major partition of the wet gets its own
        // arc on the outer ring; within a cluster articles sit on a small
        // inner ring sorted by article_number, so citations become readable
        // chords across the canvas. When breadcrumbs are absent (older
        // imports, mixed-wet payloads), fall back to grouping by bwb_id so
        // we still produce *some* partition rather than one giant disc.
        const articleList = [...articlesById.values()];
        articleList.sort((a, b) => compareArticleNumbers(a.article_number, b.article_number));

        const positions = new Map<string, { x: number; y: number }>();

        const groups = new Map<string, typeof articleList>();
        for (const a of articleList) {
          const bc = a.breadcrumb;
          const groupKey = (bc && bc.length > 0 ? bc[0].label : null) ?? a.bwb_id ?? 'unknown';
          let arr = groups.get(groupKey);
          if (!arr) { arr = []; groups.set(groupKey, arr); }
          arr.push(a);
        }
        // Largest boek first so it claims the top-of-ring position. (Articles
        // within each group are already in article_number order because
        // articleList was pre-sorted before insertion.)
        const groupsSorted = [...groups.entries()].sort(([, a], [, b]) => b.length - a.length);

        // Scale the outer ring to the total article count so big wets (Sv has
        // ~810 articles spread over a few boeken of ~270 each) don't pack
        // their per-boek inner rings on top of one another. Inner radius also
        // scales — sqrt(N) growth keeps dense boeken from blowing up linearly.
        const total = Math.max(articleList.length, 1);
        const ringR = Math.max(240, Math.sqrt(total) * 14);

        // Sunflower / Fibonacci spiral packing for the per-boek interiors.
        // Earlier version placed members on a single ring (cos*r, sin*r);
        // for a boek with hundreds of articles (Sr Boek II has ~470) that
        // produced a hollow donut outline rather than a packed cluster.
        // Spiral packing fills the disc evenly: each member i at
        // angle = i*golden + start, radius = spacing*sqrt(i).
        const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
        groupsSorted.forEach(([, members], li) => {
          const totalArc = (members.length / total) * Math.PI * 2;
          const startAngle = groupsSorted
            .slice(0, li)
            .reduce((acc, [, m]) => acc + (m.length / total) * Math.PI * 2, 0)
            - Math.PI / 2;

          const cAngle = startAngle + totalArc / 2;
          const cx = Math.cos(cAngle) * ringR;
          const cy = Math.sin(cAngle) * ringR;
          const outerInnerR = 12 + Math.sqrt(members.length) * 3.5;
          const spacing = outerInnerR / Math.max(Math.sqrt(members.length), 1);

          members.forEach((a, mi) => {
            const r = spacing * Math.sqrt(mi);
            const ang2 = mi * GOLDEN_ANGLE;
            positions.set(a.id, {
              x: cx + Math.cos(ang2) * r,
              y: cy + Math.sin(ang2) * r
            });
          });
        });

        // Judgments live on a smaller inner ring so they're visibly distinct
        // from articles and don't fight the structural article layout.
        const judgmentList = [...judgmentsById.values()];
        const J = Math.max(judgmentList.length, 1);
        const judgmentR = 55;
        judgmentList.forEach((j, i) => {
          const angle = (i / J) * Math.PI * 2 + Math.PI / 4;
          positions.set(j.id, {
            x: Math.cos(angle) * judgmentR,
            y: Math.sin(angle) * judgmentR
          });
        });

        // Bulk commit: write the internal Maps directly (bypassing
        // addNode/addEdge so we don't fire 535+952 store updates), then emit
        // exactly one nodes-set + one edges-set notification at the end.
        // This drops the build phase from O(N²) (~7s) to O(N+E) (~50ms).
        const endStage = perfStart('  loadInstrument: stage');
        nodes.clear();
        edges.clear();
        cache.clear();
        history.length = 0;
        state.historyIndex = -1;
        // Mark canvas as wet-scoped so the Lagen handlers route to the
        // wet-specific endpoints instead of global Lagen graphs.
        currentInstrumentBwbStore.set(bwbId);
        console.log(`[graph-store] currentInstrumentBwb set → ${bwbId}`);

        for (const a of articlesById.values()) {
          const node = nodeToGraphNode({
            id: a.id,
            key: a.key,
            collection: 'instrument_articles',
            type: 'instrument_article',
            display_name: a.display_name,
            labels: ['Artikel'],
            props: {
              bwb_id: a.bwb_id,
              // EU articles have no bwb_id; derive celex from key so ArticleReader
              // can fall back to it when loading article detail.
              celex: !a.bwb_id && a.article_number && a.key.endsWith('_' + a.article_number)
                ? a.key.slice(0, -(a.article_number.length + 1))
                : null,
              article_number: a.article_number,
              valid_from: a.geldig_vanaf,
              breadcrumb: a.breadcrumb,
              stub: a.stub ?? false
            }
          });
          (node as GraphNode & { x?: number; y?: number }).x = positions.get(a.id)?.x;
          (node as GraphNode & { x?: number; y?: number }).y = positions.get(a.id)?.y;
          nodes.set(node.id, node);
        }

        for (const j of judgmentsById.values()) {
          const node = nodeToGraphNode({
            id: j.id,
            key: j.key,
            collection: 'judgments',
            type: 'judgment',
            display_name: j.shorthand ?? j.display_name ?? j.ecli ?? 'Uitspraak',
            labels: ['Arrest'],
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
            id,
            source: e.from_id,
            target: e.to_id,
            kind: classifyEdgeKind(rel, nodes.get(e.from_id)?.kind, nodes.get(e.to_id)?.kind),
            label: rel.replace(/_/g, ' '),
            directed: true,
            confidence: e.confidence ?? null,
            relation: rel
          });
        }
        endStage(`${nodes.size} nodes, ${edges.size} edges staged`);

        const endCommit = perfStart('  loadInstrument: commit (sync to GraphView)');
        selectionStore.set(null);
        breadcrumbsStore.set([]);
        graphModeStore.set('bulk');
        updateNodes();   // single fan-out of nodes to subscribers
        updateEdges();   // single fan-out of edges
        endCommit();

        endBuild(`${nodes.size} nodes, ${edges.size} edges in graph`);
        return { count: nodes.size };
      } catch (err) {
        console.warn('[graph-store] loadInstrument failed:', err);
        return null;
      } finally {
        loadingStore.set({ kind: 'idle' });
        endTotal();
      }
    },

    // ── Wet-scoped Lagen loaders ─────────────────────────────────────────
    // Each fetches one slice of the wet's citation graph and merges it into
    // the existing wet canvas additively. None of them clear or replace —
    // they enrich whatever loadInstrument already put down. The Lagen
    // handlers in the route route to these when currentInstrumentBwb is set.

    prefetchInstrumentLayerCounts: async (bwbId) => {
      // Fire-and-forget: three parallel calls with limit=1, only the `total`
      // field is needed. Writes into wetLayerTotals (merged into
      // potentialCountsStore by recomputePotentialCounts) so the sidebar's
      // "+N" badge surfaces the availability before the user clicks.
      try {
        const [judgments, dossiers, related] = await Promise.all([
          getInstrumentJudgments(bwbId, { limit: 1 }).catch(() => null),
          getInstrumentDossiers(bwbId, { limit: 1 }).catch(() => null),
          getInstrumentRelatedInstruments(bwbId, { limit: 1 }).catch(() => null),
        ]);
        if (judgments) wetLayerTotals['judgment'] = judgments.total;
        if (dossiers) wetLayerTotals['dossier'] = dossiers.total;
        if (related) wetLayerTotals['instrument'] = related.total;
        console.log(`[graph-store] prefetchInstrumentLayerCounts(${bwbId}): judgments=${judgments?.total ?? '?'} dossiers=${dossiers?.total ?? '?'} related=${related?.total ?? '?'}`);
        recomputePotentialCounts();
      } catch (err) {
        console.warn('[graph-store] prefetchInstrumentLayerCounts failed:', err);
      }
    },


    loadInstrumentJudgmentsLayer: async (bwbId) => {
      const endTotal = perfStart(`loadInstrumentJudgmentsLayer(${bwbId})`);
      try {
        const resp = await getInstrumentJudgments(bwbId, { limit: 1000 });
        const seqBefore = state.seq;
        let added = 0;
        let edgesAdded = 0;
        for (const j of resp.items) {
          const id = j.id;
          if (!nodes.has(id)) {
            const node = nodeToGraphNode({
              id, key: j.key, collection: 'judgments', type: 'judgment',
              display_name: j.display_name ?? j.ecli ?? 'Uitspraak',
              labels: ['Arrest'],
              props: { ecli: j.ecli ?? null, stub: j.stub ?? false },
            });
            touchNode(id, node);
            added++;
          }
          // Each cited article gets an edge judgment → article. The article
          // must already be on canvas (loaded by loadInstrument); if it
          // isn't, skip — we don't fetch foreign articles here.
          for (const a of j.cited_articles ?? []) {
            if (!nodes.has(a.id)) continue;
            const eId = `${j.id}->${a.id}:citeert`;
            if (!edges.has(eId)) {
              edges.set(eId, {
                id: eId, source: j.id, target: a.id, kind: 'citation',
                label: 'citeert', directed: true, confidence: null, relation: 'citeert',
              });
              edgesAdded++;
            }
          }
        }
        if (added > 0) placeAdditiveLayer(seqBefore);
        updateNodes();
        updateEdges();
        console.log(`[graph-store] loadInstrumentJudgmentsLayer(${bwbId}): +${added} judgments, +${edgesAdded} edges (${resp.total} available)`);
        return { count: added };
      } catch (err) {
        console.warn('[graph-store] loadInstrumentJudgmentsLayer failed:', err);
        return null;
      } finally {
        endTotal();
      }
    },

    loadInstrumentDossiersLayer: async (bwbId) => {
      const endTotal = perfStart(`loadInstrumentDossiersLayer(${bwbId})`);
      try {
        const resp = await getInstrumentDossiers(bwbId, { limit: 500 });
        // Shape probe — drop once the dossier item contract is verified
        // (specifically: does each item carry a `publications` array, and
        // if so, what fields + article references does it ship?).
        if (resp.items && resp.items.length > 0) {
          const sample = resp.items[0];
          console.log('[shape-probe] dossier item keys=', Object.keys(sample),
            ' touched_articles[0]=', (sample.touched_articles ?? [])[0] ?? null,
            ' publications[0]=', (sample.publications ?? [])[0] ?? null);
        }
        const seqBefore = state.seq;
        let added = 0;
        for (const d of resp.items) {
          if (!nodes.has(d.id)) {
            const node = nodeToGraphNode({
              id: d.id, key: d.key, collection: 'kamerstukdossiers', type: 'dossier',
              display_name: d.titel ?? d.kamerstuknummer ?? d.key,
              labels: ['Dossier'],
              props: {
                kamerstuknummer: d.kamerstuknummer ?? null,
                titel: d.titel ?? null,
                huidige_fase: d.huidige_fase ?? null,
              },
            });
            touchNode(d.id, node);
            added++;
          }
          // dossier → article edges (RAAKT / derived). Aligned with the
          // judgments endpoint's `{id, key, …}` convention.
          for (const a of d.touched_articles ?? []) {
            if (!nodes.has(a.id)) continue;
            const eId = `${d.id}->${a.id}:raakt`;
            if (!edges.has(eId)) {
              edges.set(eId, {
                id: eId, source: d.id, target: a.id, kind: 'parliamentary',
                label: 'raakt', directed: true, confidence: null, relation: 'raakt',
              });
            }
          }
          // Surface publications under the dossier if the backend supplied them.
          for (const p of d.publications ?? []) {
            if (!nodes.has(p.id)) {
              const pNode = nodeToGraphNode({
                id: p.id, key: p.key, collection: 'publications', type: 'publication',
                display_name: p.titel ?? p.soort ?? p.key,
                labels: ['Publicatie'],
                props: { soort: p.soort ?? null, titel: p.titel ?? null },
              });
              touchNode(p.id, pNode);
              added++;
            }
            const eId = `${d.id}->${p.id}:bevat`;
            if (!edges.has(eId)) {
              edges.set(eId, {
                id: eId, source: d.id, target: p.id, kind: 'parliamentary',
                label: 'bevat', directed: true, confidence: null, relation: 'bevat',
              });
            }
          }
        }
        if (added > 0) placeAdditiveLayer(seqBefore);
        updateNodes();
        updateEdges();
        console.log(`[graph-store] loadInstrumentDossiersLayer(${bwbId}): +${added} nodes (${resp.total} dossiers available)`);
        return { count: added };
      } catch (err) {
        console.warn('[graph-store] loadInstrumentDossiersLayer failed:', err);
        return null;
      } finally {
        endTotal();
      }
    },

    loadInstrumentRelatedLayer: async (bwbId) => {
      const endTotal = perfStart(`loadInstrumentRelatedLayer(${bwbId})`);
      try {
        const resp = await getInstrumentRelatedInstruments(bwbId, { limit: 200 });
        const seqBefore = state.seq;
        let added = 0;
        for (const r of resp.items) {
          if (!nodes.has(r.id)) {
            const node = nodeToGraphNode({
              id: r.id, key: r.key, collection: 'instruments', type: 'instrument',
              display_name: r.citation_title ?? r.display_name ?? r.key,
              labels: ['Wet'],
              props: {
                bwb_id: r.bwb_id,
                citation_title: r.citation_title ?? null,
              },
            });
            touchNode(r.id, node);
            added++;
          }
          // No per-article edges available at this aggregation layer — only
          // counts. Surface them in node props for the hover panel; the
          // sidebar can also show outbound/inbound on click.
          const existing = nodes.get(r.id);
          if (existing && existing.raw) {
            const p = (existing.raw.props ?? {}) as Record<string, unknown>;
            p['outbound_count'] = r.outbound_count;
            p['inbound_count'] = r.inbound_count;
            existing.raw.props = p;
          }
        }
        if (added > 0) placeAdditiveLayer(seqBefore);
        updateNodes();
        updateEdges();
        console.log(`[graph-store] loadInstrumentRelatedLayer(${bwbId}): +${added} related wets (${resp.total} available)`);
        return { count: added };
      } catch (err) {
        console.warn('[graph-store] loadInstrumentRelatedLayer failed:', err);
        return null;
      } finally {
        endTotal();
      }
    },
  };
}
