/**
 * An option of a choice (Keuze, TekstMenu, Bepaalregel): its value, its label, its title, and
 * its `name` for a screen reader where the label leans on a heading (`1` under Aantal stappen).
 */
export type Option<T = string> = {
	waarde: T;
	label: string;
	titel?: string;
	name?: string;
	uit?: boolean;
};
