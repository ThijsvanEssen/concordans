// The script the server inlines after the bron it puts in a reader's page (paint.ts), for every
// kind of bron: a server that inlines one script for all pages takes this one. The build gives
// it the classes and the stylesheets of the app (vite.config.ts).
import { articlePaint } from './article';
import type { Build } from './classes';
import { judgmentColumn } from './judgment';
import { lawPaint } from './law';
import { paperPaint } from './paper';
import { paint } from './paint';

declare const __FIRST_PAINT__: Build;

paint(document, __FIRST_PAINT__, {
	article: articlePaint,
	judgment: judgmentColumn,
	law: lawPaint,
	paper: paperPaint
});
