<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type SigmaType from 'sigma';
	import type Graph from 'graphology';
	import type { GraphFilters } from '$lib/graph/graph-store';
	import type { NodeCounts } from '$lib/api/overlays';
	import { edgeCategory, EDGE_WEIGHT, type GraphNodeKind } from '$lib/graph/types';
	import type { Relation } from '$lib/vocabulary';
	import { spriteFor, shapeFor, badgeAxisOffset, EDGE_COLOR } from './nodeSprites';

	export type GraphCanvasApi = {
		refresh: () => void;
		fit: () => void;
		restoreCamera: (state: { x: number; y: number; ratio: number }) => void;
	};

	// Shown on the edges of the hovered node.
	const RELATION_LABEL: Record<Relation, string> = {
		PART_OF: 'onderdeel van',
		VERSION_OF: 'versie van',
		AMENDS: 'wijzigt',
		INTRODUCES: 'voegt toe',
		REPEALS: 'trekt in',
		BASED_ON: 'gebaseerd op',
		IMPLEMENTS: 'implementeert',
		LEGISLATED_IN: 'vastgesteld in',
		REFERS_TO: 'verwijst naar',
		EXPLAINS: 'licht toe',
		APPEAL_OF: 'hoger beroep van',
		SCOPED_BY: 'begrensd door',
		ABOUT: 'over',
		LED_BY: 'geleid door',
		MADE_IN: 'gedaan in',
		MEMBER_OF: 'lid van',
		AUTHORED: 'ondertekend',
		VOTED: 'stemde'
	};

	// Vote colour of a VOTED edge: meta.choice is "Voor" or "Tegen"; any other
	// choice (abstention, absence) stays grey.
	const VOTE_COLOR: Record<string, string> = {
		voor: '#16a34a',
		tegen: '#dc2626'
	};
	const VOTE_OTHER = '#9A9485';

	let {
		graph,
		focusedId = null as string | null,
		filters = null as GraphFilters | null,
		pinnedIds = new Set<string>() as Set<string>,
		hideArticleEdges = false,
		collapseToLaws = false,
		inFluxMap = new Map() as NodeCounts,
		heatMap = new Map() as NodeCounts,
		heatActive = false,
		heatPeriodMonths = 12,
		mutatieActive = false,
		onNodeClick,
		onNodeHover,
		onNodeLeave,
		onStageClick,
		onReady,
		onZoomChange,
		onCameraChange,
		externalHoveredId = null as string | null
	}: {
		graph: Graph;
		focusedId?: string | null;
		filters?: GraphFilters | null;
		pinnedIds?: Set<string>;
		hideArticleEdges?: boolean;
		collapseToLaws?: boolean;
		/** In-flux counts (open mutaties) — empty unless Mutatie overlay is active. */
		inFluxMap?: NodeCounts;
		/** Heat counts (citations in window) — empty unless Activiteit is active. */
		heatMap?: NodeCounts;
		heatActive?: boolean;
		/** Window length backing the heat map. Drives per-month normalisation so
		 *  switching 3m → 24m visibly grows halos instead of just rescaling. */
		heatPeriodMonths?: number;
		/** Render mutatie badges on in-flux nodes. */
		mutatieActive?: boolean;
		onNodeClick?: (id: string) => void;
		onNodeHover?: (id: string, vx: number, vy: number) => void;
		onNodeLeave?: () => void;
		onStageClick?: () => void;
		onReady?: (api: GraphCanvasApi) => void;
		onZoomChange?: (ratio: number) => void;
		onCameraChange?: (state: { x: number; y: number; ratio: number }) => void;
		/** External hover override — keeps the dim/highlight pass active even when
		 *  sigma's mouse-tracked hover has fired leaveNode (e.g. while the hover
		 *  popup in GraphView is open). When set, overrides sigma's tracking. */
		externalHoveredId?: string | null;
	} = $props();

	let wrap: HTMLDivElement;
	let renderer: SigmaType | null = null;

	// Plain mutable refs read inside sigma reducer closures — not reactive state.
	// Sigma re-renders on camera/graph changes; we just update these refs and
	// call renderer.refresh() to pick up filter changes.
	let currentCameraRatio = 1;
	let latestFilters: GraphFilters | null = null;
	let latestPinnedIds = new Set<string>();
	let latestHideArticleEdges = false;
	let latestCollapseToLaws = false;
	let latestInFluxMap: NodeCounts = new Map();
	let latestHeatMap: NodeCounts = new Map();
	let latestHeatActive = false;
	let latestHeatPeriodMonths = 12;
	let latestMutatieActive = false;

	// Hover state — drives the dim/highlight pass in nodeReducer / edgeReducer.
	// Two sources feed it:
	//   • sigma's enterNode / leaveNode (live mouse position)
	//   • externalHoveredId prop (kept alive while the hover popup is open)
	// Effective hover = external prop ?? sigma-tracked id.
	let sigmaHoveredId: string | null = null;
	let hoveredId: string | null = null;
	// Cached neighbour set of the hovered node (undirected). Recomputed when
	// hoveredId changes to keep the reducers cheap.
	let hoveredNeighbours: Set<string> = new Set();
	// Edges promoted to zIndex=2 for the current hover. Tracked so we can
	// demote them when hover ends. Sigma sorts edges by their graphology
	// `zIndex` attribute during indexation — the reducer's zIndex is ignored
	// for ordering, so we mutate the attribute directly.
	let promotedEdges: string[] = [];
	function promoteEdgesForHover(nodeId: string | null) {
		for (const e of promotedEdges) {
			try {
				graph.setEdgeAttribute(e, 'zIndex', 0);
			} catch {
				/* edge gone */
			}
		}
		promotedEdges = [];
		if (!nodeId || !graph.hasNode(nodeId)) return;
		graph.forEachEdge((e, _attrs, source, target) => {
			if (source === nodeId || target === nodeId) {
				graph.setEdgeAttribute(e, 'zIndex', 2);
				promotedEdges.push(e);
			}
		});
	}
	function setHoveredId(next: string | null) {
		if (hoveredId === next) return;
		hoveredId = next;
		hoveredNeighbours = new Set();
		if (hoveredId) {
			try {
				graph.forEachNeighbor(hoveredId, (n) => hoveredNeighbours.add(n));
			} catch {
				/* node may be gone */
			}
		}
		promoteEdgesForHover(hoveredId);
		renderer?.refresh();
	}

	// Sync overlay props into mutable refs and trigger refresh.
	$effect(() => {
		latestInFluxMap = inFluxMap ?? new Map();
		latestHeatMap = heatMap ?? new Map();
		latestHeatActive = heatActive ?? false;
		latestHeatPeriodMonths = heatPeriodMonths ?? 12;
		latestMutatieActive = mutatieActive ?? false;
		updateViewportLabels();
		renderer?.refresh();
	});

	// Effective hover priority: live sigma tracking wins (it's where the cursor
	// is right now). External (popup-driven) only matters when sigma reports no
	// hover — that's how the dim/highlight stays alive while the cursor sits
	// on the hover popup outside the sigma node.
	$effect(() => {
		setHoveredId(sigmaHoveredId ?? externalHoveredId);
	});

	// Sync filter props into mutable refs and trigger a sigma refresh.
	// When collapse mode changes, also adjust sigma's label-density settings:
	//   collapsed  → show every label (grid cell = 1 px)
	//   expanded   → sparse labels to avoid clutter (grid cell = 60 px)
	$effect(() => {
		latestFilters = filters;
		latestPinnedIds = pinnedIds;
		latestHideArticleEdges = hideArticleEdges;
		const prev = latestCollapseToLaws;
		latestCollapseToLaws = collapseToLaws;

		if (renderer && prev !== collapseToLaws) {
			if (collapseToLaws) {
				renderer.setSetting('labelGridCellSize', 1); // one label per pixel → all shown
				renderer.setSetting('labelDensity', 10);
			} else {
				renderer.setSetting('labelGridCellSize', 60);
				renderer.setSetting('labelDensity', 1.4);
			}
		}

		renderer?.refresh();
	});

	// Activity halos — true overlay rendered as HTML rings above the canvas.
	// The base node visual (paper / ink / spine) is never touched: the halo is
	// a hollow ring whose color scales from rule-strong (#B8B0A0) at low
	// activity to spine (#7A1F1A) at saturation.
	type ActivityHalo = { id: string; vx: number; vy: number; ringPx: number; color: string };
	let activityHalos = $state<ActivityHalo[]>([]);

	function heatColor(t: number): string {
		const r = Math.round(0xb8 + t * (0x7a - 0xb8));
		const g = Math.round(0xb0 + t * (0x1f - 0xb0));
		const b = Math.round(0xa0 + t * (0x1a - 0xa0));
		return `rgb(${r},${g},${b})`;
	}

	// Mutatie badges — small spine-coloured circles anchored to in-flux nodes,
	// showing the open-dossier count when > 1. Drawn at top-right of each node.
	type MutatieBadge = { id: string; vx: number; vy: number; count: number };
	let mutatieBadges = $state<MutatieBadge[]>([]);

	// Heat scale: per-month rate so longer windows visibly grow halos. A rate
	// of HEAT_SATURATION_RATE (citations/month) saturates the halo size.
	const HEAT_SATURATION_RATE = 5;

	function updateViewportLabels() {
		// Effective on-screen node radius: sigma divides the size attribute by
		// zoomToSizeRatioFunction(cameraRatio) before rendering (see the sigma
		// settings block — we use min(sqrt(ratio), 1.5)). Compute the same
		// divisor here so overlays line up with where edges actually terminate.
		const sizeDivisor = renderer
			? Math.min(Math.sqrt(renderer.getCamera().getState().ratio), 1.5)
			: 1;

		// Recompute activity halos in viewport space on every frame. Cheap unless
		// there are >>1000 visible active nodes; the heatMap size is bounded by
		// the loaded graph anyway.
		if (renderer && latestHeatActive && latestHeatMap.size > 0) {
			const halos: ActivityHalo[] = [];
			// Per-month rate normalisation. A node cited 5+ times per month over the
			// chosen window saturates. Crucially this is window-relative: switching
			// 3m → 24m on the same node yields a larger (or smaller) halo because
			// the cumulative count grows but is then divided by the new window.
			const months = Math.max(1, latestHeatPeriodMonths);
			graph.forEachNode((id, attrs) => {
				if (attrs.hidden) return;
				const activity = latestHeatMap.get(id) ?? 0;
				if (activity <= 0) return;
				const rate = activity / months;
				const t = Math.min(rate / HEAT_SATURATION_RATE, 1);
				const baseR = ((attrs.size as number) ?? 5) / sizeDivisor;
				// Ring radius extends 4..20 pixels beyond the node edge, scaled by rate.
				const ringPx = baseR + 4 + t * 16;
				const color = heatColor(t);
				const vp = renderer!.graphToViewport({ x: attrs.x as number, y: attrs.y as number });
				halos.push({ id, vx: vp.x, vy: vp.y, ringPx, color });
			});
			activityHalos = halos;
		} else if (activityHalos.length) {
			activityHalos = [];
		}

		// Mutatie badges — same projection loop as halos. Anchored at top-right
		// of each in-flux node, just outside its rendered edge.
		if (renderer && latestMutatieActive && latestInFluxMap.size > 0) {
			const badges: MutatieBadge[] = [];
			graph.forEachNode((id, attrs) => {
				if (attrs.hidden) return;
				const count = latestInFluxMap.get(id) ?? 0;
				if (count <= 0) return;
				// Effective rendered radius in viewport pixels — must match what sigma
				// actually paints so the badge sits flush against the node edge,
				// exactly where incident graph edges terminate.
				const baseR = ((attrs.size as number) ?? 5) / sizeDivisor;
				const vp = renderer!.graphToViewport({ x: attrs.x as number, y: attrs.y as number });
				// Per-axis offset at 45° depends on the node's shape — circles use
				// 0.707 (cos 45° on the bounding circle), other shapes use values
				// tuned to sit on their actual silhouette. See nodeSprites.ts.
				const kindAttr = attrs.kind as GraphNodeKind | undefined;
				const offset = baseR * (kindAttr ? badgeAxisOffset(kindAttr) : 0.707);
				badges.push({ id, vx: vp.x + offset, vy: vp.y - offset, count });
			});
			mutatieBadges = badges;
		} else if (mutatieBadges.length) {
			mutatieBadges = [];
		}
	}

	// Recompute overlay positions once the renderer exists.
	$effect(() => {
		updateViewportLabels();
	});

	function refresh() {
		recomputeFocusLevel1();
		renderer?.refresh();
	}

	function fit() {
		if (!renderer) return;

		// animatedReset fits every graphology node, filtered-out ones included.
		// Their positions would widen the bounding box and push the visible
		// nodes into a corner, so normalise over the visible nodes only.
		const f = latestFilters;
		let minX = Infinity,
			maxX = -Infinity,
			minY = Infinity,
			maxY = -Infinity;
		let count = 0;
		graph.forEachNode((id, attrs) => {
			if (f) {
				if (f.nodeTypeToggles[attrs.kind as GraphNodeKind] === false) return;
				if (f.minDegree > 0 && graph.degree(id) < f.minDegree) return;
				if (attrs.kind === 'article' && f.activeInstruments.size > 0) {
					if (!f.activeInstruments.has(attrs.bwb as string)) return;
				}
			}
			const x = (attrs.x as number) ?? 0;
			const y = (attrs.y as number) ?? 0;
			minX = Math.min(minX, x);
			maxX = Math.max(maxX, x);
			minY = Math.min(minY, y);
			maxY = Math.max(maxY, y);
			count++;
		});

		if (count > 0) {
			const padX = (maxX - minX) * 0.12 || 1;
			const padY = (maxY - minY) * 0.12 || 1;
			renderer.setCustomBBox({ x: [minX - padX, maxX + padX], y: [minY - padY, maxY + padY] });
		} else {
			renderer.setCustomBBox(null);
		}

		renderer.getCamera().animatedReset({ duration: 300 });
	}

	function restoreCamera(state: { x: number; y: number; ratio: number }) {
		renderer?.getCamera().setState(state);
	}

	onMount(async () => {
		const t0 = performance.now();
		const [
			{ default: Sigma },
			{ EdgeArrowProgram },
			{ createNodeBorderProgram },
			{ NodeSquareProgram },
			{ createNodeImageProgram },
			{ DashedEdgeArrowProgram }
		] = await Promise.all([
			import('sigma'),
			import('sigma/rendering'),
			import('@sigma/node-border'),
			import('@sigma/node-square'),
			import('@sigma/node-image'),
			import('./DashedEdgeProgram')
		]);
		// keepWithinCircle:true clips the sprite to its inscribed circle. The
		// shapes (diamond/hex/rrect) are drawn at ~87% of the sprite bbox in the
		// SVG, so they sit comfortably inside the clip and the visible silhouette
		// is the shape. Without this clip, the square texture region renders the
		// node `color` as a square patch behind the shape — the white squares
		// you were seeing. drawingMode:'background' keeps the sprite's own pixel
		// colours (kind colour baked into the SVG).
		const NodeImageProgram = createNodeImageProgram({
			keepWithinCircle: true,
			drawingMode: 'background',
			padding: 0
		});
		const tImport = performance.now() - t0;

		const NodeBorderProgram = createNodeBorderProgram({
			borders: [
				{
					color: { attribute: 'selectionColor', defaultValue: 'rgba(0,0,0,0)' },
					size: { value: 2.5, mode: 'pixels' }
				},
				{
					color: { attribute: 'borderColor', defaultValue: '#1A1814' },
					size: { value: 1.4, mode: 'pixels' }
				},
				{ color: { attribute: 'color', defaultValue: '#FFFDF4' }, size: { fill: true } }
			]
		});

		renderer = new Sigma(graph, wrap, {
			nodeProgramClasses: {
				border: NodeBorderProgram,
				square: NodeSquareProgram,
				image: NodeImageProgram
			},
			edgeProgramClasses: { arrow: EdgeArrowProgram, dashed: DashedEdgeArrowProgram },
			defaultNodeType: 'border',
			defaultEdgeType: 'arrow',

			// Honour `zIndex` from the reducer so hovered edges paint on top of
			// dimmed ones in the same frame — pure draw-order, no graph mutation.
			zIndex: true,

			// Edge labels are off by default; nodeReducer sets `forceLabel` on the
			// edges incident to the hovered node, so they appear only on hover.
			renderEdgeLabels: true,
			labelFont: '"EB Garamond", Georgia, serif',
			labelSize: 12,
			labelWeight: '400',
			labelColor: { color: '#6B6558' },
			edgeLabelColor: { color: '#3A362E' },
			edgeLabelFont: '"EB Garamond", Georgia, serif',
			edgeLabelSize: 11,
			labelDensity: 1.4,
			labelGridCellSize: 60,
			labelRenderedSizeThreshold: 3,

			enableEdgeEvents: false,
			allowInvalidContainer: true,

			// Keep nodes hoverable when zoomed out. Sigma's default uses sqrt(ratio)
			// which shrinks nodes rapidly past ratio=2. We cap the effective ratio
			// at 1.5 — beyond that, nodes stay the same screen size, so even a
			// far-zoomed canvas still has clickable targets.
			zoomToSizeRatioFunction: (ratio: number) => Math.min(Math.sqrt(ratio), 1.5),

			nodeReducer: (id, data) => {
				// Mutual exclusion between an instrument and its articles — when
				// both are loaded, computeLevelSuppression in GraphView marks the
				// redundant side. Honour it before any other pass so the suppressed
				// node is fully out of hit-testing.
				if (data.suppressedByLevel) return { ...data, hidden: true };

				if (!latestPinnedIds.has(id)) {
					const f = latestFilters;
					if (f) {
						if (f.nodeTypeToggles[data.kind as GraphNodeKind] === false) {
							return { ...data, hidden: true };
						}
						if (f.minDegree > 0 && graph.degree(id) < f.minDegree) {
							return { ...data, hidden: true };
						}
						if (data.kind === 'article' && f.activeInstruments.size > 0) {
							if (!f.activeInstruments.has(data.bwb as string)) return { ...data, hidden: true };
						}
					}
				}

				// ── Stale-context dim ─────────────────────────────────────────────────
				// Additive expansion grows the graph as the user clicks. Nodes that
				// aren't part of the current focus's immediate neighbourhood are
				// background — fade them so signal stays readable without forcing a
				// hard prune. Hover and focus override this in the passes below.
				const f0 = latestFilters;
				const dimStale =
					f0?.dimStaleContext !== false &&
					focusedId !== null &&
					id !== focusedId &&
					!focusLevel1.has(id) &&
					!latestPinnedIds.has(id);

				// ── Hover gating ──────────────────────────────────────────────────────
				// Node is visible (passed all filters); decide whether it lights up or
				// dims based on hover. Hover-dim never resurrects a filtered-out node
				// because we already returned above for those.
				const inHover = hoveredId !== null;
				const inFocusGroup = !inHover || id === hoveredId || hoveredNeighbours.has(id);
				if (inHover && !inFocusGroup) {
					return {
						...data,
						hidden: false,
						label: '',
						color: '#EDE8DC',
						borderColor: '#C8C0B4',
						selectionColor: 'rgba(0,0,0,0)'
					};
				}

				if (dimStale && !inHover) {
					return {
						...data,
						hidden: false,
						label: '',
						color: '#EDE8DC',
						borderColor: '#D8D2C4',
						selectionColor: 'rgba(0,0,0,0)'
					};
				}

				// ── Labels: only on hover ────────────────────────────────────────────
				// At rest the canvas is label-free — labels at every zoom level were
				// unreadable in dense graphs and competed with the node colours. On
				// hover, the focus group (hovered node + neighbours) gets force-shown
				// labels so the user can read what's connected without zooming in.
				let label: string = '';
				let forceLabel = false;
				if (inHover && inFocusGroup) {
					label = data.label as string;
					forceLabel = true;
				}

				// ── Heat layer ───────────────────────────────────────────────────────
				// Activity is a TRUE overlay now: halo rings rendered as HTML on top
				// of the canvas (see `activityHalos` + the overlay markup below).
				// The node visual stays untouched so domain colors remain readable.

				// ── Focus highlight ───────────────────────────────────────────────────
				// Circle kinds (border program): crimson ring via selectionColor.
				// Non-circle kinds (image program): swap to the focused sprite variant
				// — same shape, crimson outline baked in. Either way the node's own
				// colour stays so article vs judgment type remains visible.
				if (id !== focusedId) return { ...data, hidden: false, label, forceLabel };
				const focusKind = data.kind as GraphNodeKind;
				const focusBoost = ((data.size as number) ?? 4) * 1.6;
				if (shapeFor(focusKind) === 'circle') {
					return {
						...data,
						hidden: false,
						label,
						forceLabel,
						selectionColor: '#7A1F1A',
						size: focusBoost,
						zIndex: 2
					};
				}
				return {
					...data,
					hidden: false,
					label,
					forceLabel,
					image: spriteFor(focusKind, !!data.stub, true),
					size: focusBoost,
					zIndex: 2
				};
			},
			edgeReducer: (edge, data) => {
				// Hide edges whose endpoint was suppressed by the Detail-niveau
				// mutual exclusion. Without this, an article→article edge would
				// dangle from a hidden article in Wetten view.
				const src = graph.source(edge);
				const tgt = graph.target(edge);
				if (
					graph.getNodeAttribute(src, 'suppressedByLevel') ||
					graph.getNodeAttribute(tgt, 'suppressedByLevel')
				) {
					return { ...data, hidden: true };
				}

				// In Wetten mode articles are not drawn, so neither are their edges.
				// Edges between other kinds (instrument to judgment, faction to
				// member, ...) stay because their endpoints are still on the canvas.
				if (
					latestCollapseToLaws &&
					(graph.getNodeAttribute(src, 'kind') === 'article' ||
						graph.getNodeAttribute(tgt, 'kind') === 'article')
				) {
					return { ...data, hidden: true };
				}

				// ── Edge category filter ──────────────────────────────────────────────
				const f = latestFilters;
				const relation = data.relation as Relation;
				const category = edgeCategory(
					relation,
					graph.getNodeAttribute(src, 'kind') as GraphNodeKind
				);
				const baseSize = EDGE_WEIGHT[relation];
				if (f && !f[`${category}Enabled`]) return { ...data, hidden: true };

				if (
					latestHideArticleEdges &&
					graph.getNodeAttribute(src, 'kind') === 'article' &&
					graph.getNodeAttribute(tgt, 'kind') === 'article'
				) {
					return { ...data, hidden: true };
				}

				// ── Style ─────────────────────────────────────────────────────────────
				// Solid arrows; the category shows in colour and weight (structural
				// moss, mutation spine and heavier, semantic slate and thin).
				let renderColor = EDGE_COLOR[category];
				let edgeType: 'arrow' | 'dashed' = 'arrow';
				let restSize = baseSize;

				// VOTED: dashed and coloured by meta.choice, so the votes on a
				// decision read at a glance. meta.seats is not drawn.
				if (relation === 'VOTED') {
					const choice = (data.meta as Record<string, unknown> | null | undefined)?.choice;
					renderColor = VOTE_COLOR[String(choice).toLowerCase()] ?? VOTE_OTHER;
					edgeType = 'dashed';
					restSize = Math.max(baseSize, 0.7);
				}

				// ── Hover dim/highlight ───────────────────────────────────────────────
				// Edges incident to the hovered node show their relation (and
				// confidence) as a label; non-incident edges dim to paper-3 grey.
				// Outside hover we don't render edge labels.
				if (hoveredId !== null) {
					const incident = src === hoveredId || tgt === hoveredId;
					if (incident) {
						const conf = data.confidence as number | null | undefined;
						const label = RELATION_LABEL[relation];
						return {
							...data,
							hidden: false,
							type: edgeType,
							color: renderColor,
							size: restSize * 1.3,
							label: conf != null ? `${label} · ${conf.toFixed(2)}` : label,
							forceLabel: true,
							zIndex: 2
						};
					}
					// Dim-kleur bij hover van een andere node: voorheen #D8D2C4
					// (~rgb 216,210,196), tegen paper-achtergrond nauwelijks te
					// onderscheiden — niet-incidente edges zagen er "wit" uit.
					// ink-4 (#9A9485) houdt de edge zichtbaar maar onmiskenbaar
					// achtergrond.
					return {
						...data,
						hidden: false,
						type: edgeType,
						color: '#9A9485',
						size: restSize,
						label: '',
						zIndex: 0
					};
				}

				// ── Default rest state ───────────────────────────────────────────────
				return {
					...data,
					hidden: false,
					type: edgeType,
					color: renderColor,
					size: restSize,
					label: ''
				};
			}
		});

		// Report the zoom ratio.
		// Debounce the onCameraChange callback so we only save state after the
		// user has stopped panning/zooming, not on every animation frame.
		let cameraChangeTimer: ReturnType<typeof setTimeout> | null = null;
		renderer.getCamera().on('updated', () => {
			const state = renderer!.getCamera().getState();
			currentCameraRatio = state.ratio;
			onZoomChange?.(currentCameraRatio);
			if (onCameraChange) {
				if (cameraChangeTimer) clearTimeout(cameraChangeTimer);
				cameraChangeTimer = setTimeout(() => {
					onCameraChange({ x: state.x, y: state.y, ratio: state.ratio });
				}, 400);
			}
		});

		// Halos and badges follow the camera.
		renderer.on('afterRender', updateViewportLabels);

		renderer.on('clickNode', ({ node }) => onNodeClick?.(node));
		renderer.on('clickStage', () => onStageClick?.());
		renderer.on('enterNode', ({ node, event }) => {
			sigmaHoveredId = node;
			setHoveredId(node);
			onNodeHover?.(node, event.x, event.y);
		});
		renderer.on('leaveNode', () => {
			sigmaHoveredId = null;
			// When the popup is open, externalHoveredId keeps the dim/highlight alive.
			setHoveredId(externalHoveredId ?? null);
			onNodeLeave?.();
		});

		const tInit = performance.now() - t0;
		console.log(
			`[perf] sigma boot — ${Math.round(tInit)}ms ` +
				`(import ${Math.round(tImport)}ms, init ${Math.round(tInit - tImport)}ms; ` +
				`${graph.order} nodes, ${graph.size} edges)`
		);
		onReady?.({ refresh, fit, restoreCamera });
	});

	// Cached level-1 set of the focused node — drives the stale-context dim.
	// Recomputed when focus changes or the graph mutates (refresh triggers).
	let focusLevel1 = new Set<string>();
	function recomputeFocusLevel1() {
		focusLevel1 = new Set();
		if (!focusedId || !graph.hasNode(focusedId)) return;
		try {
			graph.forEachNeighbor(focusedId, (n) => focusLevel1.add(n));
		} catch {
			/* node removed mid-render */
		}
	}
	$effect(() => {
		void focusedId;
		recomputeFocusLevel1();
		renderer?.refresh();
	});

	onDestroy(() => {
		renderer?.kill();
		renderer = null;
	});
