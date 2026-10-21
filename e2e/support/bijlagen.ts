// The text of a bijlage as API 0.80.1 gives it once the BWB is read anew (`normalize bwb`,
// #870): until that run on prod the live API has its bijlagen as `Annex 1`, without a text.
// These patch the recorded answers with what the parser of 0.80.1 makes of the toestand
// (Cyberbeveiligingswet Bijlage 1, Opiumwet Lijst I); they go when the run has been.
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { patchApi } from './api';

type Annex = { annex: Record<string, unknown>; references: unknown[] };

const read = (key: string): Annex =>
	JSON.parse(
		readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'bijlagen', `${key}.json`), 'utf8')
	);

/** The bijlagen of `bwb` read anew: in its table of contents and in their reader; `change`
 *  makes of a bijlage's answer what a later API gives (its footnotes, #875). */
export async function bijlagenGelezen(
	page: Page,
	bwb: string,
	keys: string[],
	change: (body: Record<string, unknown>) => Record<string, unknown> = (body) => body
) {
	const read_ = new Map(keys.map((k) => [k, read(k)]));
	await patchApi(page, new RegExp(`^/api/instruments/${bwb}/articles\\?`), (body) => ({
		...body,
		annexes: (body.annexes as { key: string }[]).map((a) => {
			const own = read_.get(a.key)?.annex;
			return own
				? {
						...a,
						display_name: own.display_name,
						title: own.title,
						text_preview: String(own.text).slice(0, 1)
					}
				: a;
		})
	}));
	for (const [key, own] of read_)
		await patchApi(page, new RegExp(`^/api/annexes/${key}$`), (body) =>
			change({
				...body,
				annex: { ...(body.annex as object), ...own.annex },
				references: own.references
			})
		);
}
