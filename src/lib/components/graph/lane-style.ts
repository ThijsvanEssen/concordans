// The look of the lines on the lanes: colour, dash, head, and what a line says on hover.
import { relationLabel } from '$lib/verbonden/relation-words';
import { formatCount } from '$lib/text/getal';
import { arrowHead, longestRunMiddle } from '$lib/graph/line-shape';
import { LINE_KIND_STYLE } from '$lib/graph/line-kind';
import type { Scene, SceneUnit } from '$lib/graph/scene';
import type { GraphNode } from '$lib/graph/types';
import type { LanePath } from '$lib/graph/lane-lines';
import { laneLineColour } from '$lib/graph/line-strength';
import { arrowLength, edgeCapFor, edgeDashFor, tokens } from './nodeSprites';

/** What a line says on hover, in the words of the canvas: "haalt aan, 3 keer, voorgesteld". */
function lineLabel(
	line: Scene['lines'][number],
	byId: ReadonlyMap<string, GraphNode>,
	unitOf: ReadonlyMap<string, SceneUnit>
): string {
	const from = byId.get(unitOf.get(line.from)?.members[0] ?? '')?.collection ?? null;
	const to = byId.get(unitOf.get(line.to)?.members[0] ?? '')?.collection ?? null;
	const parts = [relationLabel(line.relation, from, to)];
	if (line.count > 1) parts.push(`${formatCount(line.count)} keer`);
	if (line.proposed) parts.push('voorgesteld');
	return parts.join(', ');
}

function lineColour(line: Scene['lines'][number] | undefined) {
	const style = line ? LINE_KIND_STYLE[line.kind] : null;
	if (!style) return 'var(--ink-3)';
	const t = tokens();
	return laneLineColour(t[style.colour], t.paper, line!.proposed ? 'licht' : style.tone);
}

export const styledLines = (
	paths: readonly LanePath[],
	scene: Scene,
	byId: ReadonlyMap<string, GraphNode>,
	unitOf: ReadonlyMap<string, SceneUnit>
) =>
	paths.map((p) => {
		const line = scene.lines.find((l) => l.id === p.id);
		return {
			...p,
			colour: lineColour(line),
			dash: edgeDashFor(p.stroke),
			cap: edgeCapFor(p.stroke),
			head: arrowHead(p, arrowLength()),
			label: line ? lineLabel(line, byId, unitOf) : null,
			at: longestRunMiddle(p.points)
		};
	});
