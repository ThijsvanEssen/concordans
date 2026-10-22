// Whether "Zoek in dit stuk" is open, and the column it searches. A class because ReaderFrame
// has a prop called `state`, which keeps it from using the $state rune.
export class SearchState {
	open = $state(false);
	column = $state<HTMLElement | null>(null);

	toggle() {
		this.open = !this.open;
	}

	close() {
		this.open = false;
	}
}
