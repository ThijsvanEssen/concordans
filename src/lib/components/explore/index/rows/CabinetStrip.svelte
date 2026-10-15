<script lang="ts">
	import type { Cabinet } from '../government';
	import KabinettenStrook from '../KabinettenStrook.svelte';
	import type { ViewProps } from '../lists/list';

	// The cabinets in the time they governed, when sorted by it; a cabinet opens in place.
	let { ctx }: ViewProps<Cabinet, object> = $props();
	const open = $derived(ctx.p.open);
</script>

{#if ctx.rows?.length && ctx.sort.id === 'date'}
	<KabinettenStrook
		cabinets={ctx.rows}
		all={ctx.shared.cabinets}
		openKey={open?.startsWith('cabinets/') ? open.slice('cabinets/'.length) : null}
		onToggle={(key) => ctx.toggleOpen(`cabinets/${key}`)}
	/>
{/if}
