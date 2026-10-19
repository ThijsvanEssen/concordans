// Where the reader is in the whole law: the article at the top of the text, as the whole-law
// reader sees it scroll by. The table of contents beside it (LezenNav, in the column or the
// sheet Inhoud) marks it and opens the divisions it stands in.

class LawPosition {
	/** The law read (its id as the reader has it), and the number of the article at the top. */
	law = $state<string | null>(null);
	article = $state<string | null>(null);

	set(law: string, article: string | null) {
		if (this.law === law && this.article === article) return;
		this.law = law;
		this.article = article;
	}

	/** The article at the top in `law`; null for another law, or none yet. */
	of(law: string | null) {
		return law && this.law?.toUpperCase() === law.toUpperCase() ? this.article : null;
	}

	clear() {
		this.law = null;
		this.article = null;
	}
}

export const lawPosition = new LawPosition();

/**
 * The article at the top of a reader: the one that crosses the line (px from the top of the
 * viewport, as the articles' own tops and bottoms), else the last one above it.
 */
export function articleAtTop(
	articles: readonly { number: string; top: number; bottom: number }[],
	line: number
): string | null {
	let above: string | null = null;
	for (const a of articles) {
		if (a.top <= line && a.bottom > line) return a.number;
		if (a.top <= line) above = a.number;
	}
	return above;
}
