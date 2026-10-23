// The script of the first paint of a law (entry.ts): the server inlines it in a law's page.
import type { Build } from './classes';
import { lawPaint } from './law';
import { paint } from './paint';

declare const __FIRST_PAINT__: Build;

paint(document, __FIRST_PAINT__, { law: lawPaint });
