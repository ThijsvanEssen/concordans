// The server's text in <main id="seo"> gives way to the app. On the start page it is the
// first paint (app.html shows it there), and a reader may already have typed in its search
// field: that query, and the focus, go over to the app's field.

type Field = { query: string; focused: boolean };
const EMPTY: Field = { query: '', focused: false };
let kept = EMPTY;

/** Removes the server's text, keeping what was typed in its search field. */
export function removeServerText(doc: Document) {
	const seo = doc.getElementById('seo');
	if (!seo) return;
	const field = seo.querySelector<HTMLInputElement>('input[name="q"]');
	if (field) kept = { query: field.value.trim(), focused: doc.activeElement === field };
	seo.remove();
}

/** What the server's field held, once: a later visit to the start page starts empty. */
export function takeServerField(): Field {
	const field = kept;
	kept = EMPTY;
	return field;
}
