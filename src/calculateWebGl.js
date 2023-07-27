/* eslint-disable no-undef */
//https://developer.mozilla.org/en-US/play
//https://github.com/watmough/webgl-matrix-demo/blob/master/gpu_matrix.js#L321

/**
 * calculate Matrices WebGL
 */
export function calculateWebGl(mat1, mat2) {
	if (!("WebGLRenderingContext" in window)) {
		throw new Error("WebGL not supported on this browser.");
	}
	const [matrixSize, , ...firstMatrix] = mat1;
	const [, , ...secondMatrix] = mat2;

	var startTime = performance.now();

	const firstMat = mat4.create();
	const secondMat = mat4.create();

	console.log(firstMat);

	var endTime = performance.now();

	return endTime - startTime;
}
