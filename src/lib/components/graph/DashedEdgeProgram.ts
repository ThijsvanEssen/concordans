// Custom sigma programs for the lines of the Netwerkcanvas (Lijnen): slightly curved, solid, dashed,
// dotted or dash-dot, each with an arrowhead of `netwerk-pijl` times its thickness (except Lid van,
// which has no direction). The body is a quadratic bezier whose control point stands 0,12 of the
// line's length beside its middle (BEND, as the Design System draws it); the distance to the
// curve is found per pixel in the fragment shader, after @sigma/edge-curve (MIT), which this file
// extends with a dash pattern along the curve and an arrowhead of our own proportions.
// The arrowhead is a taper of the thickness near the target: it starts at the edge of the target
// node and is `pijl` diktes long (a `pijl` of 0 draws none).

import { EdgeProgram } from 'sigma/rendering';
import { floatColor } from 'sigma/utils';
import { AIR, ARROW_WIDTH, BEND, DOT_RADIUS } from '$lib/graph/line-shape';
import type { RenderParams } from 'sigma/types';
import type { NodeDisplayData, EdgeDisplayData } from 'sigma/types';

// ── Shaders ───────────────────────────────────────────────────────────────────
const VERTEX = /* glsl */ `
attribute vec4 a_id;
attribute vec4 a_color;
attribute float a_direction;
attribute float a_thickness;
attribute vec2 a_source;
attribute vec2 a_target;
attribute float a_current;
attribute float a_targetSize;
attribute float a_sourceSize;

uniform mat3 u_matrix;
uniform float u_sizeRatio;
uniform float u_pixelRatio;
uniform vec2 u_dimensions;
uniform float u_minEdgeThickness;
uniform float u_feather;
uniform float u_curvature;
uniform float u_widenessToThicknessRatio;
uniform float u_dot;

varying vec4 v_color;
varying float v_thickness;
varying float v_feather;
varying vec2 v_cpA;
varying vec2 v_cpB;
varying vec2 v_cpC;
varying float v_targetSize;
varying vec2 v_dot;
varying float v_dotR;

const float bias = 255.0 / 254.0;
const float epsilon = 0.7;

vec2 clipspaceToViewport(vec2 pos, vec2 dimensions) {
  return vec2((pos.x + 1.0) * dimensions.x / 2.0, (pos.y + 1.0) * dimensions.y / 2.0);
}
vec2 viewportToClipspace(vec2 pos, vec2 dimensions) {
  return vec2(pos.x / dimensions.x * 2.0 - 1.0, pos.y / dimensions.y * 2.0 - 1.0);
}

void main() {
  vec2 position = a_source * max(0.0, a_current) + a_target * max(0.0, 1.0 - a_current);
  position = (u_matrix * vec3(position, 1)).xy;
  vec2 source = (u_matrix * vec3(a_source, 1)).xy;
  vec2 target = (u_matrix * vec3(a_target, 1)).xy;

  vec2 viewportPosition = clipspaceToViewport(position, u_dimensions);
  vec2 viewportSource = clipspaceToViewport(source, u_dimensions);
  vec2 viewportTarget = clipspaceToViewport(target, u_dimensions);

  vec2 delta = viewportTarget.xy - viewportSource.xy;
  float len = length(delta);
  vec2 normal = vec2(-delta.y, delta.x) * a_direction;
  vec2 unitNormal = normal / len;
  float boundingBoxThickness = len * u_curvature;

  float curveThickness = max(u_minEdgeThickness, a_thickness / u_sizeRatio);
  v_thickness = curveThickness * u_pixelRatio;
  v_feather = u_feather;

  v_cpA = viewportSource;
  v_cpB = 0.5 * (viewportSource + viewportTarget) + unitNormal * a_direction * boundingBoxThickness;
  v_cpC = viewportTarget;

  vec2 viewportOffsetPosition = (
    viewportPosition +
    unitNormal * (boundingBoxThickness / 2.0 + sign(boundingBoxThickness) * (curveThickness * max(1.0, u_widenessToThicknessRatio) + epsilon)) *
    max(0.0, a_direction)
  );

  gl_Position = vec4(viewportToClipspace(viewportOffsetPosition, u_dimensions), 0, 1);
  v_targetSize = a_targetSize * u_pixelRatio / u_sizeRatio;
  // The dot of Ingediend door: on the curve's start, LUCHT beyond the edge of the one who submits.
  v_dot = v_cpA + normalize(v_cpB - v_cpA) * (a_sourceSize * u_pixelRatio / u_sizeRatio + ${AIR.toFixed(1)} * u_pixelRatio);
  v_dotR = u_dot * u_pixelRatio;

  #ifdef PICKING_MODE
  v_color = a_id;
  #else
  v_color = a_color;
  #endif
  v_color.a *= bias;
}
`;

