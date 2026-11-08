<script lang="ts">
	// The Verloop of a judgment opened under the band (B143): every instance of its case in
	// its order, each with what it is (Eerste stageOf, Hoger beroep, Cassatie, Conclusie), its
	// court and date as a link, its facts, how it ended (its text, and the outcome the
	// Rechtspraak records on the appeal) and the article of law that gives its court its say,
	// as a link. A step the data lacks is named with "niet in de gegevens"; an article the API
	// does not know stays empty. One answer of the API, the band's (cached).
	import { getJudgmentCourse } from '$lib/api/judgments';
	import { bronHref } from '$lib/bron/href';
	import { NOT_IN_DATA } from '$lib/text/coverage';
	import { capitalize } from '$lib/text/words';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import Waarde from '$lib/components/ui/Waarde.svelte';
	import { createLoader, type LoadState as State } from '$lib/util/load.svelte';
	import {
		stageOf,
		unresolvedName,
		stepName,
		stepRef,
		stepOutcome,
		basisArticle,
		type Course,
		type CourseStep
	} from './course-layers';

	let { ecli, id }: { ecli: string; id: string } = $props();

	let state = $state<State<Course>>({ status: 'loading' });
	const loader = createLoader(
		(e: string) => getJudgmentCourse(e),
		(s) => (state = s),
		'Verloop'
	);
	$effect(() => {
		loader.load(ecli);
		return loader.stop;
	});

	/** The facts under a step: its kind, the procedure where its term does not say it, its ECLI. */
	function facts(step: CourseStep, course: Course): string {
		const term = stageOf(step, course);
		const procedure =
			step.procedure && step.procedure.toLowerCase() !== term.toLowerCase() ? step.procedure : null;
		const kind =
			step.decision_kind && step.decision_kind !== 'conclusie'
				? capitalize(step.decision_kind)
				: null;
		return [kind, procedure, step.ecli].filter(Boolean).join(', ');
	}

	/** The outcome the Rechtspraak records on the appeal this step decided (`psi:gevolg`). */
	const recorded = (step: CourseStep) => step.links.find((l) => l.source_outcome)?.source_outcome;
</script>

<section {id} class="verloop" aria-label="Verloop">
	<LoadState {state} what="Het verloop" retry={() => loader.load(ecli)}>
		{#snippet children(course)}
			<ol class="stappen">
				{#each course.unresolved as t, i (i)}
					<li class="stap">
						<span class="stage">Eerdere aanleg</span>
						<div class="wat">
							<span class="naam">{unresolvedName(t)}</span><span class="leeg">, {NOT_IN_DATA}</span>
						</div>
						<span class="wet"><Waarde value={null} /></span>
					</li>
				{/each}
				{#each course.steps as step (step.key)}
					{@const article = basisArticle(step)}
					{@const outcome = stepOutcome(step, course)}
					{@const recordedOutcome = recorded(step)}
					<li
						class="stap"
						class:huidig={step.current}
						class:conclusie={step.decision_kind === 'conclusie'}
					>
						<span class="stage">{stageOf(step, course)}</span>
						<div class="wat">
							{#if step.current}<span class="naam"
									>{stepName(step)}<span class="deze"
										>, deze {step.decision_kind === 'conclusie' ? 'conclusie' : 'uitspraak'}</span
									></span
								>{:else}<a class="naam raakvlak" href={bronHref(stepRef(step))}>{stepName(step)}</a
								>{/if}{#if !step.loaded}<span class="leeg">, {NOT_IN_DATA}</span>{/if}
							{#if step.loaded}<div class="facts">{facts(step, course)}</div>{/if}
							{#if outcome}<div class="uitkomst">Uitkomst: {outcome}</div>{/if}
							{#if recordedOutcome}<div class="uitkomst">
									{recordedOutcome} volgens de Rechtspraak
								</div>{/if}
						</div>
						<span class="wet"
							>{#if article}<a class="raakvlak" href={bronHref(article.ref)}>{article.naam}</a
								>{:else}<Waarde value={null} />{/if}</span
						>
					</li>
				{/each}
			</ol>
			{#if course.truncated}
				<p class="verder">De zaak loopt verder dan deze stappen.</p>
			{/if}
		{/snippet}
	</LoadState>
</section>

<style>
	.verloop {
		margin: var(--s-3) 0 0;
		font-family: var(--font-serif);
		color: var(--ink);
	}
	.stappen {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* What it is, the step, the article: three columns, the article at the right. */
	.stap {
		display: grid;
		grid-template-columns: 112px minmax(0, 1fr) auto;
		column-gap: var(--s-3);
		align-items: baseline;
		padding: var(--s-2) var(--s-2);
		border-top: 1px solid var(--rule);
	}
	.stap:first-child {
		border-top: 0;
	}
	.huidig {
		background: var(--paper-2);
	}
	.stage,
	.facts,
	.wet,
	.verder {
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.naam {
		font-size: var(--t-meta);
		color: var(--ink);
	}
	.huidig .naam {
		font-weight: 600;
	}
	.deze {
		font-weight: 400;
		color: var(--ink-3);
	}
	.conclusie .stage {
		font-style: italic;
	}
	.uitkomst {
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	.leeg {
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.wet a {
		color: var(--ink-2);
	}
	.verder {
		margin: var(--s-2) 0 0;
	}
	/* A phone: what it is above the step, the article under it. */
	@media (max-width: 768px) {
		.stap {
			grid-template-columns: minmax(0, 1fr);
			row-gap: var(--s-1);
		}
		.wet:has(a) {
			padding-top: var(--s-1);
		}
		.wet:not(:has(a)) {
			display: none;
		}
	}
</style>
