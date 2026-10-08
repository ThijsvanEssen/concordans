// Which of the two cards over the network was opened last on a phone: the legend or the
// panel Netwerk. A phone has room for one; opening the one folds the other (Thijs, 9 Oct).
import { writable } from 'svelte/store';

export type Zwevend = 'legenda' | 'netwerk';

export const laatstOpen = writable<Zwevend | null>(null);
