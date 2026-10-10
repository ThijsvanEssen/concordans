// Parts of a line separated by a comma, the empty ones left out: "Uitspraak, Hoge Raad", never
// ", Hoge Raad" or "Uitspraak, , 2019" (Hosten's smoke check, 10 Oct). The one join for the
// kind line of a reader and every such run of words.
export type Deel = string | number | null | undefined | false;

export const opsomming = (delen: readonly Deel[], tussen = ', '): string =>
	delen
		.filter((d): d is string | number => d !== null && d !== undefined && d !== false)
		.map((d) => String(d).trim())
		.filter(Boolean)
		.join(tussen);
