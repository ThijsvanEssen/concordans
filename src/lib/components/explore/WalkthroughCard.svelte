<!--
	Eerste-keer-tipkaart die rechtsonder verschijnt bij de eerste keer dat
	een gebruiker /explore opent. Geeft in vier korte zinnen de mentale map
	van de weergavemodi (Ontdekken, Verdiepen, Lezen, Index). Eénmalig per
	browser; daarna verbergt localStorage hem permanent.

	De volgorde volgt de leesrichting van het product: eerst het netwerk
	verkennen, dan tekst erbij, dan alleen tekst, en als alternatief een
	tabellarisch overzicht per categorie.
-->
<script lang="ts">
	import { onMount } from 'svelte';

	const STORAGE_KEY = 'concordans:walkthrough-dismissed';

	let visible = $state(false);

	onMount(() => {
		try {
			if (localStorage.getItem(STORAGE_KEY) === '1') return;
			// Vertraag iets zodat de canvas eerst rendert; we vragen geen
			// aandacht van iemand die nog naar de focus aan het kijken is.
			setTimeout(() => {
				visible = true;
			}, 900);
		} catch {
			/* ignore */
		}
	});

	function dismiss() {
		visible = false;
		try {
			localStorage.setItem(STORAGE_KEY, '1');
		} catch {
			/* ignore */
		}
	}
</script>

{#if visible}
	<div class="walkthrough" role="dialog" aria-label="Eerste keer hier?">
		<div class="walkthrough__head">
			<span class="walkthrough__eyebrow">Eerste keer hier?</span>
			<button class="walkthrough__close" onclick={dismiss} aria-label="Sluiten">×</button>
		</div>
		<ol class="walkthrough__steps">
			<li>
				<span class="walkthrough__num">1</span>
				<span><strong>Ontdekken.</strong> Klik op een bron in het netwerk om hem te focussen.</span>
			</li>
			<li>
				<span class="walkthrough__num">2</span>
				<span
					><strong>Verdiepen.</strong> Netwerk naast de leestekst, met citaten in de rechterkolom.</span
				>
			</li>
			<li>
				<span class="walkthrough__num">3</span>
				<span
					><strong>Lezen.</strong> Volledige tekst met inhoudsopgave en citaten in de marge.</span
				>
			</li>
			<li>
				<span class="walkthrough__num">4</span>
				<span
					><strong>Index.</strong> Blader door één categorie: wetten, arresten, dossiers, commissies,
					kamerleden, fracties of stemmingen.</span
				>
			</li>
		</ol>
		<p class="walkthrough__hint">
			Open een rij in de Index om diezelfde bron in Ontdekken, Verdiepen of Lezen te openen.
		</p>
		<div class="walkthrough__foot">
			<a href="/docs#aan-de-slag" class="walkthrough__more">Meer in de documentatie →</a>
			<button class="walkthrough__got-it" onclick={dismiss}>Begrepen</button>
		</div>
	</div>
{/if}

<style>
	.walkthrough {
		position: fixed;
		right: 20px;
		bottom: 20px;
		width: 320px;
		max-width: calc(100vw - 40px);
		padding: 16px 18px 14px;
		background: var(--paper);
		border: 1px solid var(--ink);
		border-radius: var(--r-2, 4px);
		box-shadow: 0 6px 28px rgba(20, 18, 14, 0.14);
		z-index: 60;
		font-family: var(--font-sans);
		animation: walkthrough-in 240ms ease-out both;
	}

	@keyframes walkthrough-in {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.walkthrough__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 10px;
	}

	.walkthrough__eyebrow {
		font-size: 11px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--fg-3);
	}

	.walkthrough__close {
		background: none;
		border: 0;
		font-size: 18px;
		line-height: 1;
		cursor: pointer;
		color: var(--fg-3);
		padding: 2px 6px;
		border-radius: 2px;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
	}
	.walkthrough__close:hover {
		color: var(--ink);
		background: var(--paper-2);
	}

	.walkthrough__steps {
		list-style: none;
		padding: 0;
		margin: 0 0 12px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		font-size: 13px;
		line-height: 1.45;
		color: var(--ink-2);
	}

	.walkthrough__steps li {
		display: grid;
		grid-template-columns: 18px 1fr;
		gap: 8px;
		align-items: baseline;
	}

	.walkthrough__num {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--accent);
		text-align: right;
	}

	.walkthrough__steps strong {
		color: var(--ink);
		font-weight: 500;
	}

	.walkthrough__hint {
		margin: 0 0 12px;
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 12.5px;
		line-height: 1.45;
		color: var(--fg-3);
	}

	.walkthrough__foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		padding-top: 10px;
		border-top: 1px solid var(--rule);
	}

	.walkthrough__more {
		font-size: 12px;
		color: var(--fg-2);
		text-decoration: none;
		border-bottom: 1px solid var(--rule);
		padding-bottom: 1px;
		transition:
			color var(--dur-1) var(--ease),
			border-color var(--dur-1) var(--ease);
	}
	.walkthrough__more:hover {
		color: var(--ink);
		border-bottom-color: var(--ink);
	}

	.walkthrough__got-it {
		background: var(--ink);
		color: var(--paper);
		border: 0;
		border-radius: var(--r-1, 2px);
		font-size: 12px;
		font-weight: 500;
		padding: 7px 14px;
		cursor: pointer;
		transition: background var(--dur-1) var(--ease);
	}
	.walkthrough__got-it:hover {
		background: var(--accent);
	}

	@media (max-width: 640px) {
		.walkthrough {
			right: 12px;
			bottom: 12px;
			left: 12px;
			width: auto;
		}
	}
</style>
