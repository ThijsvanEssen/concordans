<script lang="ts">
	// Rich inline-detail voor een geopende rij. Per categorie een eigen
	// render-pad: header met kind/identifier/titel/chips, een rij stat-tiles,
	// optioneel een fase-tijdlijn (alleen dossier) en een twee-kolommen-body.
	//
	// Toont uitsluitend wat de DTO levert. Geen verzonnen metadata; CLAUDE.md
	// verbiedt elke vorm van geparafraseerde aanvulling.
	import type {
		CommissieDTO,
		DossierSummaryDTO,
		FractieDTO,
		InstrumentSummaryDTO,
		JudgmentSummaryDTO,
		LidDTO,
		StemmingSummaryDTO
	} from '$lib/api/parliamentary';
	import { partyColor } from '$lib/utils/party-color';

	type CategoryKey =
		| 'wetten'
		| 'arresten'
		| 'dossiers'
		| 'commissies'
		| 'leden'
		| 'fracties'
		| 'stemmingen';

	type AnyRecord =
		| InstrumentSummaryDTO
		| JudgmentSummaryDTO
		| DossierSummaryDTO
		| CommissieDTO
		| LidDTO
		| FractieDTO
		| StemmingSummaryDTO;

	let {
		category,
		record,
		onDiscover,
		onSplit,
		onRead
	}: {
		category: CategoryKey;
		record: AnyRecord;
		onDiscover: () => void;
		onSplit: () => void;
		onRead?: () => void;
	} = $props();

	// ── Helpers ────────────────────────────────────────────────────────────
	function fmtDate(iso: string | null | undefined): string {
		if (!iso) return '—';
		try {
			return new Intl.DateTimeFormat('nl-NL', {
				day: 'numeric',
				month: 'short',
				year: 'numeric'
			}).format(new Date(iso));
		} catch {
			return iso;
		}
	}

	const KIND_LABEL: Record<CategoryKey, string> = {
		wetten: 'Wet · regelgeving',
		arresten: 'Arrest · jurisprudentie',
		dossiers: 'Dossier · kamerstukken',
		commissies: 'Commissie · Tweede Kamer',
		leden: 'Kamerlid · Tweede Kamer',
		fracties: 'Fractie · Tweede Kamer',
		stemmingen: 'Stemming · plenaire vergadering'
	};

	// Welke categorieën hebben een Lezen-modus (volledige tekst).
	const HAS_READER = new Set<CategoryKey>(['wetten', 'arresten']);

	// ── Fase timeline (dossiers) ───────────────────────────────────────────
	// Zelfde fase-set als de Toolbar; de huidige fase wordt op de tijdlijn
	// gemarkeerd als 'current', alle eerdere fases als 'past', latere als
	// 'future'. Een tijdlijn-stap matcht een fase wanneer het label van de
	// huidige_fase ermee overeenkomt (case-insensitive).
	const STAGE_PATH: Array<{ id: string; label: string; tone: 'slate' | 'ochre' | 'olive' }> = [
		{ id: 'wetsvoorstel', label: 'Wetsvoorstel', tone: 'slate' },
		{ id: 'mvt', label: 'MvT', tone: 'slate' },
		{ id: 'advies_rvs', label: 'Advies RvS', tone: 'slate' },
		{ id: 'nota', label: 'Nota', tone: 'ochre' },
		{ id: 'verslag', label: 'Verslag', tone: 'ochre' },
		{ id: 'amendementen', label: 'Amendementen', tone: 'ochre' },
		{ id: 'stemming', label: 'Stemming', tone: 'ochre' },
		{ id: 'afgehandeld', label: 'Afgehandeld', tone: 'olive' }
	];

	function stageIndexFor(fase: string | null | undefined): number {
		if (!fase) return -1;
		const n = fase.toLowerCase();
		return STAGE_PATH.findIndex((s) => s.id === n || s.label.toLowerCase() === n);
	}

	// Derived per-categorie payload. Casten via `as` is veilig: het component
	// wordt alleen aangeroepen met records van de bijbehorende categorie.
	const w = $derived(category === 'wetten' ? (record as InstrumentSummaryDTO) : null);
	const j = $derived(category === 'arresten' ? (record as JudgmentSummaryDTO) : null);
	const d = $derived(category === 'dossiers' ? (record as DossierSummaryDTO) : null);
	const c = $derived(category === 'commissies' ? (record as CommissieDTO) : null);
	const l = $derived(category === 'leden' ? (record as LidDTO) : null);
	const f = $derived(category === 'fracties' ? (record as FractieDTO) : null);
	const s = $derived(category === 'stemmingen' ? (record as StemmingSummaryDTO) : null);

	const stageIdx = $derived(d ? stageIndexFor(d.huidige_fase) : -1);

	// Voor/tegen-percentage voor de stemming-bar in detail (totaal exclusief
	// onthoudingen, want die nemen geen positie in). We tonen zetels — de
	// werkelijke meerderheidsmaat, totaal ~150.
	const stemTotal = $derived(s ? s.voor_zetels + s.tegen_zetels : 0);
	const voorPct = $derived(stemTotal > 0 ? (s!.voor_zetels / stemTotal) * 100 : 0);
