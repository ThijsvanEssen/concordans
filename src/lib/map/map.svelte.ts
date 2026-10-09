// The map as the page holds it: its items in this browser, the panel open or not, and a map
// someone shared (?map=) until it is added or put aside. One map for now (step 1); named maps
// follow.
import { samen, sleutelVan, type MapItem } from './map';

const OPSLAG = 'concordans:map';

function lees(): MapItem[] {
	try {
		const raw = JSON.parse(localStorage.getItem(OPSLAG) ?? '[]');
		return Array.isArray(raw)
			? raw.filter(
					(i): i is MapItem =>
						typeof i?.id === 'string' && typeof i?.kort === 'string' && typeof i?.groep === 'string'
				)
			: [];
	} catch {
		return [];
	}
}

function bewaar(items: MapItem[]) {
	try {
		if (items.length) localStorage.setItem(OPSLAG, JSON.stringify(items));
		else localStorage.removeItem(OPSLAG);
	} catch {
		/* geen opslag */
	}
}

class Kaart {
	items = $state<MapItem[]>(typeof window === 'undefined' ? [] : lees());
	/** The panel over the page, opened from the menu item Gemarkeerd. */
	open = $state(false);
	/** A map from a link, shown in the panel until it is added or put aside. */
	gedeeld = $state<MapItem[] | null>(null);
	sleutels = $derived(new Set(this.items.map(sleutelVan)));

	heeft = (i: Pick<MapItem, 'id' | 'at'>) => this.sleutels.has(sleutelVan(i));

	/** Kept, or no longer: what a box beside a lid or a row does. */
	wissel(i: MapItem) {
		const k = sleutelVan(i);
		this.items = this.sleutels.has(k)
			? this.items.filter((x) => sleutelVan(x) !== k)
			: [...this.items, i];
		bewaar(this.items);
	}
	weg(i: Pick<MapItem, 'id' | 'at'>) {
		const k = sleutelVan(i);
		this.items = this.items.filter((x) => sleutelVan(x) !== k);
		bewaar(this.items);
	}
	wis() {
		this.items = [];
		bewaar(this.items);
	}
	/** A shared map into this one, without doubles. */
	neemOver() {
		if (!this.gedeeld) return;
		this.items = samen(this.items, this.gedeeld);
		bewaar(this.items);
		this.gedeeld = null;
	}
}

export const kaart = new Kaart();
