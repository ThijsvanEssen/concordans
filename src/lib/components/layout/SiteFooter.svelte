<footer class="foot">
	<div class="container foot-grid">
		<div class="foot-blurb">
			<a href="/" class="foot-logo no-underline" aria-label="Concordans home">
				<svg class="foot-mark" viewBox="0 0 36 36" aria-hidden="true">
					<line x1="6" y1="10" x2="18" y2="18" stroke="var(--ink-3)" stroke-width="0.8" />
					<line x1="30" y1="8" x2="18" y2="18" stroke="var(--ink-3)" stroke-width="0.8" />
					<line x1="28" y1="28" x2="18" y2="18" stroke="var(--ink-3)" stroke-width="0.8" />
					<line x1="8" y1="28" x2="18" y2="18" stroke="var(--ink-3)" stroke-width="0.8" />
					<circle cx="6" cy="10" r="2" fill="var(--paper)" stroke="var(--ink-2)" stroke-width="1" />
					<circle cx="30" cy="8" r="2" fill="var(--indigo)" />
					<circle
						cx="28"
						cy="28"
						r="2"
						fill="var(--paper)"
						stroke="var(--ink-2)"
						stroke-width="1"
					/>
					<circle cx="8" cy="28" r="2" fill="var(--paper)" stroke="var(--ink-2)" stroke-width="1" />
					<circle
						cx="18"
						cy="18"
						r="3.6"
						fill="var(--paper)"
						stroke="var(--accent)"
						stroke-width="1.6"
					/>
				</svg>
				<span class="foot-brand-name">Concordans</span>
			</a>
			<p>Werkomgeving voor juridisch onderzoek, gebouwd op de officiële geconsolideerde bronnen.</p>
		</div>

		<div class="foot-col">
			<h4>Product</h4>
			<ul>
				<li><a href="/explore" class="no-underline">Open Concordans</a></li>
				<li><a href="/docs" class="no-underline">Documentatie</a></li>
				<li><a href="/docs/methode" class="no-underline">Methode-bijlage</a></li>
				<li><a href="/api" class="no-underline">API</a></li>
			</ul>
		</div>

		<div class="foot-col">
			<h4>Bronnen</h4>
			<ul>
				<li>
					<a href="https://wetten.overheid.nl" target="_blank" rel="noopener" class="no-underline">
						wetten.overheid.nl
					</a>
				</li>
				<li>
					<a
						href="https://www.rechtspraak.nl/uitspraken"
						target="_blank"
						rel="noopener"
						class="no-underline"
					>
						rechtspraak.nl
					</a>
				</li>
				<li>
					<a
						href="https://officielebekendmakingen.nl"
						target="_blank"
						rel="noopener"
						class="no-underline"
					>
						Staatsblad
					</a>
				</li>
				<li>
					<a href="https://eur-lex.europa.eu" target="_blank" rel="noopener" class="no-underline">
						eur-lex.europa.eu
					</a>
				</li>
			</ul>
		</div>

		<div class="foot-col">
			<h4>Over</h4>
			<ul>
				<li><a href="/colofon" class="no-underline">Colofon</a></li>
				<li><a href="/privacy" class="no-underline">Privacy</a></li>
				<li><a href="/voorwaarden" class="no-underline">Voorwaarden</a></li>
				<li><a href="/contact" class="no-underline">Contact</a></li>
			</ul>
		</div>
	</div>

	<div class="container foot-bottom">
		<span>© 2026– Concordans</span>
	</div>
</footer>

<style>
	.foot {
		background: var(--paper);
		border-top: 1px solid var(--rule);
		padding: 56px 0 0;
		margin-top: auto;
	}

	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 32px;
	}

	.foot-grid {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr 1fr;
		gap: 48px;
		padding-bottom: 48px;
		border-bottom: 1px solid var(--rule);
	}

	.foot-logo {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.foot-blurb {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.foot-mark {
		width: 28px;
		height: 28px;
		flex-shrink: 0;
	}

	.foot-brand-name {
		font-family: var(--font-serif);
		font-size: 17px;
		font-weight: 500;
		color: var(--ink);
	}

	.foot-blurb p {
		margin: 0;
		font-family: var(--font-sans);
		font-size: 13px;
		line-height: 1.55;
		color: var(--fg-3);
		max-width: 30ch;
	}

	.foot-col h4 {
		margin: 0 0 14px;
		font-family: var(--font-sans);
		font-size: 11px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--fg-3);
	}

	.foot-col ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.foot-col a {
		font-family: var(--font-sans);
		font-size: 13px;
		color: var(--fg-2);
		transition: color var(--dur-1) var(--ease);
	}

	.foot-col a:hover {
		color: var(--ink);
	}

	.foot-bottom {
		display: flex;
		justify-content: flex-start;
		align-items: center;
		padding: 20px 32px;
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--fg-4);
	}

	@media (max-width: 1024px) {
		.foot-grid {
			grid-template-columns: 1fr 1fr;
			gap: 32px;
		}
	}

	@media (max-width: 640px) {
		.container {
			padding: 0 20px;
		}
		.foot-grid {
			grid-template-columns: 1fr;
		}
		.foot-bottom {
			flex-direction: column;
			gap: 8px;
			text-align: center;
		}
	}
</style>