</script>

<div class="detail-inner">
	<div class="detail-head">
		<div class="detail-head-left">
			<div class="detail-kind">
				<span>{KIND_LABEL[category]}</span>
				{#if w}
					<span class="detail-sep" aria-hidden="true">·</span>
					<span class="detail-mono">{(w.bwb_id ?? w.celex ?? '').toUpperCase()}</span>
				{:else if j}
					<span class="detail-sep" aria-hidden="true">·</span>
					<span class="detail-mono">{j.ecli ?? j.key}</span>
				{:else if d}
					<span class="detail-sep" aria-hidden="true">·</span>
					<span class="detail-mono">Kamerstuk {d.kamerstuknummer}</span>
				{:else if c}
					<span class="detail-sep" aria-hidden="true">·</span>
					<span class="detail-mono">{c.afkorting ?? c.slug}</span>
				{:else if f}
					<span class="detail-sep" aria-hidden="true">·</span>
					<span class="detail-mono">{f.afkorting}</span>
				{:else if s}
					<span class="detail-sep" aria-hidden="true">·</span>
					<span class="detail-mono"
						>{fmtDate(s.datum)}{s.dossier_nummers[0] ? ` · ${s.dossier_nummers[0]}` : ''}</span
					>
				{/if}
			</div>

			<h3 class="detail-title">
				{#if w}
					{w.citation_title ?? w.short_title ?? w.title ?? w.key}
				{:else if j}
					{j.display_name ?? j.ecli ?? j.key}
				{:else if d}
					{d.titel ?? d.kamerstuknummer}
				{:else if c}
					{c.naam ?? c.key}
				{:else if l}
					{l.naam ?? l.key}
				{:else if f}
					{f.naam ?? f.afkorting}
				{:else if s}
					{s.onderwerp ?? '—'}
				{/if}
			</h3>

			<!-- Chips: per-categorie eigen status-indicatoren -->
			<div class="detail-chips">
				{#if w}
					<span class="tag tag--outline" class:tag--teal={w.jurisdiction === 'eu'}>
						{w.jurisdiction === 'eu' ? 'Europese Unie' : 'Nederlands recht'}
					</span>
				{:else if j}
					<span class="tag tag--outline">{j.court ?? 'Onbekende instantie'}</span>
					<span class="tag tag--indigo"><span class="tag-dot"></span>Uitspraak</span>
				{:else if d}
					{#if d.traject_kind}
						<span class="tag tag--outline">{d.traject_kind}</span>
					{/if}
					{#if d.huidige_fase && d.huidige_fase.toLowerCase() !== 'onbekend'}
						<span class="tag tag--ochre"><span class="tag-dot"></span>nu: {d.huidige_fase}</span>
					{/if}
				{:else if c}
					{#if (c.active_dossier_count ?? 0) > 0}
						<span class="tag tag--olive"><span class="tag-dot"></span>Actief</span>
					{:else}
						<span class="tag tag--outline">Geen lopende dossiers</span>
					{/if}
				{:else if l && l.partij}
					<span class="tag tag--outline">
						<span class="party-dot" style:background={partyColor(l.partij)}></span>{l.partij}
					</span>
				{:else if f}
					<span class="tag tag--outline">
						<span class="party-dot" style:background={partyColor(f.afkorting ?? '')}></span>
						{f.afkorting}{f.aantal_zetels != null ? ` · ${f.aantal_zetels} zetels` : ''}
					</span>
				{:else if s}
					<span class="tag" class:tag--moss={s.aangenomen} class:tag--spine={!s.aangenomen}>
						<span class="tag-dot"></span>{s.aangenomen ? 'Aangenomen' : 'Verworpen'}
					</span>
				{/if}
			</div>
		</div>
	</div>

	<!-- Dossier: granulaire fase-tijdlijn -->
	{#if d && stageIdx >= 0}
		<div class="stage-tl" aria-label="Fase-tijdlijn">
			{#each STAGE_PATH as step, i (step.id)}
				{@const past = i < stageIdx}
				{@const current = i === stageIdx}
				<div
					class="stage-tl-step"
					class:is-past={past}
					class:is-current={current}
					class:is-future={!past && !current}
				>
					<span class="stage-tl-mark">
						{#if past}
							<svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
								<polyline
									points="2,6 5,9 10,3"
									stroke="currentColor"
									stroke-width="1.8"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
						{/if}
					</span>
					<span class="stage-tl-lbl">{step.label}</span>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Stat-tiles: alleen wat in de DTO staat. Lege velden → '—' -->
	<div class="tiles">
		{#if w}
			<div class="tile">
				<div class="tile-num">
					{w.article_count > 0 ? w.article_count.toLocaleString('nl-NL') : '—'}
				</div>
				<div class="tile-lbl">Artikelen</div>
			</div>
			<div class="tile">
				<div class="tile-num">{w.jurisdiction === 'eu' ? 'EU' : 'NL'}</div>
				<div class="tile-lbl">Jurisdictie</div>
			</div>
			{#if w.celex}
				<div class="tile">
					<div class="tile-mono">{w.celex}</div>
					<div class="tile-lbl">CELEX</div>
				</div>
			{/if}
			{#if w.bwb_id}
				<div class="tile">
					<div class="tile-mono">{w.bwb_id.toUpperCase()}</div>
					<div class="tile-lbl">BWB-id</div>
				</div>
			{/if}
		{:else if j}
			<div class="tile">
				<div class="tile-num">{fmtDate(j.date)}</div>
				<div class="tile-lbl">Datum</div>
			</div>
			<div class="tile">
				<div class="tile-num">{j.court ?? '—'}</div>
				<div class="tile-lbl">Instantie</div>
			</div>
			<div class="tile">
				<div class="tile-num">
					{j.inbound_citation_count > 0 ? j.inbound_citation_count.toLocaleString('nl-NL') : '—'}
				</div>
				<div class="tile-lbl">Citaties naar</div>
			</div>
			<div class="tile">
				<div class="tile-mono">{j.ecli ?? j.key}</div>
				<div class="tile-lbl">ECLI</div>
			</div>
		{:else if d}
			<div class="tile">
				<div class="tile-mono">{d.kamerstuknummer}</div>
				<div class="tile-lbl">Kamerstuk</div>
			</div>
			<div class="tile">
				<div class="tile-num">{d.huidige_fase ?? '—'}</div>
				<div class="tile-lbl">Huidige fase</div>
			</div>
			<div class="tile">
				<div class="tile-num">{d.traject_kind ?? 'overig'}</div>
				<div class="tile-lbl">Type traject</div>
			</div>
		{:else if c}
			<div class="tile">
				<div class="tile-num">{c.active_dossier_count ?? 0}</div>
				<div class="tile-lbl">Actieve dossiers</div>
			</div>
			<div class="tile">
				<div class="tile-mono">{c.afkorting ?? '—'}</div>
				<div class="tile-lbl">Afkorting</div>
			</div>
		{:else if l}
			<div class="tile">
				<div class="tile-num">{l.partij ?? '—'}</div>
				<div class="tile-lbl">Fractie</div>
			</div>
		{:else if f}
			<div class="tile">
				<div class="tile-num">{f.aantal_zetels ?? '—'}</div>
				<div class="tile-lbl">Zetels</div>
			</div>
			<div class="tile">
				<div class="tile-mono">{f.afkorting ?? '—'}</div>
				<div class="tile-lbl">Afkorting</div>
			</div>
		{:else if s}
			<div class="tile">
				<div class="tile-num">{s.voor_zetels.toLocaleString('nl-NL')}</div>
				<div class="tile-lbl">Voor</div>
				<div class="tile-sub">zetels · {s.voor_fracties} fracties</div>
			</div>
			<div class="tile">
				<div class="tile-num">{s.tegen_zetels.toLocaleString('nl-NL')}</div>
				<div class="tile-lbl">Tegen</div>
				<div class="tile-sub">zetels · {s.tegen_fracties} fracties</div>
			</div>
			<div class="tile">
				<div class="tile-num">{s.onthouding_zetels.toLocaleString('nl-NL')}</div>
				<div class="tile-lbl">Onthouding</div>
				<div class="tile-sub">zetels · {s.onthouding_fracties} fracties</div>
			</div>
			<div class="tile">
				<div class="tile-num">{s.aangenomen ? '✓' : '✗'}</div>
				<div class="tile-lbl">Uitslag</div>
				<div class="tile-sub">{s.aangenomen ? 'meerderheid' : 'geen meerderheid'}</div>
			</div>
		{/if}
	</div>

	<!-- Stemming-specifiek: voor/tegen-balk over de volle breedte van het detail. -->
	{#if s && stemTotal > 0}
		<div class="vote-bar-wrap">
			<span class="vote-side vote-side--v">{s.voor_zetels}</span>
			<span class="vote-bar">
				<span class="vote-bar-v" style:width="{voorPct}%"></span>
				<span class="vote-bar-t" style:width="{100 - voorPct}%"></span>
			</span>
			<span class="vote-side vote-side--t">{s.tegen_zetels}</span>
		</div>
	{/if}

	<!-- Actions: terug naar de drie weergavemodi -->
	<div class="detail-acts">
		<button type="button" class="detail-act detail-act--primary" onclick={onDiscover}>
			Ontdekken <span class="arrow" aria-hidden="true">→</span>
		</button>
		<button type="button" class="detail-act" onclick={onSplit}>
			Verdiepen <span class="arrow" aria-hidden="true">→</span>
		</button>
		{#if HAS_READER.has(category) && onRead}
			<button type="button" class="detail-act" onclick={onRead}>
				Lezen <span class="arrow" aria-hidden="true">→</span>
			</button>
		{/if}
	</div>
</div>

<style>
	.detail-inner {
		padding: 22px 28px 26px;
		border-left: 2px solid var(--spine);
		display: flex;
		flex-direction: column;
		gap: 22px;
	}
	.detail-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 18px;
	}
	.detail-head-left {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.detail-kind {
		font-family: var(--font-sans);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-3);
		display: inline-flex;
		align-items: baseline;
		gap: 8px;
		flex-wrap: wrap;
	}
	.detail-sep {
		color: var(--fg-4);
	}
	.detail-mono {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-3);
		letter-spacing: 0;
		text-transform: none;
	}
	.detail-title {
		font-family: var(--font-serif);
		font-weight: 500;
		font-size: 22px;
		line-height: 1.25;
		letter-spacing: -0.005em;
		color: var(--ink);
		margin: 0;
		text-wrap: pretty;
	}
	.detail-chips {
		display: inline-flex;
		gap: 6px;
		margin-top: 6px;
		flex-wrap: wrap;
	}

	/* Tags: vlakke gekleurde labels in de spine-faint/moss-faint familie */
	.tag {
		display: inline-flex;
		align-items: baseline;
		gap: 5px;
		height: 22px;
		padding: 0 9px;
		font-family: var(--font-sans);
		font-size: 10.5px;
		letter-spacing: 0.04em;
		border-radius: 2px;
		border: 1px solid transparent;
		white-space: nowrap;
		line-height: 22px;
	}
	.tag-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		align-self: center;
		flex-shrink: 0;
	}
	.tag--moss {
		color: var(--moss);
		background: var(--moss-faint);
	}
	.tag--moss .tag-dot {
		background: var(--moss);
	}
	.tag--spine {
		color: var(--spine);
		background: var(--spine-faint);
	}
	.tag--spine .tag-dot {
		background: var(--spine);
	}
	.tag--ochre {
		color: var(--ochre);
		background: var(--ochre-faint);
	}
	.tag--ochre .tag-dot {
		background: var(--ochre);
	}
	.tag--olive {
		color: var(--olive);
		background: var(--olive-faint);
	}
	.tag--olive .tag-dot {
		background: var(--olive);
	}
	.tag--indigo {
		color: var(--indigo);
		background: var(--indigo-faint);
	}
	.tag--indigo .tag-dot {
		background: var(--indigo);
	}
	.tag--teal {
		color: var(--teal);
		background: var(--teal-faint);
	}
	.tag--teal .tag-dot {
		background: var(--teal);
	}
	.tag--outline {
		color: var(--ink-3);
		background: transparent;
		border-color: var(--rule);
	}
	.tag--outline.tag--teal {
		color: var(--teal);
		border-color: var(--teal-faint);
	}

	.party-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		vertical-align: middle;
	}

	/* Stage timeline */
	.stage-tl {
		position: relative;
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		padding: 8px 0 0;
	}
	.stage-tl::before {
		content: '';
		position: absolute;
		left: 6%;
		right: 6%;
		top: 19px;
		height: 1px;
		background: var(--rule-strong);
		z-index: 0;
	}
	.stage-tl-step {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		z-index: 1;
	}
	.stage-tl-mark {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--paper);
		border: 1.5px solid var(--rule-strong);
	}
	.is-past .stage-tl-mark {
		background: var(--olive);
		border-color: var(--olive);
		color: var(--paper);
	}
	.is-current .stage-tl-mark {
		background: var(--spine);
		border-color: var(--spine);
		color: var(--paper);
		box-shadow: 0 0 0 4px var(--spine-faint);
	}
	.stage-tl-lbl {
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--fg-3);
		text-align: center;
		line-height: 1.25;
	}
	.is-current .stage-tl-lbl {
		color: var(--spine);
		font-weight: 500;
	}
	.is-past .stage-tl-lbl {
		color: var(--ink-2);
	}

	/* Tiles */
	.tiles {
		display: grid;
		gap: 12px;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
	}
	.tile {
		border: 1px solid var(--rule);
		background: var(--paper);
		padding: 14px 16px 12px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.tile-num {
		font-family: var(--font-serif);
		font-size: 26px;
		font-weight: 500;
		color: var(--ink);
		line-height: 1;
		font-feature-settings: 'lnum';
	}
	.tile-mono {
		font-family: var(--font-mono);
		font-size: 14px;
		color: var(--ink-2);
		line-height: 1;
		word-break: break-all;
	}
	.tile-lbl {
		font-family: var(--font-sans);
		font-size: 10.5px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-3);
	}
	.tile-sub {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 12.5px;
		color: var(--fg-3);
		margin-top: 2px;
	}

	/* Vote bar (stemmingen) — moss-2/spine-2 voor hoger contrast op paper-2 */
	.vote-bar-wrap {
		display: grid;
		grid-template-columns: 60px 1fr 60px;
		gap: 12px;
		align-items: center;
	}
	.vote-side {
		font-family: var(--font-mono);
		font-size: 14px;
		font-weight: 500;
	}
	.vote-side--v {
		color: var(--moss-2);
		text-align: right;
	}
	.vote-side--t {
		color: var(--spine-2);
		text-align: left;
	}
	.vote-bar {
		height: 10px;
		background: var(--paper-3);
		border-radius: 2px;
		overflow: hidden;
		display: flex;
	}
	.vote-bar-v {
		background: var(--moss-2);
	}
	.vote-bar-t {
		background: var(--spine-2);
	}

	/* Action bar onderaan: terug naar de drie weergavemodi */
	.detail-acts {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		align-items: center;
		padding-top: 14px;
		border-top: 1px solid var(--rule);
	}
	.detail-act {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 30px;
		padding: 0 12px;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: 2px;
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--ink-2);
		cursor: pointer;
		transition:
			background 120ms,
			color 120ms,
			border-color 120ms;
		white-space: nowrap;
	}
	.detail-act:hover {
		background: var(--ink);
		color: var(--paper);
		border-color: var(--ink);
	}
	.detail-act .arrow {
		font-family: var(--font-serif);
		opacity: 0.7;
	}
	.detail-act--primary {
		background: var(--ink);
		color: var(--paper);
		border-color: var(--ink);
	}
	.detail-act--primary:hover {
		background: var(--ink-2);
		border-color: var(--ink-2);
	}
</style>
