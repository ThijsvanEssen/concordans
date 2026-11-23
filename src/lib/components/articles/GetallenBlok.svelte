<script lang="ts">
	// The numbers of an article under its text: each as the text prints it, where it stands, and
	// its course over the versions, oldest first, the one on screen marked. Nothing here is
	// added up or worked out; an article without numbers shows no block.
	import Section from '$lib/components/ui/Sectie.svelte';
	import { getalRijen, type Getal } from '$lib/text/getallen';

	let { getallen }: { getallen: readonly Getal[] } = $props();

	const rijen = $derived(getalRijen(getallen));
</script>

{#if rijen.length > 0}
	<div class="getallen">
		<Section title="Getallen in dit artikel" sleutel="getallen">
			<ul>
				{#each rijen as rij, i (i)}
					<li>
						<span class="wat"
							><b>{rij.tekst}</b>{#if rij.plaats}<small>{rij.plaats}</small>{/if}</span
						>
						<ol class="verloop" aria-label="Verloop van {rij.tekst}">
							{#each rij.verloop as stap, j (j)}
								<li aria-current={stap.gekozen ? 'true' : undefined}>
									<span class="waarde">{stap.tekst}</span>{#if stap.vanaf}<small>{stap.vanaf}</small
										>{/if}
								</li>
							{/each}
						</ol>
					</li>
				{/each}
			</ul>
		</Section>
	</div>
{/if}

<style>
	.getallen {
		margin-block: var(--s-6);
	}
	ul,
	ol {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.getallen ul > li {
		display: grid;
		grid-template-columns: minmax(7rem, 12rem) 1fr;
		gap: var(--s-2) var(--s-4);
		padding: var(--s-3) var(--s-2);
		border-top: 1px solid var(--rule);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: var(--lh-snug);
	}
	.wat {
		display: flex;
		flex-direction: column;
	}
	small {
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.verloop {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2) var(--s-4);
	}
	.verloop li {
		display: flex;
		flex-direction: column;
		color: var(--ink-2);
	}
	.verloop li[aria-current='true'] {
		color: var(--ink);
		font-weight: 600;
		box-shadow: inset 0 -2px 0 var(--rule-strong);
	}
	.verloop li[aria-current='true'] small {
		font-weight: 400;
	}
	@media (max-width: 768px) {
		.getallen ul > li {
			grid-template-columns: 1fr;
		}
	}
</style>
