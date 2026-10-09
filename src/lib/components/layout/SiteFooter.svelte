<script lang="ts">
	import Wordmark from './Wordmark.svelte';
</script>

<footer class="foot">
	<div class="container foot-grid">
		<div class="foot-blurb">
			<a href="/" class="foot-logo no-underline" aria-label="Concordans home">
				<Wordmark size={17} />
			</a>
			<p>Werkomgeving voor juridisch onderzoek, op officiële bronnen.</p>
		</div>

		<div class="foot-col">
			<h4>Concordans</h4>
			<ul>
				<li><a href="/explore" class="no-underline">Verkenner</a></li>
				<li><a href="/docs" class="no-underline">Documentatie</a></li>
				<li><a href="/docs/methode" class="no-underline">Methode</a></li>
				<li><a href="/api" class="no-underline">API</a></li>
			</ul>
		</div>

		<div class="foot-col">
			<h4>Bronnen</h4>
			<ul>
				<li>
					<a href="https://wetten.overheid.nl" target="_blank" rel="noopener" class="no-underline"
						>wetten.overheid.nl</a
					>
				</li>
				<li>
					<a
						href="https://www.rechtspraak.nl/uitspraken"
						target="_blank"
						rel="noopener"
						class="no-underline">rechtspraak.nl</a
					>
				</li>
				<li>
					<a href="https://www.tweedekamer.nl" target="_blank" rel="noopener" class="no-underline"
						>tweedekamer.nl</a
					>
				</li>
				<li>
					<a href="https://www.eerstekamer.nl" target="_blank" rel="noopener" class="no-underline"
						>eerstekamer.nl</a
					>
				</li>
				<li>
					<a
						href="https://www.officielebekendmakingen.nl"
						target="_blank"
						rel="noopener"
						class="no-underline">officielebekendmakingen.nl</a
					>
				</li>
				<li>
					<a href="https://eur-lex.europa.eu" target="_blank" rel="noopener" class="no-underline"
						>eur-lex.europa.eu</a
					>
				</li>
				<li><a href="/bronnen" class="no-underline">Herkomst per bron</a></li>
			</ul>
		</div>

		<div class="foot-col">
			<h4>Over</h4>
			<ul>
				<li><a href="/over" class="no-underline">Over Concordans</a></li>
				<li><a href="/bronnen" class="no-underline">Bronnen en hergebruik</a></li>
				<li><a href="/voorwaarden" class="no-underline">Voorwaarden</a></li>
				<li><a href="/privacy" class="no-underline">Privacy</a></li>
			</ul>
		</div>
	</div>

	<div class="container foot-bottom">
		<span>© 2026 Concordans</span>
	</div>
</footer>

<style>
	.foot {
		background: var(--paper);
		border-top: 1px solid var(--rule);
		padding: 56px 0 0;
		margin-top: auto;
	}

	/* On the edge of the pages above it: the frame of Bladeren, without its height. */
	.container {
		box-sizing: border-box;
		max-width: 1440px;
		margin: 0 auto;
		padding: 0 var(--s-6);
	}

	.foot-grid {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr 1fr;
		gap: var(--s-7);
		padding-bottom: var(--s-7);
		border-bottom: 1px solid var(--rule);
	}

	.foot-logo {
		display: flex;
	}

	.foot-blurb {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
	}

	.foot-blurb p {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		line-height: 1.55;
		color: var(--ink-3);
		max-width: 30ch;
	}

	.foot-col h4 {
		margin: 0 0 14px;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
	}

	.foot-col ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}

	.foot-col a {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
		transition: color var(--dur-1) var(--ease);
	}

	.foot-col a:hover {
		color: var(--ink);
	}

	.foot-bottom {
		display: flex;
		justify-content: flex-start;
		align-items: center;
		padding: 20px var(--s-6);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}

	@media (max-width: 1024px) {
		.foot-grid {
			grid-template-columns: 1fr 1fr;
			gap: var(--s-6);
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
			gap: var(--s-2);
			text-align: center;
		}
	}
</style>
