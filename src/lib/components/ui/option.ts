/** An option of a choice (Keuze, TekstMenu, Bepaalregel): its value, its label, its title. */
export type Option<T = string> = { waarde: T; label: string; titel?: string; uit?: boolean };
