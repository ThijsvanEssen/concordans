// The components whose elements the first paint sets ($lib/first-paint), by the name the paint
// knows them by. The build gives each its scoping class (svelte-css-hash.js, vite.config.ts)
// and the stylesheets that hold their styles: the paint wears the app's classes, and the
// app's own stylesheets lay it out.
export const COMPONENTS: Record<Component, string> = {
	page: 'src/routes/explore/+page.svelte',
	frame: 'src/lib/components/explore/readers/ReaderFrame.svelte',
	belongsTo: 'src/lib/bron/BelongsTo.svelte',
	peil: 'src/lib/components/explore/WholeLawReaderPeildatum.svelte',
	textMenu: 'src/lib/components/ui/TekstMenu.svelte',
	head: 'src/lib/components/explore/readers/ReaderHead.svelte',
	glyph: 'src/lib/bron/KindGlyph.svelte',
	reader: 'src/lib/components/explore/readers/ArticleReader.svelte',
	validity: 'src/lib/components/ui/Validity.svelte',
	coverage: 'src/lib/components/ui/Coverage.svelte',
	actions: 'src/lib/components/explore/readers/KopActies.svelte',
	dossierName: 'src/lib/bron/DossierNaam.svelte',
	caret: 'src/lib/components/ui/Caret.svelte',
	text: 'src/lib/components/articles/ArticleText.svelte'
};

/** A component the paint sets elements of. */
type Component =
	| 'page'
	| 'frame'
	| 'belongsTo'
	| 'peil'
	| 'textMenu'
	| 'head'
	| 'glyph'
	| 'reader'
	| 'validity'
	| 'coverage'
	| 'actions'
	| 'dossierName'
	| 'caret'
	| 'text';

/** The scoping class of each component. */
export type Classes = Record<Component, string>;

/** What the build gives the paint: the classes, and the stylesheets to load before it shows. */
export type Build = { classes: Classes; css: string[] };
