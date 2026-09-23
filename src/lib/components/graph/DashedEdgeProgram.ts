// Custom sigma programs for dashed and dotted edges (a proposed change, a vote; PART_OF).
// Extends sigma's EdgeClampedProgram body with a dash pattern in the fragment
// shader, then compounds it with EdgeArrowHeadProgram for the arrowhead.
// The `v_positionCoef` varying (0 = source, 1 = target) drives the dash logic.

import { EdgeProgram, EdgeArrowHeadProgram, createEdgeCompoundProgram } from 'sigma/rendering';
import { floatColor } from 'sigma/utils';
import type { RenderParams } from 'sigma/types';
import type { NodeDisplayData, EdgeDisplayData } from 'sigma/types';

// ── Shaders ───────────────────────────────────────────────────────────────────
// Identical to sigma's EdgeClampedProgram vertex shader but adds the
// `v_positionCoef` varying so the fragment shader can implement dashing.
const VERTEX = /* glsl */ `
attribute vec4 a_id;
attribute vec4 a_color;
attribute vec2 a_normal;
attribute float a_normalCoef;
attribute vec2 a_positionStart;
attribute vec2 a_positionEnd;
attribute float a_positionCoef;
attribute float a_radius;
attribute float a_radiusCoef;

uniform mat3 u_matrix;
uniform float u_zoomRatio;
uniform float u_sizeRatio;
uniform float u_pixelRatio;
uniform float u_correctionRatio;
uniform float u_minEdgeThickness;
uniform float u_lengthToThicknessRatio;
uniform float u_feather;

varying vec4 v_color;
varying vec2 v_normal;
varying float v_thickness;
varying float v_feather;
varying float v_positionCoef;

const float bias = 255.0 / 254.0;

void main() {
  float radius = a_radius * a_radiusCoef;
  vec2 normal = a_normal * a_normalCoef;
  vec2 position = a_positionStart * (1.0 - a_positionCoef) + a_positionEnd * a_positionCoef;

  float normalLength = length(normal);
  vec2 unitNormal = normal / normalLength;

  float pixelsThickness = max(normalLength, u_minEdgeThickness * u_sizeRatio);
  float webGLThickness = pixelsThickness * u_correctionRatio / u_sizeRatio;

  float direction = sign(radius);
  float webGLNodeRadius = direction * radius * 2.0 * u_correctionRatio / u_sizeRatio;
  float webGLArrowHeadLength = webGLThickness * u_lengthToThicknessRatio * 2.0;
  vec2 compensation = vec2(-direction * unitNormal.y, direction * unitNormal.x)
                    * (webGLNodeRadius + webGLArrowHeadLength);

  gl_Position = vec4(
    (u_matrix * vec3(position + unitNormal * webGLThickness + compensation, 1)).xy,
    0, 1
  );

  v_thickness    = webGLThickness / u_zoomRatio;
  v_normal       = unitNormal;
  v_feather      = u_feather * u_correctionRatio / u_zoomRatio / u_pixelRatio * 2.0;
  v_positionCoef = a_positionCoef;

  #ifdef PICKING_MODE
  v_color = a_id;
  #else
  v_color = a_color;
  #endif
  v_color.a *= bias;
}
`;

// Fragment shader with a dash pattern: `dashes` per edge, `on` the lit fraction.
// A 75/25 split keeps thin edges readable; 1-pixel-stair edges are the price of
// hard-edge rendering, which keeps the colour on screen exactly the colour passed.
const fragment = (dashes: number, on: number) => /* glsl */ `
precision mediump float;

varying vec4 v_color;
varying vec2 v_normal;
varying float v_thickness;
varying float v_positionCoef;

void main(void) {
  #ifdef PICKING_MODE
  gl_FragColor = v_color;
  #else
  float pos = fract(v_positionCoef * ${dashes.toFixed(1)});
  if (pos > ${on.toFixed(2)}) discard;

  float dist = length(v_normal) * v_thickness;
  if (dist > v_thickness) discard;
  gl_FragColor = v_color;
  #endif
}
`;

const UNIFORMS = [
	'u_matrix',
	'u_zoomRatio',
	'u_sizeRatio',
	'u_correctionRatio',
	'u_pixelRatio',
	'u_feather',
	'u_minEdgeThickness',
	'u_lengthToThicknessRatio'
] as const;

