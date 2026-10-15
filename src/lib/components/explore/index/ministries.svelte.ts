// A ministry by its name (`Financiën` for `fin`), from the list the API gives, asked for once
// on first use. Until the list is in, or where it failed, a key stands for itself.
import { report } from '$lib/api/errors';
import { onForget } from '$lib/util/forget';
import { getMinistries } from '$lib/api/government';

let names = $state<Map<string, string>>(new Map());
let asked = false;
onForget(() => {
	names = new Map();
	asked = false;
});

export function ministryName(key: string | null | undefined): string {
	if (!asked) {
		asked = true;
		getMinistries().then(
			(list) => (names = new Map(list.map((m) => [m.key, m.name]))),
			(e) => {
				asked = false;
				report('Ministeries', e);
			}
		);
	}
	return (key && names.get(key)) || key || '';
}
