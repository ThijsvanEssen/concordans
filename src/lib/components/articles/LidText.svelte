<script lang="ts">
	// Accept any citation shape with a target carrying bwb_id + article_number.
	// Both LooseCitatie (article-detail endpoint) and ReaderLidCitatie
	// (reader endpoint) satisfy this — they only differ in the extra fields
	// their target may carry, which we don't use here.
	type LooseCitatie = {
		start: number | null;
		end: number | null;
		text?: string | null;
		target: {
			bwb_id?: string | null;
			article_number?: string | null;
			display_name?: string | null;
			key?: string | null;
			collection?: string | null;
		};
	};

	let {
		text,
		citaties = [],
		onNavigate
	}: {
		text: string;
		citaties?: LooseCitatie[];
		onNavigate?: (collection: string, key: string) => void;
	} = $props();

	type Segment =
		| { kind: 'text'; content: string }
		| { kind: 'cite'; content: string; cite: LooseCitatie };

	const segments = $derived.by<Segment[]>(() => {
		const spans = citaties.filter(
			(c): c is LooseCitatie & { start: number; end: number } => c.start != null && c.end != null
		);
		if (!spans.length) return [{ kind: 'text', content: text }];
		const sorted = spans.sort((a, b) => a.start - b.start);
		const out: Segment[] = [];
		let cursor = 0;
		for (const c of sorted) {
			if (c.start < cursor) continue;
			if (c.start > cursor) out.push({ kind: 'text', content: text.slice(cursor, c.start) });
			out.push({ kind: 'cite', content: text.slice(c.start, c.end), cite: c });
			cursor = c.end;
		}
		if (cursor < text.length) out.push({ kind: 'text', content: text.slice(cursor) });
		return out;
	});

	function citeHref(c: LooseCitatie): string | null {
		const { key, collection, bwb_id, article_number } = c.target;
		if (key && collection) {
			return `/explore?focus=${encodeURIComponent(`${collection}/${key}`)}`;
		}
		if (bwb_id && article_number) {
			return `/explore?focus=${encodeURIComponent(`instrument_articles/${bwb_id}_${article_number}`)}`;
		}
		return null;
	}

	function citeTitle(c: LooseCitatie): string {
		return (
			c.target.display_name ??
			`${c.target.bwb_id ?? ''} Art. ${c.target.article_number ?? ''}`.trim()
		);
	}

	function handleClick(c: LooseCitatie, ev: MouseEvent) {
		if (!onNavigate) return;
		ev.preventDefault();
		const { key, collection, bwb_id, article_number } = c.target;
		if (key && collection) {
			onNavigate(collection, key);
		} else if (bwb_id && article_number) {
			onNavigate('instrument_articles', `${bwb_id}_${article_number}`);
		}
	}
</script>

{#each segments as seg, i (i)}{#if seg.kind === 'text'}{seg.content}{:else}{@const href = citeHref(
			seg.cite
		)}{#if href}<a
				class="cite"
				{href}
				title={citeTitle(seg.cite)}
				onclick={(e) => handleClick(seg.cite, e)}>{seg.content}</a
			>{:else}<span
				class="cite cite--noref citation-ref citation-ref--unresolved"
				title="Verwijzing niet beschikbaar">{seg.content}</span
			>{/if}{/if}{/each}

<style>
	.cite {
		color: var(--accent);
		text-decoration: underline;
		text-decoration-style: dotted;
		text-underline-offset: 3px;
		border-bottom: none;
		cursor: pointer;
		padding: 0 1px;
		border-radius: 2px;
		transition: background var(--dur-1) var(--ease);
	}

	.cite:hover {
		background: var(--accent-soft);
		text-decoration-style: solid;
		color: var(--accent);
	}

	.cite--noref {
		cursor: help;
	}

	.citation-ref--unresolved {
		color: var(--ink-2);
		border-bottom: 1px dotted var(--rule-strong);
		cursor: help;
	}
</style>