// The fragment shader finds the point of the curve nearest to the pixel (and its parameter t),
// tapers the thickness into an arrowhead near the target, and for a broken line discards the
// unlit stretches of each repeat (`lit`, fractions of one repeat) along t, but not in the
// arrowhead. A 75/25 split keeps thin edges readable; hard edges keep the colour on screen
// exactly the colour passed.
const fragment = (dash: Dash | null) => /* glsl */ `
precision highp float;

varying vec4 v_color;
varying float v_thickness;
varying float v_feather;
varying vec2 v_cpA;
varying vec2 v_cpB;
varying vec2 v_cpC;
varying float v_targetSize;
varying vec2 v_dot;
varying float v_dotR;
uniform float u_lengthToThicknessRatio;
uniform float u_widenessToThicknessRatio;

float det(vec2 a, vec2 b) {
  return a.x * b.y - b.x * a.y;
}

// The nearest point of the bezier to the origin, in .xy, and its parameter in .z.
vec3 getDistanceVector(vec2 b0, vec2 b1, vec2 b2) {
  float a = det(b0, b2), b = 2.0 * det(b1, b0), d = 2.0 * det(b2, b1);
  float f = b * d - a * a;
  vec2 d21 = b2 - b1, d10 = b1 - b0, d20 = b2 - b0;
  vec2 gf = 2.0 * (b * d21 + d * d10 + a * d20);
  gf = vec2(gf.y, -gf.x);
  vec2 pp = -f * gf / dot(gf, gf);
  vec2 d0p = b0 - pp;
  float ap = det(d0p, d20), bp = 2.0 * det(d10, d0p);
  float t = clamp((ap + bp) / (2.0 * a + b + d), 0.0, 1.0);
  return vec3(mix(mix(b0, b1, t), mix(b1, b2, t), t), t);
}

void main(void) {
  vec2 p = gl_FragCoord.xy;
  vec3 nearest = getDistanceVector(v_cpA - p, v_cpB - p, v_cpC - p);
  float dist = length(nearest.xy);
  float thickness = v_thickness;
  bool inHead = false;
  float distToTarget = length(p - v_cpC);
  float arrowLength = v_targetSize + thickness * u_lengthToThicknessRatio;
  if (u_lengthToThicknessRatio > 0.0 && distToTarget < arrowLength) {
    thickness = (distToTarget - v_targetSize) / (arrowLength - v_targetSize) * u_widenessToThicknessRatio * thickness;
    inHead = true;
  }
  float halfThickness = thickness / 2.0;
  bool onDot = v_dotR > 0.0 && length(p - v_dot) < v_dotR;
  if (dist >= halfThickness && !onDot) discard;
  #ifdef PICKING_MODE
  gl_FragColor = v_color;
  #else
  ${
		dash
			? `
  float pos = fract(nearest.z * ${dash.repeats.toFixed(1)});
  if (!inHead && !onDot && !(${dash.lit.map(([a, b]) => `(pos >= ${a.toFixed(3)} && pos < ${b.toFixed(3)})`).join(' || ')})) discard;`
			: ''
	}
  float t = onDot ? 0.0 : smoothstep(halfThickness - v_feather, halfThickness, dist);
  gl_FragColor = mix(v_color, vec4(0.0), t);
  #endif
}
`;

type Dash = { repeats: number; lit: readonly (readonly [number, number])[] };

const UNIFORMS = [
	'u_matrix',
	'u_sizeRatio',
	'u_dimensions',
	'u_pixelRatio',
	'u_feather',
	'u_minEdgeThickness',
	'u_curvature',
	'u_lengthToThicknessRatio',
	'u_widenessToThicknessRatio',
	'u_dot'
] as const;

type Uniform = (typeof UNIFORMS)[number];

