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
	//https://github.com/toji/gl-matrix
	//https://www.creativebloq.com/javascript/get-started-webgl-draw-square-7112981
	const gl = document
		.createElement("canvas")
		.getContext("experimental-webgl", { antialias: false });

	/**
	 * draw geometry
	 */
	// vertices Array [(x,y),(x,y)....] for corners of square
	const vertices = new Float32Array([
		// first point
		0, 0,
		// second point
		1, 0,
		// third point
		1, 1,
		// fourth point
		0, 1,
	]);

	//vertex gets called for every vertex to render (here: every pixel)
	const vertexShaderSource = `
		attribute vec2 firstMatrix;
		//add instance for coordinates

		void main() {
			gl_Position = vec4(firstMatrix, 0, 1);
			gl_PointSize = 1.0;
		}
	`;

	//fragment gets called for every pixel and outputs first solution as float
	const fragmentShaderSource = `
		precision mediump float;
		uniform float u_array[${firstMatrix[0] * secondMatrix[1]}];

		void main() {
			1, 0, 0, gl_FragColor = vec4(u_array[gl_FragCoord.x * ${
				firstMatrix[0]
			} + gl_FragCoord.y]);
		}
	`;

	// create vertex shader
	var vertexShader = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vertexShader, vertexShaderSource);
	gl.compileShader(vertexShader);

	// create fragment shader
	var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fragmentShader, fragmentShaderSource);
	gl.compileShader(fragmentShader);

	// create program
	const program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);

	// use program
	gl.useProgram(program);

	// create vertex buffer
	const vertexBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

	// get uniform location
	const u_arrayLocation = gl.getUniformLocation(program, "u_array");

	// bind uniform
	gl.uniform1fv(u_arrayLocation, new Float32Array(matrixSize * matrixSize));

	// draw
	gl.drawArrays(gl.POINTS, 0, matrixSize * matrixSize);

	// read result
	const result = new Float32Array(matrixSize * matrixSize * 4);
	gl.readPixels(0, 0, matrixSize, matrixSize, gl.RGBA, gl.FLOAT, result);

	console.log(result);

	var endTime = performance.now();

	return endTime - startTime;
}
