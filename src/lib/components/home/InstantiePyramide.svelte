<script lang="ts">
	// Rechtspraak-ingang voor de homepage: instantie-pyramide met de
	// architectuur van de rechterlijke macht. Eén Hoge Raad bovenaan, vier
	// gerechtshoven op tier 2, elf rechtbanken op tier 3. De
	// bestuursrechtelijke top (ABRvS, CRvB, CBb) zit als rustige voetnoot
	// onder de pyramide — aanwezig maar niet competiterend met de apex.
	//
	// Data is statisch (de Nederlandse rechterlijke macht verandert zelden).
	// Een latere iteratie kan uitspraakcounts uit /api/judgments toevoegen.

	type Instantie = {
		afk: string;
		naam: string;
		plaats: string;
		/** href in de Verkenner — gericht op de Index gefilterd op `court`. */
		href: string;
	};

	const HR: Instantie = {
		afk: 'HR',
		naam: 'Hoge Raad der Nederlanden',
		plaats: 'Den Haag',
		href: '/explore?mode=index&kind=arresten&tier=hoge_raad'
	};
	const HOVEN: Instantie[] = [
		{
			afk: 'GHAMS',
			naam: 'Gerechtshof Amsterdam',
			plaats: 'Amsterdam',
			href: '/explore?mode=index&kind=arresten&court=GHAMS'
		},
		{
			afk: 'GHARL',
			naam: 'Gerechtshof Arnhem-Leeuwarden',
			plaats: 'Arnhem',
			href: '/explore?mode=index&kind=arresten&court=GHARL'
		},
		{
			afk: 'GHDHA',
			naam: 'Gerechtshof Den Haag',
			plaats: 'Den Haag',
			href: '/explore?mode=index&kind=arresten&court=GHDHA'
		},
		{
			afk: 'GHSHE',
			naam: "Gerechtshof 's-Hertogenbosch",
			plaats: "'s-Hertogenbosch",
			href: '/explore?mode=index&kind=arresten&court=GHSHE'
		}
	];
	const RECHTBANKEN: Instantie[] = [
		{
			afk: 'RBAMS',
			naam: 'Rechtbank Amsterdam',
			plaats: 'Amsterdam',
			href: '/explore?mode=index&kind=arresten&court=RBAMS'
		},
		{
			afk: 'RBDHA',
			naam: 'Rechtbank Den Haag',
			plaats: 'Den Haag',
			href: '/explore?mode=index&kind=arresten&court=RBDHA'
		},
		{
			afk: 'RBGEL',
			naam: 'Rechtbank Gelderland',
			plaats: 'Arnhem',
			href: '/explore?mode=index&kind=arresten&court=RBGEL'
		},
		{
			afk: 'RBLIM',
			naam: 'Rechtbank Limburg',
			plaats: 'Maastricht',
			href: '/explore?mode=index&kind=arresten&court=RBLIM'
		},
		{
			afk: 'RBMNE',
			naam: 'Rechtbank Midden-Nederland',
			plaats: 'Utrecht',
			href: '/explore?mode=index&kind=arresten&court=RBMNE'
		},
		{
			afk: 'RBNHO',
			naam: 'Rechtbank Noord-Holland',
			plaats: 'Haarlem',
			href: '/explore?mode=index&kind=arresten&court=RBNHO'
		},
		{
			afk: 'RBNNE',
			naam: 'Rechtbank Noord-Nederland',
			plaats: 'Groningen',
			href: '/explore?mode=index&kind=arresten&court=RBNNE'
		},
		{
			afk: 'RBOBR',
			naam: 'Rechtbank Oost-Brabant',
			plaats: "'s-Hertogenbosch",
			href: '/explore?mode=index&kind=arresten&court=RBOBR'
		},
		{
			afk: 'RBOVE',
			naam: 'Rechtbank Overijssel',
			plaats: 'Zwolle',
			href: '/explore?mode=index&kind=arresten&court=RBOVE'
		},
		{
			afk: 'RBROT',
			naam: 'Rechtbank Rotterdam',
			plaats: 'Rotterdam',
			href: '/explore?mode=index&kind=arresten&court=RBROT'
		},
		{
			afk: 'RBZWB',
			naam: 'Rechtbank Zeeland-West-Brabant',
			plaats: 'Breda',
			href: '/explore?mode=index&kind=arresten&court=RBZWB'
		}
	];
	const BESTUURSRECHTELIJKE_TOP: Instantie[] = [
		{
			afk: 'ABRvS',
			naam: 'Afdeling bestuursrechtspraak Raad van State',
			plaats: 'Den Haag',
			href: '/explore?mode=index&kind=arresten&court=RVS'
		},
		{
			afk: 'CRvB',
			naam: 'Centrale Raad van Beroep',
			plaats: 'Utrecht',
			href: '/explore?mode=index&kind=arresten&court=CRVB'
		},
		{
			afk: 'CBb',
			naam: 'College van Beroep voor het bedrijfsleven',
			plaats: 'Den Haag',
			href: '/explore?mode=index&kind=arresten&court=CBB'
		}
	];

	let focused = $state<string | null>(null);
	function isDim(afk: string): boolean {
		return focused !== null && focused !== afk;
	}
	function isFocused(afk: string): boolean {
		return focused === afk;
	}
