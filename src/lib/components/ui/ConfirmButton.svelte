<script lang="ts">
	// An action that cannot be undone asks once: the first click turns the button into
	// "Ja, …", which does it; left alone for four seconds, it turns back.
	let {
		label,
		confirmLabel,
		onConfirm,
		buttonClass = 'btn',
		naam
	}: {
		label: string;
		/** What the second click does, in words: `Ja, netwerk wissen`. */
		confirmLabel: string;
		onConfirm: () => void;
		buttonClass?: string;
		/** Its name for a screen reader where the words alone are one of many (`Verwijder Map 2`). */
		naam?: string;
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

<button type="button" class={buttonClass} aria-label={asking ? undefined : naam} {onclick}
	>{asking ? confirmLabel : label}</button
>
