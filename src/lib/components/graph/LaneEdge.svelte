<script lang="ts">
	// The edge of the field of the lanes where more of the drawing lies at the right: without a
	// scrollbar in sight the fade is what says so.
	let {
		field,
		covered,
		watch
	}: {
		field: HTMLElement | null;
		/** How wide the card over the field is: the edge stands left of it. */
		covered: number;
		/** What changes the size of the drawing. */
		watch: unknown;
	} = $props();

	let more = $state(false);
	const see = () => {
		more = !!field && field.scrollLeft + field.clientWidth < field.scrollWidth - 1;
	};
	$effect(() => {
		void watch;
		void covered;
		const frame = requestAnimationFrame(see);
		field?.addEventListener('scroll', see, { passive: true });
		return () => {
			cancelAnimationFrame(frame);
			field?.removeEventListener('scroll', see);
		};
	});
</script>

{#if more}<div class="edge" style:right="{covered}px" aria-hidden="true"></div>{/if}

<style>
	.edge {
		position: absolute;
		top: 0;
		bottom: 0;
		width: var(--s-6);
		background: linear-gradient(to right, transparent, var(--paper));
		pointer-events: none;
	}
</style>
