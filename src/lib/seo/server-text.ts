// The server's text in <main id="seo"> gives way to the app. On the start page it is the
// first paint (app.html shows it there), and a reader may already have typed in its search
// field or gone to a link with Tab: the query and the focus go over to the app.

type Field = { query: string; focused: boolean; link: string | null };
const EMPTY: Field = { query: '', focused: false, link: null };
let kept = EMPTY;

/** Removes the server's text, keeping what was typed in its search field and the focus. */
export function removeServerText(doc: Document) {
	const seo = doc.getElementById('seo');
	if (!seo) return;
	const field = seo.querySelector<HTMLInputElement>('input[name="q"]');
	const active = doc.activeElement;
	kept = {
		query: field?.value.trim() ?? '',
		focused: !!field && active === field,
		link:
			active instanceof HTMLAnchorElement && seo.contains(active)
				? active.getAttribute('href')
				: null
	};
	seo.remove();
}

/** What the server's page held, once: a later visit to the start page starts empty. */
export function takeServerField(): Field {
	const field = kept;
	kept = EMPTY;
	return field;
}