type Uniform = (typeof UNIFORMS)[number];

// ── Program class ─────────────────────────────────────────────────────────────
function createBodyProgram(dashes: number, on: number) {
	return class DashedEdgeBodyProgram extends EdgeProgram<Uniform> {
		getDefinition() {
			return {
				VERTICES: 6,
				VERTEX_SHADER_SOURCE: VERTEX,
				FRAGMENT_SHADER_SOURCE: fragment(dashes, on),
				METHOD: WebGLRenderingContext.TRIANGLES,
				UNIFORMS,
				ATTRIBUTES: [
					{ name: 'a_positionStart', size: 2, type: WebGLRenderingContext.FLOAT },
					{ name: 'a_positionEnd', size: 2, type: WebGLRenderingContext.FLOAT },
					{ name: 'a_normal', size: 2, type: WebGLRenderingContext.FLOAT },
					{ name: 'a_color', size: 4, type: WebGLRenderingContext.UNSIGNED_BYTE, normalized: true },
					{ name: 'a_id', size: 4, type: WebGLRenderingContext.UNSIGNED_BYTE, normalized: true },
					{ name: 'a_radius', size: 1, type: WebGLRenderingContext.FLOAT }
				],
				CONSTANT_ATTRIBUTES: [
					{ name: 'a_positionCoef', size: 1, type: WebGLRenderingContext.FLOAT },
					{ name: 'a_normalCoef', size: 1, type: WebGLRenderingContext.FLOAT },
					{ name: 'a_radiusCoef', size: 1, type: WebGLRenderingContext.FLOAT }
				],
				CONSTANT_DATA: [
					[0, 1, 0],
					[0, -1, 0],
					[1, 1, 1],
					[1, 1, 1],
					[0, -1, 0],
					[1, -1, -1]
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
			const thickness = (data.size as number) || 1;
			const x1 = sourceData.x,
				y1 = sourceData.y;
			const x2 = targetData.x,
				y2 = targetData.y;
			const color = floatColor((data.color as string) || '#000000');

			const dx = x2 - x1,
				dy = y2 - y1;
			const radius = (targetData.size as number) || 1;
			let len = dx * dx + dy * dy;
			let n1 = 0,
				n2 = 0;
			if (len) {
				len = 1 / Math.sqrt(len);
				n1 = -dy * len * thickness;
				n2 = dx * len * thickness;
			}

			const arr = this.array;
			arr[startIndex++] = x1;
			arr[startIndex++] = y1;
			arr[startIndex++] = x2;
			arr[startIndex++] = y2;
			arr[startIndex++] = n1;
			arr[startIndex++] = n2;
			arr[startIndex++] = color;
			arr[startIndex++] = edgeIndex;
			arr[startIndex++] = radius;
		}

		setUniforms(
			params: RenderParams,
			{
				gl,
				uniformLocations
			}: { gl: WebGLRenderingContext; uniformLocations: Record<string, WebGLUniformLocation> }
		): void {
			gl.uniformMatrix3fv(uniformLocations['u_matrix'], false, params.matrix);
			gl.uniform1f(uniformLocations['u_zoomRatio'], params.zoomRatio);
			gl.uniform1f(uniformLocations['u_sizeRatio'], params.sizeRatio);
			gl.uniform1f(uniformLocations['u_correctionRatio'], params.correctionRatio);
			gl.uniform1f(uniformLocations['u_pixelRatio'], params.pixelRatio);
			gl.uniform1f(uniformLocations['u_feather'], params.antiAliasingFeather);
			gl.uniform1f(uniformLocations['u_minEdgeThickness'], params.minEdgeThickness);
			gl.uniform1f(uniformLocations['u_lengthToThicknessRatio'], 2.5);
		}
	};
}

/** Six dashes per edge: a proposed change, a vote. */
export const DashedEdgeArrowProgram = createEdgeCompoundProgram([
	createBodyProgram(6, 0.75) as never,
	EdgeArrowHeadProgram
]);

/** Sixteen short dashes per edge: PART_OF. */
export const DottedEdgeArrowProgram = createEdgeCompoundProgram([
	createBodyProgram(16, 0.4) as never,
	EdgeArrowHeadProgram
]);
