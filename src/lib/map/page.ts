// The bundel's own page: the research on one page, to read and to print. By its id, which
// stays when the bundel is renamed; the bundel itself never leaves the browser.

/** The address of a bundel's own page. */
export const mapPageHref = (m: { id: string }) =>
	`/gemarkeerd/bundel?${new URLSearchParams({ id: m.id })}`;
