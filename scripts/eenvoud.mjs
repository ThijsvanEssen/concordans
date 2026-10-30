// The simplicity budget: measure what makes the code harder than it needs to be and hold it to
// eenvoud-budget.json, as a ratchet. A measured value may not rise above its budget, and a value
// that fell is written down (--write), so the budget follows it. Raising a budget is a hand edit
// of eenvoud-budget.json, which the diff then shows (--raised REF lists those raises).
//
// What it measures, in src/ and scripts/ without tests and generated code:
// - in src/: the tables per relation (`Record<Relation,`), the files that spell a relation name
//   and the renderers of the first paint (lib/first-paint): each a second place for one idea;
// - per file above its limit: lines; per .svelte: `$effect`s and imports;
// - per file, the highest complexity and the longest function above the ESLint limits
//   (complexity, max-lines-per-function). eslint.config.js reads these as the ceiling of that
//   file, so ESLint stops the growth of a function and this script the slack.
// Usage: node scripts/eenvoud.mjs [--write | --raised REF]
import { ESLint } from 'eslint';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import svelte from 'eslint-plugin-svelte';
import ts from 'typescript-eslint';

const ROOT = new URL('..', import.meta.url).pathname;
const BUDGET = join(ROOT, 'eenvoud-budget.json');
const MAPS = [
	'lines_per_file',
	'effects_per_svelte',
	'imports_per_svelte',
	'complexity',
	'max-lines-per-function'
];

const isSource = (path) =>
	/\.(ts|js|mjs|svelte)$/.test(path) &&
	!/\.test\.ts$/.test(path) &&
	!path.startsWith('src/lib/api/generated/');

function sources(dir) {
	return readdirSync(join(ROOT, dir), { withFileTypes: true, recursive: true })
		.filter((d) => d.isFile())
		.map((d) => relative(ROOT, join(d.parentPath, d.name)))
		.filter(isSource)
		.sort();
}

function relationNames() {
	const api = JSON.parse(readFileSync(join(ROOT, 'src/lib/api/openapi.json'), 'utf8'));
	const relation = api.components.schemas.NodeNeighborhoodEdge.properties.relation;
	return relation.anyOf.find((s) => s.enum).enum;
}

// The highest value per file of an ESLint rule's messages ("complexity of 23", "lines (120)").
async function eslintMaxima(files, limits) {
	const eslint = new ESLint({
		cwd: ROOT,
		overrideConfigFile: true,
		overrideConfig: [
			{ files: ['**/*.ts', '**/*.js'], languageOptions: { parser: ts.parser } },
			...svelte.configs.base,
			{
				files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
				languageOptions: { parserOptions: { parser: ts.parser } }
			},
			{
				linterOptions: { reportUnusedDisableDirectives: 'off' },
				rules: {
					complexity: ['error', limits.complexity],
					'max-lines-per-function': ['error', maxLinesOptions(limits)]
				}
			}
		]
	});
	const found = { complexity: {}, 'max-lines-per-function': {} };
	for (const result of await eslint.lintFiles(files)) {
		const file = relative(ROOT, result.filePath);
		for (const m of result.messages) {
			if (m.fatal) throw new Error(`eenvoud: ${file}: ${m.message}`);
			if (!(m.ruleId in found)) continue;
			const n = Number(
				m.message
					.match(/complexity of (\d+)|lines \((\d+)\)/)
					?.slice(1)
					.find(Boolean)
			);
			found[m.ruleId][file] = Math.max(found[m.ruleId][file] ?? 0, n);
		}
	}
	return found;
}

const maxLinesOptions = (limits) => ({
	max: limits['max-lines-per-function'],
	skipBlankLines: true,
	skipComments: true
});

export async function measure(limits) {
	const files = [...sources('src'), ...sources('scripts')];
	const names = new RegExp(`\\b(${relationNames().join('|')})\\b`);
	const counts = { record_relation_tables: 0, relation_spelling_files: 0, first_paint_files: 0 };
	const maps = Object.fromEntries(MAPS.map((m) => [m, {}]));
	for (const file of files) {
		const text = readFileSync(join(ROOT, file), 'utf8');
		if (file.startsWith('src/')) {
			counts.record_relation_tables += text.match(/Record<Relation,/g)?.length ?? 0;
			if (names.test(text)) counts.relation_spelling_files += 1;
			if (file.startsWith('src/lib/first-paint/')) counts.first_paint_files += 1;
		}
		const per = {
			lines_per_file: text.split('\n').length - 1,
			effects_per_svelte: file.endsWith('.svelte')
				? (text.match(/\$effect(\.pre)?\(/g)?.length ?? 0)
				: 0,
			imports_per_svelte: file.endsWith('.svelte') ? (text.match(/^\s*import\s/gm)?.length ?? 0) : 0
		};
		for (const [m, n] of Object.entries(per)) if (n > limits[m]) maps[m][file] = n;
	}
	Object.assign(maps, await eslintMaxima(files, limits));
	return { counts, ...maps };
}

/** What rose above the budget, and what fell below it. */
function compare(budget, measured) {
	const rose = [];
	const fell = [];
	for (const section of ['counts', ...MAPS]) {
		const allowed = budget[section] ?? {};
		const now = measured[section] ?? {};
		for (const key of [...new Set([...Object.keys(allowed), ...Object.keys(now)])].sort()) {
			const old = allowed[key];
			const n = now[key] ?? 0;
			const line = `${section} ${key}: ${old ?? '-'} -> ${n}`;
			if (old === undefined || n > old) rose.push(line);
			else if (n < old) fell.push(line);
		}
	}
	return { rose, fell };
}

const write = (budget) => writeFileSync(BUDGET, JSON.stringify(budget, null, '\t') + '\n');

async function main(args) {
	const budget = JSON.parse(readFileSync(BUDGET, 'utf8'));
	if (args[0] === '--raised') {
		let base;
		try {
			base = JSON.parse(
				execFileSync('git', ['show', `${args[1]}:eenvoud-budget.json`], {
					cwd: ROOT,
					encoding: 'utf8'
				})
			);
		} catch {
			return 0;
		}
		for (const line of compare(base, budget).rose)
			console.log(`::warning title=eenvoud-toets::budget omhoog: ${line}`);
		return 0;
	}
	const measured = await measure(budget.limits);
	const { rose, fell } = compare(budget, measured);
	for (const line of rose) console.log(`gestegen: ${line}`);
	if (rose.length) {
		console.log(
			'eenvoud: boven het budget. Maak het eenvoudiger, of hoog eenvoud-budget.json met de hand op (zichtbaar in de diff).'
		);
		return 1;
	}
	if (args[0] === '--write') {
		write({ ...budget, ...measured });
		console.log(`eenvoud: budget bijgewerkt (${fell.length} omlaag)`);
		return 0;
	}
	for (const line of fell) console.log(`gedaald: ${line}`);
	if (fell.length) {
		console.log('eenvoud: zet het budget omlaag met scripts/eenvoud.sh --write');
		return 1;
	}
	console.log(`eenvoud: binnen het budget ${JSON.stringify(measured.counts)}`);
	return 0;
}

if (process.argv[1] === new URL(import.meta.url).pathname)
	process.exitCode = await main(process.argv.slice(2));
