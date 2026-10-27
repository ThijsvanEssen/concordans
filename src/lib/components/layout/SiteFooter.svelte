<script lang="ts">
	import Wordmark from './Wordmark.svelte';
	import { getStats } from '$lib/api/stats';
	import { feedStand, standLine } from '$lib/text/stand';
	import { report } from '$lib/api/errors';
	import { inView } from '$lib/actions/in-view';
	import { CONTACT_EMAIL } from '$lib/site/contact';

	// How current the data is, one line on every page (Thijs, 10 Oct: out of the page heads,
	// docs/bediening.md, Bronregels): from /api/stats, asked once the footer comes into view.
	let stand = $state<ReturnType<typeof feedStand>>(null);
	/** Without the stats the footer stands without its line. */
	const askStand = () =>
		getStats()
			.then((s) => (stand = feedStand(s.data_as_of)))
			.catch((e) => report('Voet', e));
</script>

<footer class="foot">
	<div class="container foot-grid">
		<div class="foot-blurb">
			<a href="/" class="foot-logo no-underline raak-rij" aria-label="Concordans, startpagina">
				<Wordmark size={28} />
			</a>
			<p>
				Het artikel, en de uitspraken en Kamerstukken die ernaar verwijzen. Zonder account, zonder
				cookies.
			</p>
		</div>

		<nav class="foot-col" aria-labelledby="foot-kop-0">
			<p class="foot-head" id="foot-kop-0">Concordans</p>
			<ul>
				<li><a href="/explore" class="no-underline raak-rij">Netwerk</a></li>
				<li><a href="/docs" class="no-underline raak-rij">Documentatie</a></li>
				<li><a href="/docs/methode" class="no-underline raak-rij">Methode</a></li>
				<li><a href="/api" class="no-underline raak-rij">API</a></li>
			</ul>
		</nav>

		<nav class="foot-col" aria-labelledby="foot-kop-1">
			<p class="foot-head" id="foot-kop-1">Officiële bronnen</p>
			<ul>
				<li>
					<a
						href="https://wetten.overheid.nl"
						target="_blank"
						rel="external noopener"
						class="no-underline raak-rij">wetten.overheid.nl</a
					>
				</li>
				<li>
					<a
						href="https://www.rechtspraak.nl/uitspraken"
						target="_blank"
						rel="external noopener"
						class="no-underline raak-rij">rechtspraak.nl</a
					>
				</li>
				<li>
					<a
						href="https://www.tweedekamer.nl"
						target="_blank"
						rel="external noopener"
						class="no-underline raak-rij">tweedekamer.nl</a
					>
				</li>
				<li>
					<a
						href="https://www.eerstekamer.nl"
						target="_blank"
						rel="external noopener"
						class="no-underline raak-rij">eerstekamer.nl</a
					>
				</li>
				<li>
					<a
						href="https://www.officielebekendmakingen.nl"
						target="_blank"
						rel="external noopener"
						class="no-underline raak-rij">officielebekendmakingen.nl</a
					>
				</li>
				<li>
					<a
						href="https://eur-lex.europa.eu"
						target="_blank"
						rel="external noopener"
						class="no-underline raak-rij">eur-lex.europa.eu</a
					>
				</li>
			</ul>
		</nav>

		<nav class="foot-col" aria-labelledby="foot-kop-2">
			<p class="foot-head" id="foot-kop-2">Over</p>
			<ul>
				<li><a href="/over" class="no-underline raak-rij">Over Concordans</a></li>
				<li><a href="/bronnen" class="no-underline raak-rij">Bronnen en hergebruik</a></li>
				<li><a href="/voorwaarden" class="no-underline raak-rij">Voorwaarden</a></li>
				<li><a href="/privacy" class="no-underline raak-rij">Privacy</a></li>
				<li><a href="/voorwaarden#fouten" class="no-underline raak-rij">Fouten melden</a></li>
			</ul>
		</nav>
	</div>

	<div class="container foot-bottom" use:inView={askStand}>
		<span
			>© 2026 Concordans, <a href="mailto:{CONTACT_EMAIL}" class="raak-rij">{CONTACT_EMAIL}</a
			></span
		>
		{#if stand}<span class="stand">{standLine(stand)}</span>{/if}
	</div>
</footer>

<style>
	.foot {
		background: var(--paper);
		border-top: 1px solid var(--rule);
		padding: var(--s-8) 0 0;
		margin-top: auto;
	}

	/* On the edge of the pages above it: the frame of Bladeren, without its height. */
	.container {
		box-sizing: border-box;
		max-width: var(--blad-max);
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
		font-size: var(--t-meta);
		line-height: 1.55;
		color: var(--ink-3);
		max-width: 36ch;
	}

	.foot-head {
		margin: 0 0 var(--s-4);
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
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-5);
		justify-content: space-between;
		align-items: center;
		padding: var(--s-5) var(--s-6);
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
		/* The sides alone: the rows keep their own room above and below (B29). */
		.container {
			padding-inline: var(--s-5);
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
