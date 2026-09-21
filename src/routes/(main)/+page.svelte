<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { track } from '$lib/analytics';
	import { getCorpusStats } from '$lib/api/stats';
	import VerkenNetwerk from '$lib/components/home/VerkenNetwerk.svelte';

	// ── Graph data ───────────────────────────────────────────────
	const HERO_NODES = [
		{ id: 'bw6_162', x: 0.5, y: 0.5, kind: 'article', label: 'BW 6:162', size: 7 },
		{ id: 'hr19', x: 0.74, y: 0.32, kind: 'judgment', label: 'HR 2019:1234', size: 6 },
		{ id: 'hr16', x: 0.28, y: 0.3, kind: 'judgment', label: 'HR 2016:743', size: 5 },
		{ id: 'bw6_74', x: 0.78, y: 0.62, kind: 'article', label: 'BW 6:74', size: 5 },
		{ id: 'bw6_98', x: 0.18, y: 0.66, kind: 'article', label: 'BW 6:98', size: 4 },
		{ id: 'bw6_163', x: 0.62, y: 0.78, kind: 'article', label: 'BW 6:163', size: 4 },
		{ id: 'hr05', x: 0.86, y: 0.46, kind: 'judgment', label: 'HR 2005:881', size: 4 },
		{ id: 'hr92', x: 0.1, y: 0.46, kind: 'judgment', label: 'HR 1992:5', size: 4 },
		{ id: 'bw6_101', x: 0.4, y: 0.84, kind: 'article', label: 'BW 6:101', size: 4 },
		{ id: 'bw6_106', x: 0.56, y: 0.16, kind: 'article', label: 'BW 6:106', size: 3 },
		{ id: 'dos1', x: 0.26, y: 0.12, kind: 'dossier', label: 'Dossier 36586', size: 4 },
		{ id: 'dos2', x: 0.78, y: 0.86, kind: 'dossier', label: 'Dossier 36600', size: 3 },
		{ id: 's1', x: 0.92, y: 0.18, kind: 'article', size: 2 },
		{ id: 's2', x: 0.04, y: 0.22, kind: 'judgment', size: 2 },
		{ id: 's3', x: 0.96, y: 0.74, kind: 'article', size: 2 },
		{ id: 's4', x: 0.06, y: 0.82, kind: 'article', size: 2 },
		{ id: 's5', x: 0.46, y: 0.04, kind: 'judgment', size: 2 },
		{ id: 's6', x: 0.34, y: 0.96, kind: 'dossier', size: 2 },
		{ id: 's7', x: 0.7, y: 0.06, kind: 'article', size: 2 },
		{ id: 's8', x: 0.22, y: 0.1, kind: 'article', size: 2 }
	];

	const HERO_EDGES: Array<[string, string, string]> = [
		['bw6_162', 'hr19', 'interpret'],
		['bw6_162', 'hr16', 'interpret'],
		['bw6_162', 'bw6_74', 'cite'],
		['bw6_162', 'bw6_98', 'cite'],
		['bw6_162', 'bw6_163', 'cite'],
		['bw6_162', 'hr05', 'interpret'],
		['bw6_162', 'hr92', 'interpret'],
		['bw6_162', 'bw6_101', 'cite'],
		['bw6_162', 'bw6_106', 'cite'],
		['hr19', 'bw6_74', 'cite'],
		['hr19', 'bw6_106', 'cite'],
		['hr16', 'bw6_98', 'cite'],
		['hr16', 'bw6_101', 'cite'],
		['hr05', 'bw6_163', 'cite'],
		['hr92', 'bw6_98', 'cite'],
		['bw6_74', 'bw6_101', 'cite'],
		['bw6_98', 'bw6_101', 'cite'],
		['bw6_162', 'dos1', 'dossier'],
		['bw6_162', 'dos2', 'dossier'],
		['hr16', 'dos1', 'dossier'],
		['bw6_162', 's1', 'mention'],
		['bw6_162', 's2', 'mention'],
		['bw6_162', 's3', 'mention'],
		['bw6_162', 's4', 'mention'],
		['bw6_162', 's5', 'mention'],
		['bw6_162', 's6', 'mention'],
		['bw6_162', 's7', 'mention'],
		['bw6_162', 's8', 'mention'],
		['hr19', 's1', 'mention'],
		['hr16', 's2', 'mention'],
		['bw6_74', 's3', 'mention'],
		['bw6_98', 's4', 'mention'],
		['bw6_106', 's5', 'mention'],
		['bw6_163', 's7', 'mention']
	];

	const CITE_DETAILS: Record<string, { kind: string; title: string; sub: string }> = {
		bw6_162: { kind: 'Artikel · Burgerlijk Wetboek', title: 'Onrechtmatige daad', sub: 'BW 6:162' },
		hr19: {
			kind: 'Arrest · Hoge Raad',
			title: 'Aansprakelijkheid bij sport en spel',
			sub: 'ECLI:NL:HR:2019:1234'
		},
		hr16: { kind: 'Arrest · Hoge Raad', title: 'Bewijslastverdeling', sub: 'ECLI:NL:HR:2016:743' },
		bw6_74: {
			kind: 'Artikel · Burgerlijk Wetboek',
			title: 'Schadevergoeding bij wanprestatie',
			sub: 'BW 6:74'
		},
		bw6_98: {
			kind: 'Artikel · Burgerlijk Wetboek',
			title: 'Toerekening van schade',
			sub: 'BW 6:98'
		},
		bw6_163: { kind: 'Artikel · Burgerlijk Wetboek', title: 'Relativiteit', sub: 'BW 6:163' },
		hr05: { kind: 'Arrest · Hoge Raad', title: 'Causaal verband', sub: 'ECLI:NL:HR:2005:881' },
		hr92: { kind: 'Arrest · Hoge Raad', title: 'Kelderluik-criteria', sub: 'ECLI:NL:HR:1992:5' },
		bw6_101: { kind: 'Artikel · Burgerlijk Wetboek', title: 'Eigen schuld', sub: 'BW 6:101' },
		bw6_106: { kind: 'Artikel · Burgerlijk Wetboek', title: 'Smartengeld', sub: 'BW 6:106' },
		dos1: {
			kind: 'Wetgevingsdossier · Tweede Kamer',
			title: 'Aanpassing aansprakelijkheidsrecht',
			sub: 'Dossier 36586'
		},
		dos2: {
			kind: 'Wetgevingsdossier · Tweede Kamer',
			title: 'Belastingmaatregelen 2025',
			sub: 'Dossier 36600'
		}
	};

	// ── Hemicycle blok in de Ontdekken-tegel: dezelfde 150-zetel layout
	//    als de docs-figuren, geschaald op de mode-card. ──────────────
	const PARL_ROWS = [14, 17, 19, 21, 24, 26, 29];
	type ParlSeat = { x: number; y: number; band: 'l' | 'c' | 'r' };
	function buildParlSeats(cx: number, cy: number, rInner: number, rOuter: number): ParlSeat[] {
		const rows = PARL_ROWS;
		const seats: ParlSeat[] = [];
		for (let i = 0; i < rows.length; i++) {
			const cap = rows[i];
			const r = rInner + (i * (rOuter - rInner)) / (rows.length - 1);
			for (let j = 0; j < cap; j++) {
				const t = cap === 1 ? 0.5 : j / (cap - 1);
				const angle = Math.PI - t * Math.PI;
				const x = cx + r * Math.cos(angle);
				const y = cy - r * Math.sin(angle);
				const band: 'l' | 'c' | 'r' = t < 0.36 ? 'l' : t > 0.64 ? 'r' : 'c';
				seats.push({ x, y, band });
			}
		}
		return seats;
	}
	const PARL_SEATS_MODE_SM = buildParlSeats(85, 60, 18, 60);

	// ── Mode card mini-graph data ─────────────────────────────────

	// ── Fallback stats (shown until /api/stats is available) ─────
	const STATS_FALLBACK = [
		{ label: 'Wetsartikelen', note: "Wetten, AMvB's, EU-regelgeving en verdragen", meter: 0.84 },
		{ label: 'Arresten', note: 'Hoge Raad, gerechtshoven, rechtbanken', meter: 0.96 },
		{ label: 'Verbindingen', note: 'Citaat, interpretatie, wijziging, vermelding', meter: 0.78 },
		{ label: 'Bronnen', note: 'Officiële Nederlandse rechtsbronnen', meter: 0.42 }
	];

	// ── Component state ──────────────────────────────────────────
	// Wetboek-tiles en hemicycle leven nu in <VerkenNetwerk />; daarom
	// zit hier alleen nog state voor de stats-sectie en de hero-canvas.
	let graphCanvas: HTMLCanvasElement | null = $state(null);

	// Stats from API — null means not yet loaded or endpoint unavailable
	let liveStats = $state<{
		article_count: number;
		judgment_count: number;
		connection_count: number;
		source_count: number;
		last_updated: string | null;
	} | null>(null);

	// Hero graph hover state — updated by mouse events, drives floating cite card.
	// Initialise to the central node so the cite card is visible on first paint;
	// the first real mouse interaction takes over via onMouseMove / onMouseLeave.
	let focusedId = $state<string | null>('bw6_162');

	// Non-reactive refs shared with canvas rAF loop and mouse handlers
	let hoveredId: string | null = null;
	let currentPositions: Record<string, { x: number; y: number }> = {};

	// Floating cite card — only shown when hovering a labelled node
	const focusedCite = $derived(focusedId ? (CITE_DETAILS[focusedId] ?? null) : null);
	const focusedNode = $derived(
		focusedId ? (HERO_NODES.find((n) => n.id === focusedId) ?? null) : null
	);
	const cardOnLeft = $derived(focusedNode ? focusedNode.x > 0.5 : false);
	const cardLeft = $derived(
		focusedNode
			? cardOnLeft
				? `${focusedNode.x * 100 - 4}%`
				: `${focusedNode.x * 100 + 4}%`
			: '50%'
	);
	const cardTop = $derived(focusedNode ? `${focusedNode.y * 100}%` : '50%');
	const cardTransform = $derived(cardOnLeft ? 'translate(-100%, -50%)' : 'translate(0, -50%)');

	// Stats display values — live API data or fallback placeholders
	const statsRows = $derived([
		{
			num: liveStats ? fmtNum(liveStats.article_count) : '—',
			label: STATS_FALLBACK[0].label,
			note: STATS_FALLBACK[0].note,
			meter: liveStats ? Math.min(1, liveStats.article_count / 175_000) : STATS_FALLBACK[0].meter
		},
		{
			num: liveStats ? fmtNum(liveStats.judgment_count) : '—',
			label: STATS_FALLBACK[1].label,
			note: STATS_FALLBACK[1].note,
			meter: liveStats ? Math.min(1, liveStats.judgment_count / 430_000) : STATS_FALLBACK[1].meter
		},
		{
			num: liveStats ? fmtNum(liveStats.connection_count) : '—',
			label: STATS_FALLBACK[2].label,
			note: STATS_FALLBACK[2].note,
			meter: liveStats
				? Math.min(1, liveStats.connection_count / 2_300_000)
				: STATS_FALLBACK[2].meter
		},
		{
			num: liveStats ? String(liveStats.source_count) : '—',
			label: STATS_FALLBACK[3].label,
			note: STATS_FALLBACK[3].note,
			meter: liveStats ? Math.min(1, liveStats.source_count / 55) : STATS_FALLBACK[3].meter
		}
	]);

	const lastUpdatedLabel = $derived(
		liveStats?.last_updated ? `Laatst bijgewerkt ${fmtDate(liveStats.last_updated)}.` : ''
	);

	function fmtNum(n: number): string {
		if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} mln`;
		return new Intl.NumberFormat('nl-NL').format(n);
	}

	function fmtDate(iso: string): string {
		try {
			return (
				new Intl.DateTimeFormat('nl-NL', {
					day: 'numeric',
					month: 'long',
					year: 'numeric',
					hour: '2-digit',
					minute: '2-digit',
					timeZone: 'Europe/Amsterdam'
				}).format(new Date(iso)) + ' CET'
			);
		} catch {
			return iso;
		}
	}

	let statsTimedOut = $state(false);

	onMount(() => {
		// ── Fetch live corpus stats ──────────────────────────────
		const statsTimeoutId = setTimeout(() => {
			if (!liveStats) statsTimedOut = true;
		}, 4000);
		getCorpusStats().then((data) => {
			clearTimeout(statsTimeoutId);
			if (!data) return;
			liveStats = data.corpus;
		});

		// ── Canvas hero graph ────────────────────────────────────
		if (!graphCanvas) return;

		const canvas = graphCanvas;
		const ctx = canvas.getContext('2d')!;
		const dpr = window.devicePixelRatio || 1;
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		// Resolve CSS variables once (canvas can't use CSS custom properties)
		const root = document.documentElement;
		const cv = (name: string) => getComputedStyle(root).getPropertyValue(name).trim();
		const C = {
			paper: cv('--paper'),
			ink2: cv('--ink-2'),
			ink3: cv('--ink-3'),
			ink4: cv('--ink-4'),
			accent: cv('--accent'),
			indigo: cv('--indigo')
		};

		const EDGE_STYLE: Record<
			string,
			{ stroke: string; dash: number[]; width: number; opacity: number }
		> = {
			cite: { stroke: C.ink3, dash: [], width: 0.7, opacity: 0.55 },
			interpret: { stroke: C.accent, dash: [], width: 1.0, opacity: 0.7 },
			amend: { stroke: C.ink2, dash: [5, 3], width: 0.9, opacity: 0.6 },
			mention: { stroke: C.ink4, dash: [1, 3], width: 0.5, opacity: 0.4 },
			dossier: { stroke: C.accent, dash: [3, 2], width: 0.9, opacity: 0.55 }
		};

		// Size canvas to its CSS layout size
		const sizeCanvas = () => {
			const W = canvas.offsetWidth;
			const H = canvas.offsetHeight;
			canvas.width = W * dpr;
			canvas.height = H * dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};
		sizeCanvas();
		const ro = new ResizeObserver(sizeCanvas);
		ro.observe(canvas);

		let raf = 0;
		const start = performance.now();

		// Mouse hit-testing: find nearest major node within 40px
		const HIT_RADIUS = 40;
		function findNearestNode(mx: number, my: number): string | null {
			let best: string | null = null;
			let bestDist = HIT_RADIUS;
			for (const id in currentPositions) {
				const p = currentPositions[id];
				const d = Math.hypot(p.x - mx, p.y - my);
				if (d < bestDist) {
					bestDist = d;
					best = id;
				}
			}
			return best;
		}

		// Klikken opent altijd dezelfde demo-bestemming. De hover-aura en
		// floating-cite kaart blijven illustreren welke verbinding waarheen
		// loopt; de canvas zelf is geen navigatie maar een uitnodiging tot
		// het openen van de Verkenner.
		const HERO_DEMO_FOCUS = 'instrument_articles/bwbr0005289_162';

		function onMouseMove(e: MouseEvent) {
			const rect = canvas.getBoundingClientRect();
			const mx = e.clientX - rect.left;
			const my = e.clientY - rect.top;
			const found = findNearestNode(mx, my);
			if (found !== hoveredId) {
				hoveredId = found;
				focusedId = found;
			}
		}

		function onMouseLeave() {
			hoveredId = null;
			focusedId = null;
		}

		function onClick() {
			track('enter_explorer', { path: 'hero_graph' });
			goto(`/explore?focus=${encodeURIComponent(HERO_DEMO_FOCUS)}&from=hero_graph`);
		}

		canvas.style.cursor = 'pointer';
		canvas.addEventListener('mousemove', onMouseMove);
		canvas.addEventListener('mouseleave', onMouseLeave);
		canvas.addEventListener('click', onClick);

		const draw = (now: number) => {
			const t = reducedMotion ? 0 : (now - start) / 1000;
			const W = canvas.offsetWidth;
			const H = canvas.offsetHeight;

			ctx.clearRect(0, 0, W, H);

			const focId = hoveredId;
			const hasHover = focId !== null;

			// Compute drifted positions and store in shared ref for hit-testing
			HERO_NODES.forEach((n, i) => {
				const phase = i * 0.7;
				currentPositions[n.id] = {
					x: (n.x + Math.sin(t * 0.18 + phase) * 0.008) * W,
					y: (n.y + Math.cos(t * 0.22 + phase * 1.3) * 0.008) * H
				};
			});

			const fp = focId ? currentPositions[focId] : null;

			// Aura glow under hovered node
			if (fp) {
				const g = ctx.createRadialGradient(fp.x, fp.y, 0, fp.x, fp.y, 70);
				g.addColorStop(0, C.accent + '2E');
				g.addColorStop(0.6, C.accent + '00');
				ctx.fillStyle = g;
				ctx.beginPath();
				ctx.arc(fp.x, fp.y, 70, 0, Math.PI * 2);
				ctx.fill();
			}

			// Connected node IDs when something is hovered
			const connectedIds = new Set<string>();
			if (focId) {
				connectedIds.add(focId);
				HERO_EDGES.forEach(([a, b]) => {
					if (a === focId) connectedIds.add(b);
					if (b === focId) connectedIds.add(a);
				});
			}

			// Edges
			ctx.save();
			HERO_EDGES.forEach(([a, b, kind]) => {
				const pa = currentPositions[a],
					pb = currentPositions[b];
				if (!pa || !pb) return;
				const isFocused = focId && (a === focId || b === focId);
				const isDimmed = hasHover && !isFocused;
				const es = EDGE_STYLE[kind] ?? EDGE_STYLE.cite;
				ctx.beginPath();
				ctx.moveTo(pa.x, pa.y);
				ctx.lineTo(pb.x, pb.y);
				ctx.strokeStyle = isFocused && kind === 'interpret' ? C.accent : es.stroke;
				ctx.lineWidth = isFocused ? es.width + 0.4 : es.width;
				ctx.globalAlpha = isDimmed
					? es.opacity * 0.2
					: isFocused
						? Math.min(1, es.opacity + 0.3)
						: es.opacity;
				ctx.setLineDash(es.dash);
				ctx.stroke();
			});
			ctx.restore();

			// Nodes + labels
			ctx.save();
			ctx.setLineDash([]);
			// Intro pulse on bw6_162 for first 2.5 s — signals the graph is interactive.
			// Skipped onder prefers-reduced-motion: anders blijft de puls eindeloos
			// doorlopen omdat t bevroren is op 0.
			const introPulsing = !reducedMotion && t < 2.5 && !hasHover;
			HERO_NODES.forEach((n) => {
				const p = currentPositions[n.id];
				const isFocused = n.id === focId;
				const isConnected = connectedIds.has(n.id);
				const isDimmed = hasHover && !isConnected;
				const isJudgment = n.kind === 'judgment';
				const isDossier = n.kind === 'dossier';
				const isBw6162 = n.id === 'bw6_162';
				const pulseExtra =
					isBw6162 && introPulsing ? Math.max(0, Math.sin(t * Math.PI * 2.5)) * 3 : 0;
				const r = n.size + (isFocused ? 2.5 : 0) + pulseExtra;

				// Glow ring during intro pulse
				if (isBw6162 && introPulsing && pulseExtra > 0.5) {
					const glowA = Math.max(0, Math.sin(t * Math.PI * 2.5)) * 0.35 * (1 - t / 2.5);
					const hex2 = Math.round(glowA * 255)
						.toString(16)
						.padStart(2, '0');
					const glow = ctx.createRadialGradient(p.x, p.y, r, p.x, p.y, r + 40);
					glow.addColorStop(0, C.accent + hex2);
					glow.addColorStop(1, C.accent + '00');
					ctx.fillStyle = glow;
					ctx.beginPath();
					ctx.arc(p.x, p.y, r + 40, 0, Math.PI * 2);
					ctx.fill();
				}

				ctx.globalAlpha = isDimmed ? 0.18 : 1;

				if (isDossier) {
					// Parliament nodes: diamond shape with accent stroke
					ctx.beginPath();
					ctx.moveTo(p.x, p.y - r);
					ctx.lineTo(p.x + r, p.y);
					ctx.lineTo(p.x, p.y + r);
					ctx.lineTo(p.x - r, p.y);
					ctx.closePath();
					ctx.fillStyle = C.paper;
					ctx.strokeStyle = isFocused ? C.accent : C.accent;
					ctx.lineWidth = isFocused ? 2.2 : 1.3;
					ctx.fill();
					ctx.stroke();
				} else {
					ctx.beginPath();
					ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
					ctx.fillStyle = isJudgment ? C.indigo : C.paper;
					ctx.strokeStyle = isFocused ? C.accent : isJudgment ? C.indigo : C.ink2;
					ctx.lineWidth = isFocused ? 2.2 : 1.2;
					ctx.fill();
					ctx.stroke();
				}

				if (n.label && n.size >= 4) {
					ctx.font = `9.5px "iA Writer Mono", "SF Mono", monospace`;
					ctx.fillStyle = isFocused ? C.accent : isDossier ? C.accent : C.ink3;
					ctx.globalAlpha = isDimmed ? 0.1 : isFocused ? 1 : isDossier ? 0.75 : 0.85;
					ctx.fillText(n.label, p.x + r + 6, p.y + 3.5);
				}
			});
			ctx.restore();

			raf = requestAnimationFrame(draw);
		};

		raf = requestAnimationFrame(draw);

		return () => {
			cancelAnimationFrame(raf);
			canvas.removeEventListener('mousemove', onMouseMove);
			canvas.removeEventListener('mouseleave', onMouseLeave);
			canvas.removeEventListener('click', onClick);
			ro.disconnect();
		};
	});
</script>

<svelte:head>
	<title>Concordans. Het Nederlandse recht als netwerk.</title>
</svelte:head>

<div class="home">
	<!-- ── Hero ──────────────────────────────────────────────────── -->
	<section class="hero" id="home">
		<div class="container hero-inner">
			<div class="hero-text">
				<h1 class="hero-title">
					Het Nederlandse recht <em>als&nbsp;netwerk.</em>
				</h1>
				<p class="hero-lede">
					Een werkomgeving die wetsartikelen, arresten, wetgevingsdossiers en parlementaire
					documenten als één netwerk toont. Gebouwd op de officiële bronnen, met de verbindingen die
					in een document-per-pagina onzichtbaar blijven.
				</p>
				<p class="hero-promise">
					Geen verband wordt geïnterpreteerd of geparafraseerd. Concordans toont alleen wat de bron
					zelf zegt.
				</p>

				<div class="hero-cta">
					<a
						class="hero-cta__primary no-underline"
						href="/explore?focus=instruments%2FBWBR0005289&from=hero"
						onclick={() => track('enter_explorer', { path: 'hero_primary' })}
					>
						Open de Verkenner
						<span class="hero-cta__arrow" aria-hidden="true">→</span>
					</a>
					<a class="hero-cta__secondary no-underline" href="/docs/methode"> Lees de methode </a>
					<a class="hero-cta__feedback no-underline" href="/contact"> Geef feedback </a>
				</div>
			</div>

			<!-- Canvas-based animated graph -->
			<div class="hero-graph">
				<canvas
					bind:this={graphCanvas}
					role="img"
					aria-label="Voorbeeldnetwerk rond artikel BW 6:162 (Onrechtmatige daad), met de arresten, dossiers en artikelen die ermee verbonden zijn."
				></canvas>

				{#if focusedCite}
					<div
						class="floating-cite"
						class:floating-cite--left={cardOnLeft}
						class:floating-cite--right={!cardOnLeft}
						style:left={cardLeft}
						style:top={cardTop}
						style:transform={cardTransform}
					>
						<div class="floating-cite__kind">{focusedCite.kind}</div>
						<div class="floating-cite__title">{focusedCite.title}</div>
						<div class="floating-cite__sub">{focusedCite.sub}</div>
					</div>
				{/if}

				<div class="graph-legend">
					<span class="legend-row"><span class="legend-dot legend-dot--article"></span>Artikel</span
					>
					<span class="legend-row"><span class="legend-dot legend-dot--judgment"></span>Arrest</span
					>
					<span class="legend-row"><span class="legend-dot legend-dot--dossier"></span>Dossier</span
					>
				</div>
				<p class="graph-click-hint" aria-hidden="true">Klik op een bron</p>
			</div>
		</div>
	</section>

	<!-- ── Hoe het werkt ─────────────────────────────────────────── -->
	<section class="block" id="hoe">
		<div class="container">
			<div class="section-head">
				<div class="section-eyebrow">Hoe het werkt</div>
				<div>
					<h2 class="section-title">Vier weergaven van hetzelfde netwerk</h2>
					<p class="section-lede">
						Eén netwerk, vier manieren van kijken. Elke weergave werkt op dezelfde bronnen en
						verbindingen; alleen de presentatie verandert.
					</p>
				</div>
			</div>

			<div class="modes">
				<a
					class="mode-col no-underline"
					href="/explore?focus=instrument_articles%2Fbwbr0005289_162"
				>
					<div class="mode">
						<div class="mode-head">
							<span class="mode-kind">Verkennen</span>
							<h3 class="mode-name">Ontdekken</h3>
						</div>
						<p class="mode-desc">
							Alle bronnen als één netwerk. Klik op een bron als beginpunt. Verbindingen tonen
							citaten, interpretatie en wijziging.
						</p>
						<div class="mode-canvas">
							<svg
								viewBox="0 0 760 420"
								width="100%"
								height="100%"
								preserveAspectRatio="xMidYMid meet"
								role="img"
								aria-label="Schermafbeelding van Ontdekken-modus: zijbalk met lagen, canvas met netwerk en focus op één bron."
							>
								<rect
									x="0"
									y="0"
									width="760"
									height="420"
									fill="var(--paper-2)"
									stroke="var(--rule)"
								/>

								<!-- SIDEBAR -->
								<rect
									x="0"
									y="0"
									width="170"
									height="420"
									fill="var(--paper)"
									stroke="var(--rule)"
								/>
								<text
									x="14"
									y="22"
									font-family="var(--font-sans)"
									font-size="10"
									font-weight="600"
									letter-spacing="0.12em"
									fill="var(--ink-3)">LAGEN</text
								>
								<g font-family="var(--font-sans)" font-size="10.5">
									<rect x="14" y="30" width="142" height="20" rx="2" fill="var(--ink)" />
									<text x="22" y="44" fill="var(--paper)">§ Wetten</text>
									<text x="150" y="44" fill="var(--paper-3)" text-anchor="end">1067</text>
									<rect x="14" y="52" width="142" height="20" rx="2" fill="var(--ink)" />
									<text x="22" y="66" fill="var(--paper)">ℐ Arresten</text>
									<text x="150" y="66" fill="var(--paper-3)" text-anchor="end">1059</text>
									<rect x="14" y="74" width="142" height="20" rx="2" fill="var(--ink)" />
									<text x="22" y="88" fill="var(--paper)">ƒ Dossiers</text>
									<text x="150" y="88" fill="var(--paper-3)" text-anchor="end">10</text>
									<rect
										x="14"
										y="96"
										width="142"
										height="20"
										rx="2"
										fill="var(--paper)"
										stroke="var(--rule)"
									/>
									<text x="22" y="110" fill="var(--ink-3)">‡ Commissies</text>
									<text x="150" y="110" fill="var(--ink-4)" text-anchor="end">0</text>
								</g>
								<text
									x="14"
									y="142"
									font-family="var(--font-sans)"
									font-size="10"
									font-weight="600"
									letter-spacing="0.12em"
									fill="var(--ink-3)">RELATIES</text
								>
								<rect
									x="14"
									y="150"
									width="142"
									height="34"
									fill="var(--paper-2)"
									stroke="var(--rule)"
									stroke-dasharray="2 2"
								/>
								<text
									x="14"
									y="206"
									font-family="var(--font-sans)"
									font-size="10"
									font-weight="600"
									letter-spacing="0.12em"
									fill="var(--ink-3)">OVERLAYS</text
								>
								<g font-family="var(--font-sans)" font-size="10">
									<rect x="14" y="214" width="44" height="20" rx="2" fill="var(--ink)" />
									<text x="36" y="228" fill="var(--paper)" text-anchor="middle">Geen</text>
									<rect
										x="60"
										y="214"
										width="46"
										height="20"
										rx="2"
										fill="var(--paper)"
										stroke="var(--rule)"
									/>
									<text x="83" y="228" fill="var(--ink-2)" text-anchor="middle">Mutatie</text>
								</g>
								<text
									x="14"
									y="262"
									font-family="var(--font-sans)"
									font-size="10"
									font-weight="600"
									letter-spacing="0.12em"
									fill="var(--ink-3)">PARLEMENT</text
								>
								<g transform="translate(0 270)">
									{#each PARL_SEATS_MODE_SM as s (s.x + ':' + s.y)}
										<circle
											cx={s.x}
											cy={s.y}
											r="1.6"
											fill={s.band === 'l'
												? 'var(--moss, #5b7f4a)'
												: s.band === 'r'
													? 'var(--spine, #7a1f1a)'
													: 'var(--indigo)'}
										/>
									{/each}
								</g>
								<text
									x="85"
									y="346"
									font-family="var(--font-sans)"
									font-size="9"
									fill="var(--ink-4)"
									text-anchor="middle">150 zetels</text
								>
								<g font-family="var(--font-sans)" font-size="9.5" fill="var(--ink-2)">
									<text x="14" y="368">→ Dossiers</text>
									<text x="14" y="384">→ Kamerleden</text>
									<text x="14" y="400">→ Stemmingen</text>
								</g>

								<!-- CANVAS -->
								<g transform="translate(170 0)">
									<g stroke="var(--ink-4)" stroke-width="0.7" opacity="0.55">
										<line x1="120" y1="100" x2="290" y2="220" />
										<line x1="200" y1="60" x2="290" y2="220" />
										<line x1="80" y1="180" x2="290" y2="220" />
										<line x1="290" y1="220" x2="160" y2="320" />
										<line x1="290" y1="220" x2="260" y2="370" />
										<line x1="290" y1="220" x2="440" y2="340" />
										<line x1="290" y1="220" x2="500" y2="280" />
										<line x1="290" y1="220" x2="520" y2="160" />
										<line x1="80" y1="180" x2="160" y2="320" />
									</g>
									<line
										x1="290"
										y1="220"
										x2="120"
										y2="100"
										stroke="var(--accent)"
										stroke-width="1.2"
									/>
									<line
										x1="290"
										y1="220"
										x2="260"
										y2="370"
										stroke="var(--accent)"
										stroke-width="1.1"
										stroke-dasharray="4 3"
									/>
									<g fill="var(--paper)" stroke="var(--ink-3)" stroke-width="1.2">
										<circle cx="120" cy="100" r="7" />
										<circle cx="200" cy="60" r="5" />
										<circle cx="80" cy="180" r="5" />
										<circle cx="160" cy="320" r="6" />
										<circle cx="260" cy="370" r="6" />
										<circle cx="440" cy="340" r="6" />
										<circle cx="500" cy="280" r="6" />
										<circle cx="520" cy="160" r="6" />
									</g>
									<!-- Indigo arresten -->
									<circle cx="120" cy="100" r="7" fill="var(--indigo)" stroke="var(--indigo)" />
									<circle cx="520" cy="160" r="6" fill="var(--indigo)" stroke="var(--indigo)" />
									<!-- Focused central node with halo -->
									<circle
										cx="290"
										cy="220"
										r="28"
										fill="none"
										stroke="var(--ink)"
										stroke-width="1.4"
										opacity="0.22"
									/>
									<circle
										cx="290"
										cy="220"
										r="16"
										fill="none"
										stroke="var(--ink)"
										stroke-width="1.6"
										opacity="0.4"
									/>
									<circle cx="290" cy="220" r="13" fill="var(--ink)" />
									<text
										x="312"
										y="226"
										font-family="var(--font-mono)"
										font-size="11"
										fill="var(--ink-2)">BW 6:162</text
									>
								</g>
							</svg>
						</div>
					</div>
					<span class="mode-cta"
						>Probeer <span class="mode-cta__arrow" aria-hidden="true">→</span></span
					>
				</a>

				<a class="mode-col no-underline" href="/explore?mode=split&focus=instruments%2FBWBR0001854">
					<div class="mode">
						<div class="mode-head">
							<span class="mode-kind">Verkennen + lezen</span>
							<h3 class="mode-name">Verdiepen</h3>
						</div>
						<p class="mode-desc">
							Netwerk naast de leestekst. De gefocuste bron in het netwerk verschijnt als volledig
							document ernaast.
						</p>
						<div class="mode-canvas">
							<svg
								viewBox="0 0 760 420"
								width="100%"
								height="100%"
								preserveAspectRatio="xMidYMid meet"
								role="img"
								aria-label="Schermafbeelding van Verdiepen-modus: compact netwerk links, leespaneel in het midden, citeer-rail rechts."
							>
								<rect
									x="0"
									y="0"
									width="760"
									height="420"
									fill="var(--paper-2)"
									stroke="var(--rule)"
								/>

								<!-- LEFT: compact canvas -->
								<rect
									x="0"
									y="0"
									width="170"
									height="420"
									fill="var(--paper-2)"
									stroke="var(--rule)"
								/>
								<rect
									x="10"
									y="10"
									width="56"
									height="18"
									rx="2"
									fill="var(--paper)"
									stroke="var(--rule)"
								/>
								<text
									x="38"
									y="22"
									font-family="var(--font-sans)"
									font-size="10"
									fill="var(--ink-3)"
									text-anchor="middle">⊟ Filters</text
								>
								<g stroke="var(--ink-4)" stroke-width="0.7" opacity="0.55">
									<line x1="50" y1="160" x2="95" y2="240" />
									<line x1="70" y1="110" x2="95" y2="240" />
									<line x1="35" y1="210" x2="95" y2="240" />
									<line x1="95" y1="240" x2="55" y2="340" />
									<line x1="95" y1="240" x2="140" y2="330" />
									<line x1="95" y1="240" x2="150" y2="200" />
									<line x1="95" y1="240" x2="155" y2="140" />
								</g>
								<line x1="95" y1="240" x2="50" y2="160" stroke="var(--accent)" stroke-width="1.2" />
								<line
									x1="95"
									y1="240"
									x2="140"
									y2="330"
									stroke="var(--accent)"
									stroke-width="1.1"
									stroke-dasharray="4 3"
								/>
								<g fill="var(--paper)" stroke="var(--ink-3)" stroke-width="1.2">
									<circle cx="50" cy="160" r="5" />
									<circle cx="70" cy="110" r="4" />
									<circle cx="35" cy="210" r="4" />
									<circle cx="55" cy="340" r="5" />
									<circle cx="140" cy="330" r="5" />
									<circle cx="150" cy="200" r="5" />
									<circle cx="155" cy="140" r="4" />
								</g>
								<circle cx="50" cy="160" r="5" fill="var(--indigo)" stroke="var(--indigo)" />
								<circle cx="155" cy="140" r="4" fill="var(--indigo)" stroke="var(--indigo)" />
								<circle
									cx="95"
									cy="240"
									r="20"
									fill="none"
									stroke="var(--ink)"
									stroke-width="1.3"
									opacity="0.25"
								/>
								<circle
									cx="95"
									cy="240"
									r="11"
									fill="none"
									stroke="var(--ink)"
									stroke-width="1.5"
									opacity="0.4"
								/>
								<circle cx="95" cy="240" r="9" fill="var(--ink)" />

								<!-- MIDDLE: reader -->
								<rect
									x="170"
									y="0"
									width="420"
									height="420"
									fill="var(--paper)"
									stroke="var(--rule)"
								/>
								<text
									x="194"
									y="30"
									font-family="var(--font-sans)"
									font-size="9"
									letter-spacing="0.16em"
									fill="var(--ink-3)">§ ARTIKEL · BURGERLIJK WETBOEK</text
								>
								<rect
									x="540"
									y="18"
									width="18"
									height="18"
									rx="2"
									fill="var(--paper-2)"
									stroke="var(--rule)"
								/>
								<text
									x="549"
									y="31"
									font-family="var(--font-sans)"
									font-size="10"
									fill="var(--ink-3)"
									text-anchor="middle">★</text
								>
								<text
									x="194"
									y="68"
									font-family="var(--font-serif)"
									font-size="22"
									font-weight="500"
									fill="var(--ink)">Onrechtmatige daad</text
								>
								<text
									x="194"
									y="88"
									font-family="var(--font-mono)"
									font-size="11"
									fill="var(--ink-3)">BW 6:162</text
								>
								<line
									x1="194"
									y1="104"
									x2="566"
									y2="104"
									stroke="var(--rule-strong)"
									stroke-width="0.7"
								/>
								<g stroke="var(--ink-3)" stroke-width="0.6">
									{#each [120, 132, 144, 156, 168, 180, 192, 204, 216, 228, 240, 252, 264, 276, 288] as y, i (i)}
										<line
											x1="194"
											y1={y}
											x2={i === 4 ? 500 : i === 9 ? 470 : i === 14 ? 530 : 566}
											y2={y}
										/>
									{/each}
								</g>
								<rect
									x="194"
									y="306"
									width="372"
									height="24"
									fill="var(--paper-2)"
									stroke="var(--rule)"
								/>
								<text
									x="204"
									y="322"
									font-family="var(--font-sans)"
									font-size="11"
									fill="var(--ink-2)">Toelichting (MvT)</text
								>
								<text
									x="558"
									y="322"
									font-family="var(--font-sans)"
									font-size="12"
									fill="var(--ink-3)"
									text-anchor="end">›</text
								>
								<rect
									x="194"
									y="334"
									width="372"
									height="24"
									fill="var(--paper-2)"
									stroke="var(--rule)"
								/>
								<text
									x="204"
									y="350"
									font-family="var(--font-sans)"
									font-size="9"
									letter-spacing="0.14em"
									fill="var(--ink-3)">WETGEVINGSGESCHIEDENIS</text
								>
								<text
									x="558"
									y="350"
									font-family="var(--font-sans)"
									font-size="12"
									fill="var(--ink-3)"
									text-anchor="end">›</text
								>

								<!-- RIGHT: citation rail -->
								<rect
									x="590"
									y="0"
									width="170"
									height="420"
									fill="var(--paper)"
									stroke="var(--rule)"
								/>
								<text
									x="604"
									y="30"
									font-family="var(--font-sans)"
									font-size="10"
									letter-spacing="0.14em"
									fill="var(--ink-3)">VERWIJST NAAR</text
								>
								<text
									x="746"
									y="30"
									font-family="var(--font-sans)"
									font-size="10"
									fill="var(--ink-2)"
									text-anchor="end">12</text
								>
								<g font-family="var(--font-serif)" font-size="11" fill="var(--ink-2)">
									<text x="608" y="56">§ Art. 6:74</text>
									<text x="608" y="74">§ Art. 6:98</text>
									<text x="608" y="92">§ Art. 6:101</text>
									<text x="608" y="110">§ Art. 6:163</text>
								</g>
								<line x1="604" y1="128" x2="746" y2="128" stroke="var(--rule)" />
								<text
									x="604"
									y="148"
									font-family="var(--font-sans)"
									font-size="10"
									letter-spacing="0.14em"
									fill="var(--ink-3)">UITGELEGD DOOR</text
								>
								<text
									x="746"
									y="148"
									font-family="var(--font-sans)"
									font-size="10"
									fill="var(--ink-2)"
									text-anchor="end">5</text
								>
								<g font-family="var(--font-serif)" font-size="11" fill="var(--indigo)">
									<text x="608" y="172">ℐ HR 2019:1234</text>
									<text x="608" y="190">ℐ HR 2016:743</text>
									<text x="608" y="208">ℐ HR 2005:881</text>
								</g>
								<line x1="604" y1="232" x2="746" y2="232" stroke="var(--rule)" />
								<text
									x="604"
									y="252"
									font-family="var(--font-sans)"
									font-size="10"
									letter-spacing="0.14em"
									fill="var(--ink-3)">CITEER DIT</text
								>
								<g font-family="var(--font-sans)" font-size="10" fill="var(--ink-2)">
									<rect
										x="604"
										y="262"
										width="142"
										height="22"
										fill="var(--paper-2)"
										stroke="var(--rule)"
									/>
									<text x="612" y="276">verkort</text>
									<rect
										x="604"
										y="286"
										width="142"
										height="22"
										fill="var(--paper-2)"
										stroke="var(--rule)"
									/>
									<text x="612" y="300">volledig</text>
									<rect
										x="604"
										y="310"
										width="142"
										height="22"
										fill="var(--paper-2)"
										stroke="var(--rule)"
									/>
									<text x="612" y="324">vindplaats</text>
									<rect
										x="604"
										y="334"
										width="142"
										height="22"
										fill="var(--paper-2)"
										stroke="var(--rule)"
									/>
									<text x="612" y="348">bibtex</text>
								</g>
							</svg>
						</div>
					</div>
					<span class="mode-cta"
						>Probeer <span class="mode-cta__arrow" aria-hidden="true">→</span></span
					>
				</a>

				<a class="mode-col no-underline" href="/explore?mode=read&focus=instruments%2FBWBR0001840">
					<div class="mode">
						<div class="mode-head">
							<span class="mode-kind">Lezen</span>
							<h3 class="mode-name">Lezen</h3>
						</div>
						<p class="mode-desc">
							Eén document, gezet in EB Garamond op zesenzestig tekens, met citaten in de marge.
						</p>
						<div class="mode-canvas">
							<svg
								viewBox="0 0 760 420"
								width="100%"
								height="100%"
								preserveAspectRatio="xMidYMid meet"
								role="img"
								aria-label="Schermafbeelding van Lezen-modus: één wettekst in EB Garamond, met citaten in de rechtermarge."
							>
								<rect x="0" y="0" width="760" height="420" fill="var(--paper)" />

								<!-- Lid markers in left margin -->
								<text
									x="120"
									y="120"
									font-family="var(--font-sans)"
									font-size="9"
									letter-spacing="0.18em"
									fill="var(--ink-4)"
									text-anchor="end">LID 1</text
								>
								<text
									x="120"
									y="232"
									font-family="var(--font-sans)"
									font-size="9"
									letter-spacing="0.18em"
									fill="var(--ink-4)"
									text-anchor="end">LID 2</text
								>
								<text
									x="120"
									y="320"
									font-family="var(--font-sans)"
									font-size="9"
									letter-spacing="0.18em"
									fill="var(--ink-4)"
									text-anchor="end">LID 3</text
								>

								<!-- Article header -->
								<text
									x="150"
									y="50"
									font-family="var(--font-serif)"
									font-size="14"
									font-style="italic"
									fill="var(--accent)">§</text
								>
								<text
									x="172"
									y="48"
									font-family="var(--font-sans)"
									font-size="10"
									letter-spacing="0.16em"
									fill="var(--ink-3)">ARTIKEL · BURGERLIJK WETBOEK</text
								>
								<text
									x="150"
									y="84"
									font-family="var(--font-serif)"
									font-size="26"
									font-weight="500"
									fill="var(--ink)">Onrechtmatige daad</text
								>
								<text
									x="150"
									y="104"
									font-family="var(--font-mono)"
									font-size="11"
									fill="var(--ink-3)">BW 6:162 · geldig 1 jan 2026</text
								>
								<line
									x1="150"
									y1="118"
									x2="540"
									y2="118"
									stroke="var(--rule-strong)"
									stroke-width="0.8"
								/>

								<!-- Body lines (66ch column at ~410px wide) -->
								<g stroke="var(--ink-3)" stroke-width="3" opacity="0.18">
									<line x1="150" y1="138" x2="540" y2="138" />
									<line x1="150" y1="152" x2="528" y2="152" />
									<line x1="150" y1="166" x2="540" y2="166" />
									<line x1="150" y1="180" x2="490" y2="180" />

									<line x1="150" y1="208" x2="540" y2="208" />
									<line x1="150" y1="222" x2="540" y2="222" />
									<line x1="150" y1="236" x2="510" y2="236" />
									<line x1="150" y1="250" x2="540" y2="250" />
									<line x1="150" y1="264" x2="450" y2="264" />

									<line x1="150" y1="292" x2="540" y2="292" />
									<line x1="150" y1="306" x2="540" y2="306" />
									<line x1="150" y1="320" x2="520" y2="320" />
									<line x1="150" y1="334" x2="540" y2="334" />
									<line x1="150" y1="348" x2="480" y2="348" />
								</g>

								<!-- Margin citation markers (right rail) -->
								<g>
									<circle cx="580" cy="152" r="3.2" fill="var(--accent)" />
									<text
										x="592"
										y="155"
										font-family="var(--font-sans)"
										font-size="9"
										fill="var(--ink-3)">HR 2019:1234</text
									>
									<text
										x="592"
										y="167"
										font-family="var(--font-sans)"
										font-size="9"
										fill="var(--ink-4)">aansprakelijkheid</text
									>

									<circle cx="580" cy="222" r="3.2" fill="var(--indigo)" />
									<text
										x="592"
										y="225"
										font-family="var(--font-sans)"
										font-size="9"
										fill="var(--ink-3)">HR 2016:743</text
									>
									<text
										x="592"
										y="237"
										font-family="var(--font-sans)"
										font-size="9"
										fill="var(--ink-4)">bewijslast</text
									>

									<circle cx="580" cy="306" r="3.2" fill="var(--ink-3)" />
									<text
										x="592"
										y="309"
										font-family="var(--font-sans)"
										font-size="9"
										fill="var(--ink-3)">§ Art. 6:163</text
									>
									<text
										x="592"
										y="321"
										font-family="var(--font-sans)"
										font-size="9"
										fill="var(--ink-4)">relativiteit</text
									>
								</g>

								<!-- Bottom: page status -->
								<line x1="150" y1="380" x2="540" y2="380" stroke="var(--rule)" />
								<text
									x="150"
									y="398"
									font-family="var(--font-sans)"
									font-size="9.5"
									fill="var(--ink-3)">↶ Vorig artikel</text
								>
								<text
									x="540"
									y="398"
									font-family="var(--font-sans)"
									font-size="9.5"
									fill="var(--ink-3)"
									text-anchor="end">Volgend artikel ↷</text
								>
							</svg>
						</div>
					</div>
					<span class="mode-cta"
						>Probeer <span class="mode-cta__arrow" aria-hidden="true">→</span></span
					>
				</a>

				<a class="mode-col no-underline" href="/explore?mode=index&kind=dossiers">
					<div class="mode">
						<div class="mode-head">
							<span class="mode-kind">Bladeren</span>
							<h3 class="mode-name">Index</h3>
						</div>
						<p class="mode-desc">
							Tabellarisch overzicht van een categorie: dossiers, commissies, kamerleden of
							stemmingen. Filteren en sorteren zonder het netwerk.
						</p>
						<div class="mode-canvas">
							<svg
								viewBox="0 0 760 420"
								width="100%"
								height="100%"
								preserveAspectRatio="xMidYMid meet"
								role="img"
								aria-label="Schermafbeelding van Index-modus: tabellarisch overzicht van wetgevingsdossiers met filters."
							>
								<rect x="0" y="0" width="760" height="420" fill="var(--paper)" />

								<!-- Toolbar with category chips + sort -->
								<rect
									x="0"
									y="0"
									width="760"
									height="46"
									fill="var(--paper-2)"
									stroke="var(--rule)"
								/>
								<g font-family="var(--font-sans)" font-size="11">
									<rect x="20" y="13" width="80" height="22" rx="2" fill="var(--ink)" />
									<text x="60" y="28" fill="var(--paper)" text-anchor="middle">Dossiers</text>
									<rect
										x="106"
										y="13"
										width="86"
										height="22"
										rx="2"
										fill="var(--paper)"
										stroke="var(--rule)"
									/>
									<text x="149" y="28" fill="var(--ink-2)" text-anchor="middle">Commissies</text>
									<rect
										x="198"
										y="13"
										width="80"
										height="22"
										rx="2"
										fill="var(--paper)"
										stroke="var(--rule)"
									/>
									<text x="238" y="28" fill="var(--ink-2)" text-anchor="middle">Kamerleden</text>
									<rect
										x="284"
										y="13"
										width="84"
										height="22"
										rx="2"
										fill="var(--paper)"
										stroke="var(--rule)"
									/>
									<text x="326" y="28" fill="var(--ink-2)" text-anchor="middle">Stemmingen</text>
								</g>
								<text
									x="724"
									y="28"
									font-family="var(--font-sans)"
									font-size="11"
									fill="var(--ink-3)"
									text-anchor="end">8 van 247 ↓</text
								>

								<!-- Column headers -->
								<text
									x="32"
									y="74"
									font-family="var(--font-sans)"
									font-size="10"
									letter-spacing="0.16em"
									fill="var(--ink-3)">DOSSIER</text
								>
								<text
									x="316"
									y="74"
									font-family="var(--font-sans)"
									font-size="10"
									letter-spacing="0.16em"
									fill="var(--ink-3)">FASE</text
								>
								<text
									x="500"
									y="74"
									font-family="var(--font-sans)"
									font-size="10"
									letter-spacing="0.16em"
									fill="var(--ink-3)">ARTIKELEN</text
								>
								<text
									x="640"
									y="74"
									font-family="var(--font-sans)"
									font-size="10"
									letter-spacing="0.16em"
									fill="var(--ink-3)">LAATSTE WIJZIGING</text
								>
								<line
									x1="20"
									y1="84"
									x2="740"
									y2="84"
									stroke="var(--rule-strong)"
									stroke-width="0.8"
								/>

								{#each [{ nr: '36 586', label: 'Aanpassing aansprakelijkheidsrecht', fase: 'behandeling', art: 12, date: '2026-04-12' }, { nr: '36 612', label: 'Wijziging Wet open overheid', fase: 'behandeling', art: 7, date: '2026-04-08' }, { nr: '36 503', label: 'Modernisering BW boek 6', fase: 'aangenomen', art: 21, date: '2026-03-29', highlight: true }, { nr: '36 644', label: 'Tweede Kamerwet aanpassing', fase: 'ingediend', art: 3, date: '2026-03-15' }, { nr: '36 422', label: 'Strafrecht digitale opsporing', fase: 'aangenomen', art: 9, date: '2026-03-04' }, { nr: '36 679', label: 'Belastingplan 2026', fase: 'ingediend', art: 14, date: '2026-02-22' }, { nr: '36 488', label: 'Wijziging Awb hoofdstuk 8', fase: 'behandeling', art: 5, date: '2026-02-14' }, { nr: '36 391', label: 'Implementatie EU verordening 2024/918', fase: 'aangenomen', art: 18, date: '2026-01-30' }] as row, i (row.nr)}
									{@const y = 110 + i * 36}
									{#if row.highlight}
										<rect x="20" y={y - 18} width="720" height="32" fill="var(--paper-2)" />
									{/if}
									<text x="32" {y} font-family="var(--font-mono)" font-size="11" fill="var(--ink-2)"
										>{row.nr}</text
									>
									<text
										x="100"
										{y}
										font-family="var(--font-serif)"
										font-size="12.5"
										fill="var(--ink)">{row.label}</text
									>
									<g transform={`translate(316 ${y - 12})`}>
										<rect
											x="0"
											y="0"
											width="92"
											height="20"
											rx="10"
											fill={row.fase === 'aangenomen'
												? 'var(--accent)'
												: row.fase === 'behandeling'
													? 'var(--paper-2)'
													: 'var(--paper)'}
											stroke={row.fase === 'aangenomen' ? 'var(--accent)' : 'var(--rule)'}
										/>
										<text
											x="46"
											y="14"
											font-family="var(--font-sans)"
											font-size="10"
											fill={row.fase === 'aangenomen' ? 'var(--paper)' : 'var(--ink-2)'}
											text-anchor="middle">{row.fase}</text
										>
									</g>
									<text
										x="540"
										{y}
										font-family="var(--font-mono)"
										font-size="11"
										fill="var(--ink-2)"
										text-anchor="end">{row.art}</text
									>
									<text
										x="640"
										{y}
										font-family="var(--font-mono)"
										font-size="11"
										fill="var(--ink-3)">{row.date}</text
									>
									<line
										x1="20"
										y1={y + 14}
										x2="740"
										y2={y + 14}
										stroke="var(--rule)"
										stroke-width="0.5"
									/>
								{/each}
							</svg>
						</div>
					</div>
					<span class="mode-cta"
						>Probeer <span class="mode-cta__arrow" aria-hidden="true">→</span></span
					>
				</a>
			</div>
		</div>
	</section>

	<!-- ── Drie domeinen ──────────────────────────────────────────── -->
	<section class="block" id="domein">
		<div class="container">
			<div class="section-head">
				<div class="section-eyebrow">Vier domeinen</div>
				<div>
					<h2 class="section-title">Wetgeving, rechtspraak, parlement en Europa als één netwerk</h2>
				</div>
			</div>
			<div class="trio">
				<div class="trio-card">
					<div class="trio-head">
						<span class="trio-mark trio-mark--article" aria-hidden="true"></span>
						<span class="trio-name">Wetgeving</span>
					</div>
					<p class="trio-source">wetten.overheid.nl</p>
					<p class="trio-body">
						Wetsartikelen als verbindingspunten. Elk artikel toont de arresten die het uitleggen, de
						dossiers die het wijzigen en de andere artikelen die het aanhaalt. Historische
						toestanden en wijzigingen zichtbaar als verbinding.
					</p>
				</div>
				<div class="trio-card">
					<div class="trio-head">
						<span class="trio-mark trio-mark--judgment" aria-hidden="true"></span>
						<span class="trio-name">Rechtspraak</span>
					</div>
					<p class="trio-source">rechtspraak.nl</p>
					<p class="trio-body">
						Uitspraken van rechtbanken, hoven en de Hoge Raad, verbonden aan de wetsartikelen die
						worden uitgelegd of toegepast. Van Hoge Raad tot rechtbank, geïndexeerd per ECLI.
					</p>
				</div>
				<div class="trio-card">
					<div class="trio-head">
						<span class="trio-mark trio-mark--dossier" aria-hidden="true"></span>
						<span class="trio-name">Parlement</span>
					</div>
					<p class="trio-source">tweedekamer.nl</p>
					<p class="trio-body">
						Wetgevingsdossiers, commissies, kamerleden en stemmingen verbonden aan de artikelen die
						ze betreffen. Parlementaire geschiedenis direct bij de wettekst, niet als zoekresultaat
						maar als verbinding.
					</p>
				</div>
				<div class="trio-card">
					<div class="trio-head">
						<span class="trio-mark trio-mark--europe" aria-hidden="true"></span>
						<span class="trio-name">Europa</span>
					</div>
					<p class="trio-source">eur-lex.europa.eu</p>
					<p class="trio-body">
						Europese richtlijnen en verordeningen, geïndexeerd per CELEX. Aangehaakt aan de
						Nederlandse implementatie via expliciete implementatierelaties, zodat omzetting
						traceerbaar is.
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- ── Verken het netwerk ───────────────────────────────────────── -->
	<!-- Drie ingangen tot het netwerk in één coherente grid. De
	     component leeft als VerkenNetwerk omdat de pyramide- en
	     hemicycle-visualisaties los van de homepage herbruikbaar zijn. -->
	<VerkenNetwerk />

	<!-- ── In cijfers ────────────────────────────────────────────── -->
	<section class="block" id="cijfers">
		<div class="container">
			<div class="section-head">
				<div class="section-eyebrow">In cijfers</div>
				<div>
					<h2 class="section-title">Het cijfer dat nergens anders bestaat</h2>
					<p class="section-lede">
						Wetsartikelen en arresten worden ook door de officiële databases geteld. Het aantal
						verbindingen ertussen alleen hier.
					</p>
				</div>
			</div>

			<!-- Twee context-tellingen bovenaan; verbindingen staan eronder
			     als feature-tile zodat het USP-cijfer visueel de aankomst is,
			     niet een tussenstop. Bronnen-totaal staat in de aparte
			     "Waar het materiaal vandaan komt"-sectie hieronder. -->
			<div class="stats stats--sources">
				{#each [statsRows[0], statsRows[1]] as s, i (i)}
					<div class="stat">
						<div class="stat-label">{s.label}</div>
						<div class="stat-num" class:stat-num--loading={!liveStats}>{s.num}</div>
						<div class="stat-note">{s.note}</div>
					</div>
				{/each}
			</div>

			<div class="stat stat--primary stat--feature">
				<div class="stat-flag">Alleen in Concordans</div>
				<div class="stat-label">{statsRows[2].label}</div>
				<div class="stat-num" class:stat-num--loading={!liveStats}>{statsRows[2].num}</div>
				<div class="stat-note">{statsRows[2].note}</div>
			</div>

			<p class="stats-foot">
				{#if liveStats}
					{#if lastUpdatedLabel}
						<span class="stats-foot__sync">{lastUpdatedLabel}</span>
					{/if}
					Bronnen: <span class="cite-mono">wetten.overheid.nl</span>,
					<span class="cite-mono">rechtspraak.nl</span>,
					<span class="cite-mono">tweedekamer.nl</span> en
					<span class="cite-mono">eur-lex.europa.eu</span>.
				{:else if statsTimedOut}
					<span class="stats-unavail">Statistieken tijdelijk niet beschikbaar.</span>
				{/if}
			</p>
		</div>
	</section>

	<!-- ── Bronnen & methode ──────────────────────────────────────── -->
	<section class="block" id="bronnen">
		<div class="container sources-grid">
			<div class="section-eyebrow">Bronnen &amp; methode</div>
			<div>
				<h2 class="section-title" style="margin-bottom: 32px;">Waar het materiaal vandaan komt</h2>
				<div class="sources-list">
					<div class="source">
						<h3 class="source-name">wetten.overheid.nl</h3>
						<p class="source-url">BWB · XML</p>
						<p class="source-desc">
							De volledige tekst van Nederlandse wet- en regelgeving, opgesplitst per artikel,
							inclusief historische toestanden. Concordans neemt de XML-publicatie ongewijzigd over
							en bouwt daarop het citatennetwerk.
						</p>
					</div>
					<div class="source">
						<h3 class="source-name">rechtspraak.nl</h3>
						<p class="source-url">uitspraken.rechtspraak.nl · ECLI · XML</p>
						<p class="source-desc">
							Uitspraken van rechtbanken, gerechtshoven en de Hoge Raad: volledige tekst,
							samenvatting en metadata. Citaties naar wetsartikelen worden machinaal geëxtraheerd.
						</p>
					</div>
					<div class="source">
						<h3 class="source-name">tweedekamer.nl</h3>
						<p class="source-url">gegevensmagazijn · JSON OData</p>
						<p class="source-desc">
							Dossiers, documenten, debatten, stemmingen, toezeggingen, commissies en Kamerleden.
							Aangehaakt aan het artikel waarop ze betrekking hebben, niet als zoekresultaat maar
							als verbinding.
						</p>
					</div>
					<div class="source">
						<h3 class="source-name">eur-lex.europa.eu</h3>
						<p class="source-url">Europees publicatieblad · CELEX · HTML</p>
						<p class="source-desc">
							Europese richtlijnen en verordeningen die voor de Nederlandse rechtsorde relevant
							zijn, inclusief de implementatierelaties naar de nationale wetgeving.
						</p>
					</div>
					<div class="method-note">
						<p>
							De citatenextractie is open en reproduceerbaar. Geen enkel verband tussen documenten
							wordt geïnterpreteerd of geparafraseerd. Concordans toont alleen wat de bron zelf
							zegt.
						</p>
						<a href="/docs/methode" class="method-cta no-underline">
							Lees de methode-bijlage <span aria-hidden="true">→</span>
						</a>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- ── Footer ────────────────────────────────────────────────── -->
</div>

<style>
	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 32px;
	}

	.block {
		padding: 88px 0;
		border-bottom: 1px solid var(--rule);
	}

	.section-eyebrow {
		font-family: var(--font-sans);
		font-size: 11px;
		font-weight: 400;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--fg-3);
		border-top: 1px solid var(--ink);
		padding-top: 10px;
		align-self: start;
	}

	.section-head {
		display: grid;
		grid-template-columns: 220px 1fr;
		gap: 56px;
		margin-bottom: 48px;
		align-items: start;
	}

	.section-title {
		margin: 0 0 16px;
		font-family: var(--font-serif);
		font-size: 40px;
		font-weight: 500;
		line-height: 1.08;
		letter-spacing: -0.012em;
		color: var(--ink);
	}

	.section-lede {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 19px;
		line-height: 1.6;
		color: var(--ink-2);
		max-width: 58ch;
	}

	/* ── Hero ──────────────────────────────────────────────────── */
	.hero {
		border-bottom: 1px solid var(--rule);
	}

	.hero-inner {
		padding-top: 56px;
		padding-bottom: 56px;
		min-height: 640px;
		display: grid;
		grid-template-columns: minmax(380px, 1fr) minmax(500px, 1.2fr);
		gap: 56px;
		align-items: center;
	}

	.hero-eyebrow {
		font-family: var(--font-sans);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--fg-3);
		margin-bottom: 20px;
	}

	.hero-title {
		margin: 0 0 22px;
		font-family: var(--font-serif);
		font-size: 64px;
		font-weight: 500;
		line-height: 1.04;
		letter-spacing: -0.018em;
		color: var(--ink);
	}

	.hero-title em {
		font-style: italic;
		font-weight: 400;
		color: var(--accent);
	}

	.hero-lede {
		margin: 0 0 28px;
		font-family: var(--font-serif);
		font-size: 20px;
		line-height: 1.5;
		color: var(--ink-2);
		max-width: 38ch;
	}

	.hero-promise {
		margin: 0 0 28px;
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 16px;
		line-height: 1.5;
		color: var(--ink-2);
		max-width: 40ch;
		border-left: 2px solid var(--accent);
		padding-left: 14px;
	}

	.hero-cta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 24px;
		margin: 0 0 24px;
	}

	.hero-cta__primary {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: var(--ink);
		color: var(--paper);
		font-family: var(--font-sans);
		font-size: 14px;
		font-weight: 500;
		letter-spacing: 0.01em;
		padding: 12px 20px;
		border-radius: var(--r-1, 2px);
		transition:
			background var(--dur-1) var(--ease),
			transform var(--dur-1) var(--ease);
	}

	.hero-cta__primary:hover {
		background: var(--accent);
		color: var(--paper);
	}

	.hero-cta__arrow {
		display: inline-block;
		transition: transform var(--dur-1) var(--ease);
	}

	.hero-cta__primary:hover .hero-cta__arrow {
		transform: translateX(3px);
	}

	.hero-cta__secondary {
		font-family: var(--font-sans);
		font-size: 13px;
		color: var(--ink-2);
		border-bottom: 1px solid var(--rule-strong);
		padding-bottom: 1px;
		transition:
			color var(--dur-1) var(--ease),
			border-color var(--dur-1) var(--ease);
	}

	.hero-cta__secondary:hover {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}

	.hero-cta__feedback {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-sans);
		font-size: 13px;
		color: var(--ochre);
		background: var(--ochre-faint);
		border: 1px solid var(--ochre);
		padding: 10px 14px;
		border-radius: var(--r-1, 2px);
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
	}

	.hero-cta__feedback:hover {
		background: var(--ochre);
		color: var(--paper);
	}

	/* Hero graph — canvas fills the box */
	.hero-graph {
		position: relative;
		height: 100%;
		min-height: 480px;
		background: var(--paper-2);
		border-radius: var(--r-2);
		overflow: hidden;
		border: 1px solid var(--rule);
	}

	.hero-graph canvas {
		display: block;
		width: 100%;
		height: 100%;
	}

	.floating-cite {
		position: absolute;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		padding: 10px 13px;
		max-width: 200px;
		pointer-events: none;
		transition:
			left 120ms var(--ease),
			top 120ms var(--ease);
		box-shadow: var(--shadow-pop);
	}

	/* Arrow pointing toward the hovered node */
	.floating-cite::after {
		content: '';
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		border: 5px solid transparent;
	}
	.floating-cite--right::after {
		left: -10px;
		border-right-color: var(--rule-strong);
	}
	.floating-cite--left::after {
		right: -10px;
		border-left-color: var(--rule-strong);
	}

	.floating-cite__kind {
		font-family: var(--font-sans);
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--fg-3);
		margin-bottom: 4px;
	}

	.floating-cite__title {
		font-family: var(--font-serif);
		font-size: 14px;
		font-weight: 500;
		color: var(--ink);
		line-height: 1.3;
		margin-bottom: 4px;
	}

	.floating-cite__sub {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--accent);
	}

	.graph-legend {
		position: absolute;
		bottom: 14px;
		left: 14px;
		display: flex;
		gap: 14px;
		font-family: var(--font-sans);
		font-size: 10px;
		color: var(--fg-3);
	}

	.graph-click-hint {
		position: absolute;
		bottom: 14px;
		left: 50%;
		transform: translateX(-50%);
		margin: 0;
		font-family: var(--font-sans);
		font-size: 11px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-3);
		pointer-events: none;
		white-space: nowrap;
		animation: hint-fade-in 1.2s 0.9s ease both;
	}

	@keyframes hint-fade-in {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}

	.legend-row {
		display: flex;
		align-items: center;
		gap: 5px;
	}

	.legend-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.legend-dot--article {
		background: var(--paper);
		border: 1.2px solid var(--ink-2);
	}
	.legend-dot--judgment {
		background: var(--indigo);
	}
	.legend-dot--dossier {
		background: var(--paper);
		border: 1.2px solid var(--accent);
		border-radius: 0;
		transform: rotate(45deg);
	}

	/* ── About ─────────────────────────────────────────────────── */
	/* ── Drie domeinen ─────────────────────────────────────────── */
	.trio {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 32px;
		border-top: 1px solid var(--rule);
		padding-top: 24px;
	}
	.trio-card {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.trio-head {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin-bottom: 4px;
	}
	/* Domain marks reuse the graph legend shapes so the homepage's visual
	   vocabulary is one piece: article = open ring, judgment = solid dot,
	   dossier = accent diamond. */
	.trio-mark {
		display: inline-block;
		width: 12px;
		height: 12px;
		flex-shrink: 0;
		align-self: center;
	}
	.trio-mark--article {
		background: var(--paper);
		border: 1.6px solid var(--ink-2);
		border-radius: 50%;
	}
	.trio-mark--judgment {
		background: var(--indigo);
		border-radius: 50%;
	}
	.trio-mark--dossier {
		background: var(--paper);
		border: 1.6px solid var(--accent);
		transform: rotate(45deg);
	}
	/* Europa = artikel-vorm (open ring), maar in indigo, om te tonen dat
	   Europese richtlijnen ook artikel-achtige bronnen zijn die de
	   Nederlandse wetgeving raken via implementatierelaties. */
	.trio-mark--europe {
		background: var(--paper);
		border: 1.6px solid var(--indigo);
		border-radius: 50%;
	}
	.trio-name {
		font-family: var(--font-serif);
		font-size: 18px;
		font-weight: 500;
		color: var(--ink);
	}
	.trio-source {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--fg-3);
	}
	.trio-body {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 16px;
		line-height: 1.6;
		color: var(--ink-2);
	}

	.about-grid {
		display: grid;
		grid-template-columns: 220px 1fr;
		gap: 56px;
		align-items: start;
	}

	.body-col p {
		margin: 0 0 18px;
		font-family: var(--font-serif);
		font-size: 19px;
		line-height: 1.6;
		color: var(--ink);
		max-width: 68ch;
	}

	.body-col p:last-child {
		margin-bottom: 0;
	}
	.body-col em {
		font-style: italic;
		color: var(--ink-2);
	}

	.cite {
		font-family: var(--font-mono);
		font-size: 14px;
		color: var(--ink-2);
		border-bottom-color: var(--rule-strong);
	}

	/* ── Modes ─────────────────────────────────────────────────── */
	.modes {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 32px 40px;
	}

	.mode-col {
		display: flex;
		flex-direction: column;
		color: inherit;
		text-decoration: none;
		transition: transform var(--dur-1) var(--ease);
	}

	.mode-col:hover .mode {
		border-color: var(--ink-3);
		background: var(--paper);
	}

	.mode-col:hover .mode-cta {
		color: var(--accent);
	}

	.mode-col:hover .mode-cta__arrow {
		transform: translateX(3px);
	}

	.mode-col:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 4px;
	}

	/* Bezocht: subtiel accent op de Probeer-pijl en de naam, zodat de
	   gebruiker ziet welke modi al verkend zijn zonder dat de tegel
	   "uitgegrijsd" overkomt. */
	.mode-col:visited .mode-cta {
		color: var(--accent);
	}
	.mode-col:visited .mode-name::after {
		content: ' ·';
		color: var(--accent);
		margin-left: 2px;
	}

	.domain:visited .domain-arrow {
		color: var(--accent);
	}
	.domain:visited .domain-name {
		color: var(--ink-2);
	}

	.parl-tile:visited .parl-tile__arrow {
		color: var(--accent);
	}

	.mode {
		flex: 1;
		border: 1px solid var(--rule);
		background: var(--paper-2);
		padding: 24px 24px 0;
		display: flex;
		flex-direction: column;
		transition:
			border-color var(--dur-1) var(--ease),
			background var(--dur-1) var(--ease);
	}

	.mode-head {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
		margin-bottom: 10px;
	}

	.mode-kind {
		font-family: var(--font-sans);
		font-size: 10.5px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--fg-3);
	}

	.mode-name {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 22px;
		font-weight: 500;
		color: var(--ink);
	}

	.mode-desc {
		margin: 0 0 24px;
		font-family: var(--font-sans);
		font-size: 13px;
		line-height: 1.55;
		color: var(--fg-2);
		flex: 1;
	}

	.mode-canvas {
		aspect-ratio: 760 / 420;
		background: var(--paper);
		border-top: 1px solid var(--rule);
		margin: 0 -24px;
		overflow: hidden;
	}

	.mode-cta {
		display: block;
		margin: 16px 0 0;
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--fg-2);
		text-align: right;
		transition: color var(--dur-1) var(--ease);
	}

	.mode-cta__arrow {
		display: inline-block;
		transition: transform var(--dur-1) var(--ease);
	}

	/* ── Stats ─────────────────────────────────────────────────── */
	.stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		border-top: 1px solid var(--ink);
	}
	/* Variant: twee context-tellingen op één rij — twee kolommen. */
	.stats--sources {
		grid-template-columns: repeat(2, 1fr);
	}

	.stat {
		padding: 28px 24px 28px 0;
		border-right: 1px solid var(--rule);
	}

	.stat:last-child {
		border-right: none;
	}
	.stat:not(:first-child) {
		padding-left: 24px;
	}

	/* Feature-tile direct onder de drie bronnen-rij. Volle breedte, eigen
	   binding bovenaan zodat het echt "aankomst" leest, niet de vierde van
	   vier. */
	.stat--feature {
		margin-top: 0;
		padding: 32px 32px 36px;
		border-top: 1px solid var(--accent);
		border-right: 0;
		background: var(--paper-2);
	}
	.stat--feature .stat-num {
		font-size: 80px;
	}

	/* Markeert per tile of het cijfer uit officiële databases komt
	   (Opgehaald) of alleen in Concordans bestaat. De primary variant
	   krijgt de accent-toon zodat het verschil bij het scannen
	   onmiddellijk leesbaar is. */
	.stat-flag {
		font-family: var(--font-sans);
		font-size: 9.5px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--fg-4);
		margin-bottom: 6px;
	}
	.stat--primary .stat-flag {
		color: var(--accent);
	}

	.stat-label {
		font-family: var(--font-sans);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--fg-3);
		margin-bottom: 8px;
	}

	.stat-num {
		font-family: var(--font-serif);
		font-size: 44px;
		font-weight: 500;
		line-height: 1;
		letter-spacing: -0.02em;
		color: var(--ink-2);
		margin-bottom: 8px;
		font-variant-numeric: tabular-nums;
		transition: color var(--dur-2) var(--ease);
	}

	/* Verbindingen is de hoofdgrootheid van het corpus: het cijfer dat
	   het meeste over Concordans zegt. Visueel dominanter dan de andere
	   drie. */
	.stat--primary .stat-num {
		font-size: 64px;
		color: var(--accent);
		letter-spacing: -0.025em;
	}

	.stat--primary .stat-label {
		color: var(--accent);
	}

	.stat-num--loading {
		color: var(--fg-4);
		animation: stat-pulse 1.6s ease-in-out infinite;
	}
	@keyframes stat-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}

	.stat-note {
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--fg-3);
		line-height: 1.4;
	}

	.stats-unavail {
		font-family: var(--font-sans);
		color: var(--ink-4);
	}
	.stats-foot {
		margin: 24px 0 0;
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--fg-3);
	}

	.stats-foot__sync {
		display: inline-block;
		margin-right: 10px;
		padding: 2px 8px;
		background: var(--paper-2);
		border: 1px solid var(--rule);
		color: var(--ink-2);
		font-variant-numeric: tabular-nums;
	}

	.cite-mono {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--fg-3);
	}

	/* ── Verken combined ───────────────────────────────────────── */
	.verken-col-label {
		font-family: var(--font-sans);
		font-size: 11px;
		font-weight: 400;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--fg-3);
		margin-bottom: 12px;
	}

	.verken-layout {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 56px;
		border-top: 1px solid var(--rule);
		padding-top: 24px;
		align-items: stretch;
	}

	/* Stretch beide kolommen tot dezelfde hoogte; de "Alle wetboeken"
	   en "Parlement in het corpus" links worden naar onder geduwd zodat
	   de korte kolom mee strekt en beide afsluiten op gelijke lijn. */
	.verken-wet,
	.verken-parl {
		display: flex;
		flex-direction: column;
	}

	.verken-wet .domains-more,
	.verken-parl .domains-more {
		margin-top: auto;
		padding-top: 20px;
	}

	/* ── Domains ───────────────────────────────────────────────── */
	.domains {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		border-top: 1px solid var(--rule);
	}

	.domains--2 {
		grid-template-columns: repeat(2, 1fr);
		border-top: none;
	}

	/* Override nth-child border rules for 2-col variant */
	.domains--2 .domain:nth-child(3n) {
		border-right: 1px solid var(--rule);
	}

	.domains--2 .domain:nth-child(2n) {
		border-right: none;
	}

	.domain {
		border-right: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
		padding: 24px 22px 22px;
		min-height: 152px;
		display: flex;
		flex-direction: column;
		cursor: pointer;
		transition: background var(--dur-1) var(--ease);
		text-decoration: none;
		color: inherit;
	}

	.domain:nth-child(3n) {
		border-right: none;
	}
	.domain:hover {
		background: var(--paper-3);
	}

	.domain-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 8px;
	}

	.domain-mono {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--fg-3);
		letter-spacing: 0.02em;
	}

	.domain-count {
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--fg-3);
		white-space: nowrap;
	}

	.domain-count--empty {
		min-width: 60px;
		height: 11px;
	}

	.domain-name {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 19px;
		font-weight: 500;
		color: var(--ink);
		line-height: 1.25;
		flex: 1;
	}

	.domain-foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 12px;
	}

	.domain-juris {
		font-family: var(--font-sans);
		font-size: 10.5px;
		font-weight: 500;
		color: var(--fg-2);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 3px 8px;
		background: var(--paper-3, var(--paper));
		border: 1px solid var(--rule);
	}

	.domain-arrow {
		font-size: 14px;
		color: var(--fg-3);
		transition:
			color var(--dur-1) var(--ease),
			transform var(--dur-1) var(--ease);
		display: inline-block;
	}

	.domain:hover .domain-arrow {
		color: var(--accent);
		transform: translateX(2px);
	}

	.domains-more {
		display: inline-block;
		margin-top: 20px;
		font-family: var(--font-sans);
		font-size: 13px;
		color: var(--fg-2);
		transition: color var(--dur-1) var(--ease);
	}

	.domains-more:hover {
		color: var(--ink);
	}

	/* ── Parlement (hemicycle + tiles) ─────────────────────────── */
	.verken-parl :global(.hemicycle) {
		margin: 0 0 24px;
		background: var(--paper-2);
	}

	.parl-tiles {
		display: flex;
		flex-direction: column;
		border-top: 1px solid var(--rule);
		margin-top: 16px;
	}

	.parl-tile {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px 4px;
		border-bottom: 1px solid var(--rule);
		text-decoration: none;
		color: inherit;
		transition:
			background var(--dur-1) var(--ease),
			padding-left var(--dur-1) var(--ease);
	}

	.parl-tile:hover {
		background: var(--paper-2);
		padding-left: 8px;
	}

	.parl-tile__body {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: baseline;
		gap: 10px;
	}

	.parl-tile__name {
		font-family: var(--font-serif);
		font-size: 15px;
		font-weight: 400;
		color: var(--ink);
		white-space: nowrap;
	}

	.parl-tile__sub {
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--fg-3);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.parl-tile__arrow {
		font-size: 13px;
		color: var(--fg-3);
		transition:
			color var(--dur-1) var(--ease),
			transform var(--dur-1) var(--ease);
		display: inline-block;
		flex-shrink: 0;
	}

	.parl-tile:hover .parl-tile__arrow {
		color: var(--accent);
		transform: translateX(2px);
	}

	/* ── Sources ───────────────────────────────────────────────── */
	.sources-grid {
		display: grid;
		grid-template-columns: 220px 1fr;
		gap: 56px;
		align-items: start;
	}

	.sources-list {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 32px 48px;
	}

	.source {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.source-name {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 14px;
		color: var(--ink);
	}

	.source-url {
		margin: 0;
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--fg-3);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.source-desc {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 16px;
		line-height: 1.55;
		color: var(--ink-2);
	}

	.method-note {
		grid-column: 1 / -1;
		border-top: 1px solid var(--rule);
		padding-top: 20px;
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: flex-start;
		gap: 24px;
	}

	.method-note p {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 15px;
		line-height: 1.6;
		color: var(--ink-2);
		max-width: 56ch;
	}

	.method-cta {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-sans);
		font-size: 13px;
		color: var(--ink);
		background: var(--paper-2);
		border: 1px solid var(--ink);
		padding: 10px 16px;
		border-radius: var(--r-1, 2px);
		flex-shrink: 0;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
	}

	.method-cta:hover {
		background: var(--ink);
		color: var(--paper);
	}

	/* ── Footer ─────────────────────────────────────────────────── */
	/* ── Responsive ─────────────────────────────────────────────── */
	@media (prefers-reduced-motion: reduce) {
		.graph-click-hint {
			animation: none;
			opacity: 1;
			transform: translateX(-50%);
		}
		.stat-num--loading {
			animation: none;
		}
		.floating-cite {
			transition: none;
		}
	}

	@media (max-width: 1024px) {
		.hero-inner {
			grid-template-columns: 1fr;
			min-height: auto;
			padding-top: 24px;
			padding-bottom: 40px;
			gap: 28px;
		}

		/* Op smallere viewports staat de tekst-propositie eerst; de canvas
		   komt eronder als visuele bevestiging in plaats van als raadsel. */
		.hero-graph {
			min-height: 260px;
		}

		.hero-text {
			display: flex;
			flex-direction: column;
		}

		.section-head,
		.about-grid,
		.sources-grid {
			grid-template-columns: 1fr;
			gap: 24px;
		}

		.trio {
			grid-template-columns: 1fr;
			gap: 24px;
		}

		.section-eyebrow {
			border-top: none;
			border-bottom: 1px solid var(--ink);
			padding-top: 0;
			padding-bottom: 8px;
		}

		.modes {
			grid-template-columns: 1fr;
			gap: 24px;
		}

		.stats {
			grid-template-columns: repeat(2, 1fr);
		}

		.verken-layout {
			grid-template-columns: 1fr;
			gap: 40px;
		}
	}

	@media (max-width: 640px) {
		.container {
			padding: 0 20px;
		}
		.block {
			padding: 56px 0;
		}
		.hero-title {
			font-size: 44px;
		}
		/* Avoid legend / click-hint collision on narrow viewports. The
		   floating cite card on the central node is the primary affordance;
		   the legend stays, the redundant hint is dropped. */
		.graph-click-hint {
			display: none;
		}
		.hero-cta__primary {
			width: 100%;
			justify-content: center;
		}
		.hero-cta {
			gap: 14px 24px;
		}
		.section-title {
			font-size: 30px;
		}
		.stats {
			grid-template-columns: 1fr 1fr;
		}
		.stat-num {
			font-size: 40px;
		}
		.domains--2 {
			grid-template-columns: 1fr;
		}
		.domains--2 .domain:nth-child(2n) {
			border-right: 1px solid var(--rule);
		}
		.sources-list {
			grid-template-columns: 1fr;
		}
	}
</style>