</script>

<!-- pointerleave clears any lingering hover state — sigma only fires leaveNode
     when crossing a specific node, not when the cursor leaves the canvas via
     empty space. Without this, the dim/highlight could persist indefinitely. -->
<div
	bind:this={wrap}
	class="canvas-wrap"
	onpointerleave={() => {
		if (sigmaHoveredId !== null) {
			sigmaHoveredId = null;
			setHoveredId(externalHoveredId ?? null);
		}
	}}
>
	{#if activityHalos.length > 0}
		<div class="activity-overlay" aria-hidden="true">
			{#each activityHalos as h (h.id)}
				<span
					class="activity-ring"
					style="left:{h.vx}px; top:{h.vy}px; width:{h.ringPx * 2}px; height:{h.ringPx *
						2}px; border-color:{h.color}"
				></span>
			{/each}
		</div>
	{/if}
	{#if mutatieBadges.length > 0}
		<div class="mutatie-overlay" aria-hidden="true">
			{#each mutatieBadges as b (b.id)}
				<span
					class="mutatie-badge"
					class:mutatie-badge--multi={b.count > 1}
					style="left:{b.vx}px; top:{b.vy}px">{b.count > 1 ? b.count : ''}</span
				>
			{/each}
		</div>
	{/if}
</div>

<style>
	.canvas-wrap {
		width: 100%;
		height: 100%;
		position: relative;
		overflow: hidden;
		background: var(--paper);
		user-select: none;
	}

	:global(.canvas-wrap canvas) {
		display: block;
	}

	/* Activity overlay — true halo ring on top of the canvas. The base node
     visual is untouched; only the ring conveys "this is being cited a lot".
     Ring diameter scales with citation density (set inline). */
	.activity-overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
		overflow: hidden;
		z-index: 5; /* above the sigma canvas (default z-index 0) */
	}
	.activity-ring {
		position: absolute;
		transform: translate(-50%, -50%);
		border-radius: 50%;
		border: 2px solid;
		background: transparent;
	}

	/* Mutatie overlay — small spine-coloured badges on in-flux nodes. The dot
     reads as a marker at a glance; the numeric count appears only when more
     than one open dossier targets the same node. */
	.mutatie-overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
		overflow: hidden;
		z-index: 6; /* above activity halos so the two stack cleanly if both fire */
	}
	.mutatie-badge {
		position: absolute;
		transform: translate(-50%, -50%);
		min-width: 14px;
		height: 14px;
		padding: 0 3px;
		border-radius: 7px;
		background: var(--spine);
		color: var(--paper);
		border: 1.5px solid var(--paper);
		box-shadow: 0 0 0 1px var(--spine);
		font-family: var(--font-sans);
		font-size: 9px;
		font-weight: 700;
		line-height: 11px;
		text-align: center;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.mutatie-badge--multi {
		background: var(--spine-2, var(--spine));
	}
</style>
