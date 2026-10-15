<script lang="ts">
	// An action that cannot be undone asks once: the first click turns the button into
	// "Ja, …", which does it; left alone for four seconds, it turns back.
	let {
		label,
		confirmLabel,
		onConfirm,
		class: className = 'btn'
	}: {
		label: string;
		/** What the second click does, in words: `Ja, netwerk wissen`. */
		confirmLabel: string;
		onConfirm: () => void;
		class?: string;
	} = $props();

	let asking = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	function onclick() {
		clearTimeout(timer);
		if (asking) {
			asking = false;
			onConfirm();
			return;
		}
		asking = true;
		timer = setTimeout(() => (asking = false), 4000);
	}
</script>

<button type="button" class={className} {onclick}>{asking ? confirmLabel : label}</button>