// ── Program class ─────────────────────────────────────────────────────────────
function createCurveProgram(pijl: number, dash: Dash | null, dot = false) {
	return class CurvedEdgeProgram extends EdgeProgram<Uniform> {
		getDefinition() {
			return {
				VERTICES: 6,
				VERTEX_SHADER_SOURCE: VERTEX,
				FRAGMENT_SHADER_SOURCE: fragment(dash),
				METHOD: WebGLRenderingContext.TRIANGLES,
				UNIFORMS,
				ATTRIBUTES: [
					{ name: 'a_source', size: 2, type: WebGLRenderingContext.FLOAT },
					{ name: 'a_target', size: 2, type: WebGLRenderingContext.FLOAT },
					{ name: 'a_targetSize', size: 1, type: WebGLRenderingContext.FLOAT },
					{ name: 'a_sourceSize', size: 1, type: WebGLRenderingContext.FLOAT },
					{ name: 'a_thickness', size: 1, type: WebGLRenderingContext.FLOAT },
					{ name: 'a_color', size: 4, type: WebGLRenderingContext.UNSIGNED_BYTE, normalized: true },
					{ name: 'a_id', size: 4, type: WebGLRenderingContext.UNSIGNED_BYTE, normalized: true }
				],
				CONSTANT_ATTRIBUTES: [
					{ name: 'a_current', size: 1, type: WebGLRenderingContext.FLOAT },
					{ name: 'a_direction', size: 1, type: WebGLRenderingContext.FLOAT }
				],
				CONSTANT_DATA: [
					[0, 1],
					[0, -1],
					[1, 1],
					[0, -1],
					[1, 1],
					[1, -1]
				]
			};
		}

		processVisibleItem(
			edgeIndex: number,
			startIndex: number,
			sourceData: NodeDisplayData,
			targetData: NodeDisplayData,
			data: EdgeDisplayData
		): void {
			const arr = this.array;
			arr[startIndex++] = sourceData.x;
			arr[startIndex++] = sourceData.y;
			arr[startIndex++] = targetData.x;
			arr[startIndex++] = targetData.y;
			arr[startIndex++] = (targetData.size as number) || 1;
			arr[startIndex++] = (sourceData.size as number) || 1;
			arr[startIndex++] = (data.size as number) || 1;
			arr[startIndex++] = floatColor((data.color as string) || '#000000');
			arr[startIndex++] = edgeIndex;
		}

		setUniforms(
			params: RenderParams,
			{
				gl,
				uniformLocations
			}: { gl: WebGLRenderingContext; uniformLocations: Record<string, WebGLUniformLocation> }
		): void {
			const u = uniformLocations;
			gl.uniformMatrix3fv(u['u_matrix'], false, params.matrix);
			gl.uniform1f(u['u_pixelRatio'], params.pixelRatio);
			gl.uniform1f(u['u_sizeRatio'], params.sizeRatio);
			gl.uniform1f(u['u_feather'], params.antiAliasingFeather);
			gl.uniform2f(
				u['u_dimensions'],
				params.width * params.pixelRatio,
				params.height * params.pixelRatio
			);
			gl.uniform1f(u['u_minEdgeThickness'], params.minEdgeThickness);
			gl.uniform1f(u['u_curvature'], BEND);
			gl.uniform1f(u['u_dot'], dot ? DOT_RADIUS : 0);
			gl.uniform1f(u['u_lengthToThicknessRatio'], pijl);
			gl.uniform1f(u['u_widenessToThicknessRatio'], pijl * ARROW_WIDTH);
		}
	};
}

/**
 * The programs of the lines, each curved by BEND and with an arrowhead of `pijl` times the line's
 * thickness long (--netwerk-pijl), except `lid`, which has none (Lid van has no direction). The
 * patterns are those of Netwerkcanvas, Lijnen, as fractions of one repeat: `dashed` a stroke of 4
 * and a gap of 3, `dotted` 1.5 and 3.5, `dashdot` 9, 3, 1.5, 3.
 */
export function stippelProgrammas(pijl: number) {
	const dash = (repeats: number, lit: Dash['lit'], kop = pijl) =>
		createCurveProgram(kop, { repeats, lit });
	return {
		arrow: createCurveProgram(pijl, null),
		submitter: createCurveProgram(pijl, null, true),
		dashed: dash(6, [[0, 4 / 7]]),
		dotted: dash(16, [[0, 0.3]]),
		dashdot: dash(6, [
			[0, 9 / 16.5],
			[12 / 16.5, 13.5 / 16.5]
		]),
		lid: dash(16, [[0, 0.3]], 0)
	};
}
