<script lang="ts">
</script>

<svelte:head>
	<title>Contact. Concordans.</title>
</svelte:head>

<div class="page-wrap">
	<div class="container">
		<div class="stub-eyebrow">CONTACT</div>
		<h1 class="stub-title">Contact</h1>
		<p class="stub-lede">Voor vragen, feedback en aanvragen voor API-toegang.</p>

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
		font-size: 11px;
		letter-spacing: 0.1em;
		color: var(--fg-3);
		margin-bottom: 16px;
	}

	.stub-title {
		font-family: var(--font-serif);
		font-size: clamp(28px, 5vw, 40px);
		font-weight: 500;
		color: var(--ink);
		margin: 0 0 16px;
	}

	.stub-lede {
		font-family: var(--font-sans);
		font-size: 15px;
		line-height: 1.65;
		color: var(--fg-2);
		margin-bottom: 40px;
	}


</style>
