<script lang="ts">
	const GITHUB_URL = 'https://github.com';
</script>

<footer class="home-footer">
	<div>
		<h3>Contact</h3>
		<p>
			<a href="mailto:concordans@tmve.nl">concordans@tmve.nl</a>
		</p>
	</div>
	<div>
		<h3>Bijdragen</h3>
		<p>
			<a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>
		</p>
	</div>
	<div>
		<h3>API</h3>
		<p>API-documentatie volgt binnenkort.</p>
	</div>
</footer>

<style>
	.home-footer {
		width: min(1040px, 100%);
		margin: 0 auto;
		padding: 2.5rem 0 1rem;
		border-top: 1px solid var(--border);
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 1.5rem;
		background: var(--surface);
		color: var(--ink);
	}

	.home-footer h3 {
		margin-bottom: 0.25rem;
		font-size: 1rem;
	}

	.home-footer a {
		color: var(--accent);
		text-decoration: none;
	}
</style>
