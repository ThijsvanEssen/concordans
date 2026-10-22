import prettier from 'eslint-config-prettier';
import { fileURLToPath } from 'node:url';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off',
			// Underscore prefix marks an intentionally unused binding.
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
			],
			// The app has no `kit.paths.base`, so plain absolute hrefs are correct. resolve() only matters with a base path.
			'svelte/no-navigation-without-resolve': 'off',
			// Flags every Map/Set/Date, including local scratch values. Reactive collections here are copy-on-write inside $state.
			'svelte/prefer-svelte-reactivity': 'off'
		}
	},
	{
		files: ['**/*.ts', '**/*.svelte', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				// The config of the browser suite stands beside the app, outside its tsconfig.
				projectService: { allowDefaultProject: ['playwright.config.ts'] },
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				// Without the compiler's options: its cssHash is a function, which the cache of
				// ESLint cannot keep, and linting reads no styles.
				svelteConfig: { ...svelteConfig, compilerOptions: undefined }
			}
		},
		rules: {
			// A promise is awaited, handled or marked as left on purpose: `.catch(ignore('…'))` or
			// `.catch((e) => report('…', e))` ($lib/api/errors.ts). A navigation is SvelteKit's to
			// show, a camera animation does not fail, and `afterTick` reports its own.
			'@typescript-eslint/no-floating-promises': [
				'error',
				{
					ignoreVoid: false,
					allowForKnownSafeCalls: [
						{ from: 'package', name: 'goto', package: '@sveltejs/kit' },
						{ from: 'package', name: ['animate', 'animatedReset'], package: 'sigma' }
					]
				}
			]
		}
	},
	{
		// The light layers (a link to a bron, its glyph, the ui, the layout) stay light: the
		// words of a verbinding are in verbonden/relation-words, an address in bron/address. The rows of
		// Verbonden, its filter and the resolver of an address (bron/leesbaar, with its API
		// getters) are for the pages that read them.
		files: ['src/lib/bron/**', 'src/lib/components/ui/**', 'src/lib/components/layout/**'],
		ignores: ['**/*.test.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['**/verbonden/rows', '**/verbonden/filter', '**/bron/leesbaar', './leesbaar'],
							allowTypeImports: true,
							message:
								'Import the pure layer: $lib/verbonden/relation-words, $lib/bron/address, $lib/vocabulary.'
						}
					]
				}
			]
		}
	}
);
