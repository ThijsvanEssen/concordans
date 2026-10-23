// The script of the first paint of a Kamerstuk (entry.ts): the server inlines it in its page.
import type { Build } from './classes';
import { paint } from './paint';
import { paperPaint } from './paper';

declare const __FIRST_PAINT__: Build;

paint(document, __FIRST_PAINT__, { paper: paperPaint });
