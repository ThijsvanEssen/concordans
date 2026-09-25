<script lang="ts">
</script>

<svelte:head>
	<title>Contact. Concordans.</title>
</svelte:head>

<div class="page-wrap">
	<div class="container">
		<div class="stub-eyebrow">Contact</div>
		<h1 class="stub-title">Contact</h1>
		<p class="stub-lede">Voor vragen, feedback en aanvragen voor grootschalig API-gebruik.</p>

		<p>Neem contact op via <a href="mailto:concordans@tmve.nl">concordans@tmve.nl</a>.</p>
	</div>
</div>

<style>
	.page-wrap {
		padding: 80px 0 120px;
	}

	.container {
		max-width: 600px;
		margin: 0 auto;
		padding: 0 24px;
	}

	.stub-eyebrow {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
		margin-bottom: 16px;
	}

	.stub-title {
		font-family: var(--font-serif);
		font-size: var(--t-h1);
		font-weight: 500;
		line-height: var(--lh-tight);
		color: var(--ink);
		margin: 0 0 16px;
	}

	.stub-lede {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink-2);
		margin-bottom: 40px;
	}

	p {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink);
		margin: 0;
	}

	p a {
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
	}
</style>
