<script lang="ts">
	// The full title of a bron where it is longer than its name, folded under the title: a
	// dossier's bill, a law's official title (Wet van 8 juli 2026, houdende …). One form on
	// every page that has one (Thijs, 23 Oct, A190).
	let { title }: { title: string } = $props();
</script>

<details class="full-title">
	<summary class="raakvlak">Volledige titel</summary>
	<p>{title}</p>
</details>

<style>
	.full-title summary {
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		color: var(--ink-2);
		cursor: pointer;
	}
	.full-title p {
		margin: var(--s-1) 0 0;
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
</style>