</script>

<div class="pyr">
	<!-- Tier 1 — Cassatie -->
	<div class="pyr-row">
		<div class="pyr-tier-label">
			<span>Cassatie</span>
		</div>
		<a
			class="pyr-hr"
			class:is-focused={isFocused(HR.afk)}
			class:is-dim={isDim(HR.afk)}
			href={HR.href}
			onmouseenter={() => (focused = HR.afk)}
			onmouseleave={() => (focused = null)}
			onfocus={() => (focused = HR.afk)}
			onblur={() => (focused = null)}
		>
			<span class="pyr-hr-dot" aria-hidden="true"></span>
			<span class="pyr-hr-text">
				<span class="pyr-hr-name">{HR.naam}</span>
				<span class="pyr-hr-sub">drie kamers · civiel, straf, belasting</span>
			</span>
		</a>
	</div>

	<!-- Tier 2 — Gerechtshoven -->
	<div class="pyr-row">
		<div class="pyr-tier-label">
			<span>Hoger beroep</span>
			<span class="pyr-tier-count">{HOVEN.length} gerechtshoven</span>
		</div>
		<div class="pyr-hoven">
			{#each HOVEN as h (h.afk)}
				<a
					class="pyr-hof"
					class:is-focused={isFocused(h.afk)}
					class:is-dim={isDim(h.afk)}
					href={h.href}
					onmouseenter={() => (focused = h.afk)}
					onmouseleave={() => (focused = null)}
					onfocus={() => (focused = h.afk)}
					onblur={() => (focused = null)}
					title="{h.naam} — {h.plaats}"
				>
					<span class="pyr-hof-dot" aria-hidden="true"></span>
					<span class="pyr-hof-name">{h.naam.replace('Gerechtshof ', '')}</span>
				</a>
			{/each}
		</div>
	</div>

	<!-- Tier 3 — Rechtbanken -->
	<div class="pyr-row">
		<div class="pyr-tier-label">
			<span>Eerste aanleg</span>
			<span class="pyr-tier-count">{RECHTBANKEN.length} rechtbanken</span>
		</div>
		<div class="pyr-rb">
			{#each RECHTBANKEN as r (r.afk)}
				<a
					class="pyr-rbtn"
					class:is-focused={isFocused(r.afk)}
					class:is-dim={isDim(r.afk)}
					href={r.href}
					onmouseenter={() => (focused = r.afk)}
					onmouseleave={() => (focused = null)}
					onfocus={() => (focused = r.afk)}
					onblur={() => (focused = null)}
					title="{r.naam} — {r.plaats}"
				>
					<span class="pyr-rb-dot" aria-hidden="true"></span>
					<span class="pyr-rb-name">{r.naam.replace('Rechtbank ', '')}</span>
				</a>
			{/each}
		</div>
	</div>

	<!-- Voetnoot — bestuursrechtelijke top -->
	<div class="pyr-foot">
		<span class="pyr-foot-label">Buiten de cassatie</span>
		<span class="pyr-foot-list">
			{#each BESTUURSRECHTELIJKE_TOP as b, i (b.afk)}
				{#if i > 0}
					<span class="pyr-foot-sep" aria-hidden="true">·</span>
				{/if}
				<a
					class="pyr-foot-chip"
					class:is-focused={isFocused(b.afk)}
					class:is-dim={isDim(b.afk)}
					href={b.href}
					onmouseenter={() => (focused = b.afk)}
					onmouseleave={() => (focused = null)}
					onfocus={() => (focused = b.afk)}
					onblur={() => (focused = null)}
					title="{b.naam} — {b.plaats}">{b.afk}</a
				>
			{/each}
		</span>
	</div>
</div>

<style>
	.pyr {
		display: flex;
		flex-direction: column;
		gap: 22px;
	}
	.pyr-row {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.pyr-tier-label {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
		font-family: var(--font-sans);
		font-size: 10px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-3);
	}
	.pyr-tier-count {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 11.5px;
		text-transform: none;
		letter-spacing: 0;
		color: var(--fg-4);
	}

	/* Tier 1 — Cassatie */
	.pyr-hr {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 12px;
		background: transparent;
		border: 1px solid transparent;
		padding: 6px 14px 6px 8px;
		cursor: pointer;
		border-radius: 2px;
		text-align: left;
		text-decoration: none;
		color: inherit;
		transition:
			opacity 220ms var(--ease),
			background 120ms var(--ease),
			border-color 120ms var(--ease);
	}
	.pyr-hr:hover {
		background: var(--paper);
	}
	.pyr-hr.is-focused {
		background: var(--paper);
		border-color: var(--ink-3);
	}
	.pyr-hr.is-dim {
		opacity: 0.35;
	}
	.pyr-hr-dot {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--indigo);
		flex-shrink: 0;
		box-shadow:
			0 0 0 3px var(--paper-2),
			0 0 0 4px var(--indigo);
	}
	.pyr-hr-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.pyr-hr-name {
		font-family: var(--font-serif);
		font-size: 18px;
		font-weight: 500;
		color: var(--ink);
		line-height: 1.05;
		letter-spacing: -0.005em;
		/* "Hoge Raad der Nederlanden" past op één regel zolang de
       Rechtspraak-kolom breed genoeg is; bij overflow vangen we het op
       met ellipsis zodat hij niet over twee regels valt. */
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.pyr-hr-sub {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 12px;
		color: var(--fg-3);
		line-height: 1.2;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.pyr-hr-text {
		overflow: hidden;
	}

	/* Tier 2 — Gerechtshoven */
	.pyr-hoven {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 4px 6px;
	}
	.pyr-hof {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 6px;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 2px;
		cursor: pointer;
		text-align: left;
		text-decoration: none;
		color: inherit;
		min-width: 0;
		transition:
			background 120ms var(--ease),
			border-color 120ms var(--ease),
			opacity 220ms var(--ease);
	}
	.pyr-hof:hover {
		background: var(--paper);
	}
	.pyr-hof.is-focused {
		background: var(--paper);
		border-color: var(--ink-3);
	}
	.pyr-hof.is-dim {
		opacity: 0.35;
	}
	.pyr-hof-dot {
		width: 11px;
		height: 11px;
		border-radius: 50%;
		background: var(--indigo-2);
		flex-shrink: 0;
	}
	.pyr-hof-name {
		font-family: var(--font-serif);
		font-size: 12.5px;
		color: var(--ink-2);
		line-height: 1.15;
		min-width: 0;
		/* Hoven-namen op één regel — "Arnhem-Leeuwarden" en "'s-Hertogenbosch"
       passen normaal nog; bij overflow vangt ellipsis ze op en geeft het
       title-attribuut de volledige naam terug. */
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Tier 3 — Rechtbanken. Single-line: namen wrappen niet meer.
     `minmax(0, 1fr)` zorgt dat een lange rechtbanknaam de kolom-breedte
     niet opblaast; nowrap + ellipsis vangt het op, de volledige naam
     blijft in het title-attribuut beschikbaar. */
	.pyr-rb {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 3px 4px;
	}
	.pyr-rbtn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 3px 6px;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 2px;
		cursor: pointer;
		text-align: left;
		text-decoration: none;
		color: inherit;
		min-width: 0;
		transition:
			background 120ms var(--ease),
			border-color 120ms var(--ease),
			opacity 220ms var(--ease);
	}
	.pyr-rbtn:hover {
		background: var(--paper);
	}
	.pyr-rbtn.is-focused {
		background: var(--paper);
		border-color: var(--ink-3);
	}
	.pyr-rbtn.is-dim {
		opacity: 0.35;
	}
	.pyr-rb-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--paper);
		border: 1.3px solid var(--indigo-2);
		flex-shrink: 0;
		transition: background 120ms var(--ease);
	}
	.pyr-rbtn:hover .pyr-rb-dot,
	.pyr-rbtn.is-focused .pyr-rb-dot {
		background: var(--indigo-2);
	}
	.pyr-rb-name {
		font-family: var(--font-serif);
		font-size: 11px;
		color: var(--ink-3);
		line-height: 1.15;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Voetnoot — bestuursrechtelijke top */
	.pyr-foot {
		margin-top: 6px;
		padding-top: 12px;
		border-top: 1px dotted var(--paper-edge, var(--rule));
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 6px 10px;
	}
	.pyr-foot-label {
		font-family: var(--font-sans);
		font-size: 10px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-4);
	}
	.pyr-foot-list {
		display: inline-flex;
		align-items: baseline;
		gap: 6px;
		flex-wrap: wrap;
	}
	.pyr-foot-sep {
		font-family: var(--font-mono);
		color: var(--fg-4);
		font-size: 12px;
	}
	.pyr-foot-chip {
		background: transparent;
		border: 0;
		padding: 0;
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--ink-2);
		cursor: pointer;
		border-bottom: 1px dotted var(--rule-strong);
		text-decoration: none;
		transition:
			color 120ms var(--ease),
			border-color 120ms var(--ease),
			opacity 220ms var(--ease);
	}
	.pyr-foot-chip:hover,
	.pyr-foot-chip.is-focused {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}
	.pyr-foot-chip.is-dim {
		opacity: 0.35;
	}
</style>
