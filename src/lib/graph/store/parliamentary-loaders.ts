import { getNodeGraph } from '$lib/api/nodes';
import {
	fetchDossierDocumentsBulk,
	fetchCommissie,
	fetchCommissies,
	fetchCommissiesWithLeden,
	fetchLid,
	fetchLeden,
	fetchFractie,
	fetchFracties,
	fetchRecentDossiers
} from '$lib/api/parliamentary-client';
import { graphNodeId, lidToGraphNode, fractieToGraphNode } from '../types';
import { DEFAULT_EXPANSION } from './types';
import type { GraphNode } from '../types';
import type { GraphContext } from './context';
import type { GraphStore } from './types';

export function createParliamentaryLoaders(
	ctx: GraphContext
): Pick<
	GraphStore,
	| 'loadLidGraph'
	| 'loadFractieGraph'
	| 'loadCommissiesLayerGraph'
	| 'loadLedenLayerGraph'
	| 'loadFractiesLayerGraph'
	| 'loadRecentDossiersGraph'
> {
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
		mergeResponse,
		state
	} = ctx;

	return {
		loadLidGraph: async (key) => {
			// Lid hub graph: fetches the lid + uses the standard node-graph endpoint
			// to pull dient_in / lid_van neighbours (commissies, dossiers, tkstukken).
			// Backend exposes /api/nodes/leden/{key} once the lid collection lands.
			loadingStore.set({ kind: 'parliamentary', phase: 'fetching' });
			try {
				const lid = await fetchLid(key);
				loadingStore.set({ kind: 'parliamentary', phase: 'building' });

				nodes.clear();
				edges.clear();
				cache.clear();
				history.length = 0;
				state.historyIndex = -1;

				const hubNode = lidToGraphNode(lid);
				(hubNode as GraphNode & { x?: number; y?: number; size?: number }).x = 0;
				(hubNode as GraphNode & { x?: number; y?: number; size?: number }).y = 0;
				(hubNode as GraphNode & { x?: number; y?: number; size?: number }).size = 14;
				nodes.set(hubNode.id, hubNode);

				selectionStore.set(hubNode);
				breadcrumbsStore.set([]);
				graphModeStore.set('bulk');
				updateNodes();
				updateEdges();

				// Pull neighbours via the generic node-graph endpoint. This brings
				// in commissies (lid_van), dossiers (dient_in), tkstukken (dient_in
				// amendement / motie). Errors here are non-fatal — the hub still
				// renders alone and the user can search outward.
				try {
					const graph = await getNodeGraph('leden', key);
					mergeResponse(graph, { ...DEFAULT_EXPANSION, neighborLimit: 50 });
				} catch (err) {
					console.warn('[graph-store] loadLidGraph: neighbour fetch failed (lid hub only):', err);
				}

				updateNodes();
				updateEdges();
				return { count: nodes.size };
			} catch (err) {
				console.warn('[graph-store] loadLidGraph failed:', err);
				return null;
			} finally {
				loadingStore.set({ kind: 'idle' });
			}
		},

		loadFractieGraph: async (key) => {
			// Fractie hub graph: single /api/nodes/fracties/{key} call returns
			// inbound LID_VAN_FRACTIE (members), outbound AUTEUR_VAN (authored
			// publications), outbound STEMT (votes with meta.stem) — all in one.
			loadingStore.set({ kind: 'parliamentary', phase: 'fetching' });
			try {
				const fractie = await fetchFractie(key);
				loadingStore.set({ kind: 'parliamentary', phase: 'building' });

				nodes.clear();
				edges.clear();
				cache.clear();
				history.length = 0;
				state.historyIndex = -1;

				const hubNode = fractieToGraphNode(fractie);
				(hubNode as GraphNode & { x?: number; y?: number; size?: number }).x = 0;
				(hubNode as GraphNode & { x?: number; y?: number; size?: number }).y = 0;
				(hubNode as GraphNode & { x?: number; y?: number; size?: number }).size = 14;
				nodes.set(hubNode.id, hubNode);

				selectionStore.set(hubNode);
				breadcrumbsStore.set([]);
				graphModeStore.set('bulk');
				updateNodes();
				updateEdges();

				try {
					const graph = await getNodeGraph('fracties', key);
					mergeResponse(graph, { ...DEFAULT_EXPANSION, neighborLimit: 50 });
				} catch (err) {
					console.warn('[graph-store] loadFractieGraph: neighbour fetch failed (hub only):', err);
				}

				updateNodes();
				updateEdges();
				return { count: nodes.size };
			} catch (err) {
				console.warn('[graph-store] loadFractieGraph failed:', err);
				return null;
			} finally {
				loadingStore.set({ kind: 'idle' });
			}
		},

		loadCommissiesLayerGraph: async (opts) => {
			const additive = opts?.additive ?? false;
			// Top-level "commissies + their leden" overview in one round-trip.
			// /api/commissies/with-leden batches every committee + member set
			// into a single AQL query — replaces an N+1 of 130 parallel
			// /api/commissies/{slug} fetches.
			loadingStore.set({ kind: 'parliamentary', phase: 'fetching' });
			try {
				const list = await fetchCommissiesWithLeden();
				const ledenByCommissie = new Map<string, import('$lib/api/parliamentary').LidDTO[]>();
				for (const c of list) {
					ledenByCommissie.set(c.slug ?? c.key, c.leden);
				}

				loadingStore.set({ kind: 'parliamentary', phase: 'building' });

				prepareBulkLoad(additive);
				const seqBefore = state.seq;

				// Sort by active dossier count descending so busy committees appear first.
				const sorted = [...list].sort((a, b) => b.active_dossier_count - a.active_dossier_count);
				const maxCount = Math.max(1, sorted[0]?.active_dossier_count ?? 1);
				const N = sorted.length;
				const RING = Math.max(180, N * 38);

				sorted.forEach((c, i) => {
					const angle = (i / Math.max(N, 1)) * Math.PI * 2 - Math.PI / 2;
					const cx = Math.cos(angle) * RING;
					const cy = Math.sin(angle) * RING;
					const size = 6 + (c.active_dossier_count / maxCount) * 10;
					const slug = c.slug ?? c.key;
					const nodeId = graphNodeId('commissies', slug);

					const gn: GraphNode & { x?: number; y?: number; size?: number } = {
						id: nodeId,
						collection: 'commissies',
						key: slug,
						kind: 'commissie',
						label: c.afkorting ?? c.naam ?? slug,
						raw: {
							id: c.id,
							key: slug,
							collection: 'commissies',
							type: 'commissie',
							display_name: c.naam ?? slug,
							labels: ['Commissie'],
							props: {
								naam: c.naam,
								afkorting: c.afkorting,
								slug,
								active_dossier_count: c.active_dossier_count
							}
						}
					};
					if (!additive) {
						gn.x = cx;
						gn.y = cy;
						gn.size = size;
					}
					touchNode(gn.id, gn);

					// Halo of leden around each commissie. Same pattern as the fractie
					// button: small inner orbit per hub, lid_van edges drawn outward.
					const leden = ledenByCommissie.get(slug) ?? [];
					if (leden.length === 0) return;
					const HALO = 22 + Math.sqrt(leden.length) * 8;
					leden.forEach((lid, j) => {
						const lidAngle = (j / leden.length) * Math.PI * 2;
						const lidNode = lidToGraphNode(lid) as GraphNode & {
							x?: number;
							y?: number;
							size?: number;
						};
						if (!additive) {
							lidNode.x = cx + Math.cos(lidAngle) * HALO;
							lidNode.y = cy + Math.sin(lidAngle) * HALO;
							lidNode.size = lid.actief ? 5 : 3.5;
						}
						// First commissie wins if a lid sits on multiple committees;
						// additional edges still link them all.
						if (!nodes.has(lidNode.id)) touchNode(lidNode.id, lidNode);

						const rel = 'lid_van';
						const edgeId = `${lidNode.id}->${gn.id}:${rel}`;
						edges.set(edgeId, {
							id: edgeId,
							source: lidNode.id,
							target: gn.id,
							kind: 'parliamentary',
							label: rel,
							directed: true,
							relation: rel
						});
					});
				});

				if (additive) placeAdditiveLayer(seqBefore);
				if (!additive) {
					selectionStore.set(null);
					breadcrumbsStore.set([]);
					graphModeStore.set('bulk');
				}
				updateNodes();
				updateEdges();

				const ledenCount = nodes.size - sorted.length;
				console.log(
					`[graph-store] loadCommissiesLayerGraph: ${sorted.length} commissies + ${ledenCount} leden${additive ? ' (additive)' : ''}`
				);
				return { count: nodes.size };
			} catch (err) {
				console.warn('[graph-store] loadCommissiesLayerGraph failed:', err);
				return null;
			} finally {
				loadingStore.set({ kind: 'idle' });
			}
		},

		loadLedenLayerGraph: async (opts) => {
			const additive = opts?.additive ?? false;
			// Bulk overview of all kamerleden. Tries /api/leden first; if the list
			// endpoint isn't shipped yet, falls back to aggregating leden from
			// every commissie's detail response.
			loadingStore.set({ kind: 'parliamentary', phase: 'fetching' });
			try {
				let list: Array<{
					id: string;
					key: string;
					naam: string | null;
					partij: string | null;
					actief: boolean;
				}> = [];
				try {
					list = await fetchLeden({ limit: 300 });
				} catch (primaryErr) {
					console.warn(
						'[graph-store] /api/leden unavailable; aggregating from commissies',
						primaryErr
					);
					// Fallback: fetchCommissie(slug) for every commissie, dedupe leden.
					const commissies = await fetchCommissies();
					const detailed = await Promise.allSettled(
						commissies.map((c) => fetchCommissie(c.slug ?? c.key))
					);
					const seen = new Set<string>();
					for (const r of detailed) {
						if (r.status !== 'fulfilled') continue;
						for (const lid of r.value.leden) {
							if (seen.has(lid.key)) continue;
							seen.add(lid.key);
							list.push(lid);
						}
					}
				}

				loadingStore.set({ kind: 'parliamentary', phase: 'building' });

				prepareBulkLoad(additive);
				const seqBefore = state.seq;

				if (list.length === 0) return null;

				// Sort by partij so leden of the same fractie sit adjacent on the
				// ring. Inactive leden go last.
				const sorted = [...list].sort((a, b) => {
					if (a.actief !== b.actief) return a.actief ? -1 : 1;
					const pa = (a.partij ?? 'zz').toLowerCase();
					const pb = (b.partij ?? 'zz').toLowerCase();
					if (pa !== pb) return pa.localeCompare(pb, 'nl');
					return (a.naam ?? '').localeCompare(b.naam ?? '', 'nl');
				});
				const N = sorted.length;
				const R = Math.max(120, N * 4);

				sorted.forEach((l, i) => {
					const angle = (i / Math.max(N, 1)) * Math.PI * 2 - Math.PI / 2;
					const gn = lidToGraphNode(l) as GraphNode & { x?: number; y?: number; size?: number };
					if (!additive) {
						gn.x = Math.cos(angle) * R;
						gn.y = Math.sin(angle) * R;
						gn.size = l.actief ? 5 : 3.5;
					}
					touchNode(gn.id, gn);
				});

				if (additive) placeAdditiveLayer(seqBefore);
				if (!additive) {
					selectionStore.set(null);
					breadcrumbsStore.set([]);
					graphModeStore.set('bulk');
				}
				updateNodes();
				updateEdges();

				console.log(
					`[graph-store] loadLedenLayerGraph: ${nodes.size} leden${additive ? ' (additive)' : ''}`
				);
				return { count: nodes.size };
			} catch (err) {
				console.warn('[graph-store] loadLedenLayerGraph failed:', err);
				return null;
			} finally {
				loadingStore.set({ kind: 'idle' });
			}
		},

		loadFractiesLayerGraph: async (opts) => {
			const additive = opts?.additive ?? false;
			// Top-level "fracties + their kamerleden" overview in one click.
			// Each fractie is a hub with its leden orbiting it, edge `lid_van_fractie`.
			//
			// Tries /api/fracties first; on failure derives a fractie set from the
			// partij field on aggregated commissie-leden (synthetic mode). In both
			// modes we end up with a list of fracties + a Map<fractieKey, LidDTO[]>
			// so the layout phase is identical.
			loadingStore.set({ kind: 'parliamentary', phase: 'fetching' });
			try {
				type FractieRow = {
					id: string;
					key: string;
					naam: string | null;
					afkorting: string | null;
					aantal_zetels?: number | null;
				};
				let list: FractieRow[] = [];
				const ledenByFractie = new Map<string, import('$lib/api/parliamentary').LidDTO[]>();
				let synthetic = false;

				try {
					list = await fetchFracties();
					// Real path: pull each fractie's neighbours in parallel to find leden.
					const expansions = await Promise.allSettled(
						list.map((f) => getNodeGraph('fracties', f.key))
					);
					expansions.forEach((r, i) => {
						if (r.status !== 'fulfilled') return;
						const fractie = list[i];
						const ledenForFractie: import('$lib/api/parliamentary').LidDTO[] = [];
						for (const n of r.value.neighbors?.all ?? []) {
							if (n.collection !== 'leden') continue;
							const p = (n.props ?? {}) as Record<string, unknown>;
							ledenForFractie.push({
								id: n.id,
								key: n.key,
								naam: (p['naam'] as string | null) ?? n.display_name ?? n.key,
								partij: (p['partij'] as string | null) ?? fractie.afkorting ?? null,
								actief: (p['actief'] as boolean | undefined) ?? true
							});
						}
						ledenByFractie.set(fractie.key, ledenForFractie);
					});
				} catch (primaryErr) {
					console.warn(
						'[graph-store] /api/fracties unavailable; deriving from commissie leden',
						primaryErr
					);
					synthetic = true;
					const commissies = await fetchCommissies();
					const detailed = await Promise.allSettled(
						commissies.map((c) => fetchCommissie(c.slug ?? c.key))
					);
					const ledenByPartij = new Map<string, import('$lib/api/parliamentary').LidDTO[]>();
					const seenLid = new Set<string>();
					for (const r of detailed) {
						if (r.status !== 'fulfilled') continue;
						for (const lid of r.value.leden) {
							if (!lid.partij) continue;
							if (seenLid.has(lid.key)) continue;
							seenLid.add(lid.key);
							const arr = ledenByPartij.get(lid.partij) ?? [];
							arr.push(lid);
							ledenByPartij.set(lid.partij, arr);
						}
					}
					for (const [partij, leden] of ledenByPartij) {
						const key = partij.toLowerCase();
						list.push({
							id: `fracties/${key}`,
							key,
							naam: partij,
							afkorting: partij,
							aantal_zetels: leden.filter((l) => l.actief).length
						});
						ledenByFractie.set(key, leden);
					}
				}

				loadingStore.set({ kind: 'parliamentary', phase: 'building' });

				prepareBulkLoad(additive);
				const seqBefore = state.seq;

				if (list.length === 0) return null;

				// Layout: fracties on an outer ring sized by seats (largest at top),
				// their leden in a small inner halo around each fractie position.
				const maxSeats = Math.max(1, ...list.map((f) => f.aantal_zetels ?? 0));
				const sorted = [...list].sort((a, b) => (b.aantal_zetels ?? 0) - (a.aantal_zetels ?? 0));
				const N = sorted.length;
				const RING = Math.max(180, N * 38);

				sorted.forEach((f, i) => {
					const angle = (i / Math.max(N, 1)) * Math.PI * 2 - Math.PI / 2;
					const fx = Math.cos(angle) * RING;
					const fy = Math.sin(angle) * RING;

					const fractieNode = fractieToGraphNode(f) as GraphNode & {
						x?: number;
						y?: number;
						size?: number;
					};
					if (!additive) {
						fractieNode.x = fx;
						fractieNode.y = fy;
						fractieNode.size =
							f.aantal_zetels != null ? 6 + ((f.aantal_zetels ?? 0) / maxSeats) * 10 : 9;
					}
					touchNode(fractieNode.id, fractieNode);

					// Place each lid in a tight halo around the fractie. Halo radius
					// scales with seat count — bigger fracties get a wider halo so
					// leden don't overlap.
					const leden = ledenByFractie.get(f.key) ?? [];
					if (leden.length === 0) return;
					const HALO = 22 + Math.sqrt(leden.length) * 8;
					leden.forEach((lid, j) => {
						const lidAngle = (j / leden.length) * Math.PI * 2;
						const lidNode = lidToGraphNode(lid) as GraphNode & {
							x?: number;
							y?: number;
							size?: number;
						};
						if (!additive) {
							lidNode.x = fx + Math.cos(lidAngle) * HALO;
							lidNode.y = fy + Math.sin(lidAngle) * HALO;
							lidNode.size = lid.actief ? 5 : 3.5;
						}
						// Don't overwrite an existing lid node from a different fractie
						// (shouldn't happen with deduped data, but be safe).
						if (!nodes.has(lidNode.id)) touchNode(lidNode.id, lidNode);

						const rel = 'lid_van_fractie';
						const edgeId = `${lidNode.id}->${fractieNode.id}:${rel}`;
						edges.set(edgeId, {
							id: edgeId,
							source: lidNode.id,
							target: fractieNode.id,
							kind: 'parliamentary',
							label: rel,
							directed: true,
							relation: rel
						});
					});
				});

				if (additive) placeAdditiveLayer(seqBefore);
				if (!additive) {
					selectionStore.set(null);
					breadcrumbsStore.set([]);
					graphModeStore.set('bulk');
				}
				updateNodes();
				updateEdges();

				const ledenCount = nodes.size - sorted.length;
				console.log(
					`[graph-store] loadFractiesLayerGraph: ${sorted.length} fracties + ${ledenCount} leden${synthetic ? ' (synthetic)' : ''}${additive ? ' (additive)' : ''}`
				);
				return { count: nodes.size };
			} catch (err) {
				console.warn('[graph-store] loadFractiesLayerGraph failed:', err);
				return null;
			} finally {
				loadingStore.set({ kind: 'idle' });
			}
		},

		loadRecentDossiersGraph: async (opts) => {
			const additive = opts?.additive ?? false;
			// Top-level "dossiers + their publicaties" overview in one click.
			// Open dossiers go on an inner ring, closed dossiers on an outer ring.
			// For the top-N most-recent open dossiers we also pull their documents
			// via /api/dossiers/{key}/documents and place them in a halo around
			// the dossier hub. Remaining dossiers render bare to keep load manageable.
			loadingStore.set({ kind: 'parliamentary', phase: 'fetching' });
			try {
				const list = await fetchRecentDossiers({ days: opts?.days ?? 30, limit: 80 });
				// Bulk-fetch document halos for the top-N open dossiers in a single
				// round-trip. /api/dossiers/documents/bulk runs one AQL pass over
				// all requested dossiers; the server-side per_dossier_limit caps
				// each halo at the same 8 docs we used to slice client-side.
				const HALO_LIMIT = 25;
				const halosFor = list.filter((d) => !d.afgedaan).slice(0, HALO_LIMIT);
				const docsByDossier = new Map<
					string,
					import('$lib/api/parliamentary').DossierDocumentDTO[]
				>();
				if (halosFor.length > 0) {
					const bulk = await fetchDossierDocumentsBulk(
						halosFor.map((d) => d.kamerstuknummer),
						{ perDossierLimit: 8 }
					).catch(
						() => ({}) as Record<string, import('$lib/api/parliamentary').DossierDocumentDTO[]>
					);
					for (const d of halosFor) {
						docsByDossier.set(d.kamerstuknummer, bulk[d.kamerstuknummer] ?? []);
					}
				}

				loadingStore.set({ kind: 'parliamentary', phase: 'building' });

				prepareBulkLoad(additive);
				const seqBefore = state.seq;

				const open = list.filter((d) => !d.afgedaan);
				const closed = list.filter((d) => d.afgedaan);

				const placeRing = (items: typeof list, r: number, withHalos: boolean) => {
					const N = items.length;
					items.forEach((d, i) => {
						const angle = (i / Math.max(N, 1)) * Math.PI * 2 - Math.PI / 2;
						const dx = Math.cos(angle) * r;
						const dy = Math.sin(angle) * r;
						const gn: GraphNode & { x?: number; y?: number; size?: number } = {
							id: graphNodeId('dossiers', d.kamerstuknummer),
							collection: 'dossiers',
							key: d.kamerstuknummer,
							kind: 'dossier',
							label: d.kamerstuknummer,
							raw: {
								id: d.id,
								key: d.kamerstuknummer,
								collection: 'dossiers',
								type: 'dossier',
								display_name: d.titel ?? d.kamerstuknummer,
								labels: ['Dossier'],
								props: {
									kamerstuknummer: d.kamerstuknummer,
									titel: d.titel,
									huidige_fase: d.huidige_fase,
									afgedaan: d.afgedaan
								}
							}
						};
						if (!additive) {
							gn.x = dx;
							gn.y = dy;
							gn.size = d.afgedaan ? 5 : 8;
						}
						touchNode(gn.id, gn);

						if (!withHalos) return;
						const docs = docsByDossier.get(d.kamerstuknummer) ?? [];
						if (docs.length === 0) return;
						const HALO = 18 + Math.sqrt(docs.length) * 6;
						docs.forEach((doc, j) => {
							const dAngle = (j / docs.length) * Math.PI * 2;
							const docId = graphNodeId('publications', doc.key);
							const docNode: GraphNode & { x?: number; y?: number; size?: number } = {
								id: docId,
								collection: 'publications',
								key: doc.key,
								kind: 'tkstuk',
								label: doc.display_name ?? doc.titel ?? doc.soort ?? doc.key,
								raw: {
									id: doc.id,
									key: doc.key,
									collection: 'publications',
									type: 'publication',
									display_name: doc.display_name ?? doc.titel ?? null,
									labels: ['Publication'],
									props: {
										soort: doc.soort,
										titel: doc.titel,
										datum: doc.datum,
										volgnummer: doc.volgnummer,
										dossier_nummer: doc.dossier_nummer,
										vergaderjaar: doc.vergaderjaar,
										tk_url: doc.tk_url
									}
								}
							};
							if (!additive) {
								docNode.x = dx + Math.cos(dAngle) * HALO;
								docNode.y = dy + Math.sin(dAngle) * HALO;
								docNode.size = 4.5;
							}
							if (!nodes.has(docNode.id)) touchNode(docNode.id, docNode);

							const rel = 'behandelt_artikel';
							const edgeId = `${gn.id}->${docNode.id}:${rel}`;
							edges.set(edgeId, {
								id: edgeId,
								source: gn.id,
								target: docNode.id,
								kind: 'parliamentary',
								label: rel,
								directed: true,
								relation: rel
							});
						});
					});
				};

				const innerR = Math.max(180, open.length * 18);
				const outerR = innerR + Math.max(60, closed.length * 6);
				placeRing(open, innerR, true); // halos for open dossiers
				placeRing(closed, outerR, false); // closed dossiers plain

				if (additive) placeAdditiveLayer(seqBefore);
				if (!additive) {
					selectionStore.set(null);
					breadcrumbsStore.set([]);
					graphModeStore.set('bulk');
				}
				updateNodes();
				updateEdges();

				const docCount = nodes.size - list.length;
				console.log(
					`[graph-store] loadRecentDossiersGraph: ${list.length} dossiers (${open.length} open, ${closed.length} closed) + ${docCount} publicaties${additive ? ' (additive)' : ''}`
				);
				return { count: nodes.size };
			} catch (err) {
				console.warn('[graph-store] loadRecentDossiersGraph failed:', err);
				return null;
			} finally {
				loadingStore.set({ kind: 'idle' });
			}
		}
	};
}
