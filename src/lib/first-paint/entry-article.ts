// The script of the first paint of an article (entry.ts): the server inlines it in an
// article's page.
import { articlePaint } from './article';
import type { Build } from './classes';
import { paint } from './paint';

declare const __FIRST_PAINT__: Build;

paint(document, __FIRST_PAINT__, { article: articlePaint });
