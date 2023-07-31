export class Matrix {
	constructor(r, c, data) {
		this.r = r;
		this.c = c;
		this.data = data;
		this.__gpumatrix__ = undefined;
	}

	multiply(matrix) {
		if (
			this.c != matrix.c ||
			this.data === undefined ||
			matrix.data === undefined
		) {
			throw "error: non-matching matrix or missing data";
		}
		return this._multiply(this, matrix);
	}

	_checkinit(r, c) {
		var canvas = document.getElementById("mycanvas");
		canvas.height = r;
		canvas.width = c;
		if (this.__gpumatrix__ === undefined) {
			console.log("getting webgl");
			// get webgl context
			this.__gpumatrix__ = canvas.getContext("webgl", {
				premultipliedAlpha: false,
				preserveDrawingBuffer: false,
			});
			if (this.__gpumatrix__ === undefined) throw "webgl is not supported.";
			// must support float texture
			var ext;
			try {
				ext = this.__gpumatrix__.getExtension("OES_texture_float");
			} catch (e) {}
			if (!ext) {
				console.log("Your webgl does not support OES_texture_float extension.");
			}
		}
		// set viewport to rows, columns
		//console.log("this.__gpumatrix__ " + this.__gpumatrix__);
		this.__gpumatrix__.viewport(0, 0, c, r);
		return this.__gpumatrix__;
	}

	_texelsFromMatrices(m1, m2, r, c) {
		// dimensions
		var r1 = m1.r,
			c1 = m1.c,
			r2 = m2.r,
			c2 = m2.c;
		var r = Math.max(r1, r2);
		var c = Math.max(c1, c2);
		var texelcount = r * c;
		// get texel data (rgb) as a Float32Array
		var texels = new Float32Array(3 * texelcount);
		var d1 = m1.data;
		var d2 = m2.data;
		// special case if same dimensions
		if (r1 === r2 && c1 === c2) {
			// copy m1 to .r and m2 to .g
			var dst = 0,
				src1 = 0,
				src2 = 0;
			do {
				texels[dst++] = d1[src1++];
				texels[dst++] = d2[src2++];
				dst++;
			} while (--texelcount);
		} else {
			// copy long and short dimensions
			var row = 0,
				col = 0;
			var src1 = 0;
			do {
				texels[(row * c1 + col) * 3] = d1[src1++];
				texels[(col * r2 + row) * 3 + 1] = d2[col * r2 + row];
				if (col >= c1) {
					col = 0;
					row++;
				}
			} while (--texelcount);
		}
		return texels;
	}

	// SUPPORTS FLOAT MATRIX -> RGBA BYTE
	// ### DOES NOT SUPPORT NON-SQUARE MATRICES
	_texelsFromMatrix(m, r, c) {
		// dimensions
		var texelcount = m.r * m.c;
		var buffer = new ArrayBuffer(4 * texelcount);
		// get texel data (rgba) as a Float32Array
		var texels = new Float32Array(buffer);
		// copy data to Float32Array, ...
		var dst = 0,
			src1 = 0,
			src2 = 0;
		do {
			texels[dst++] = m.data[src1++];
		} while (--texelcount);
		// ..., then return as IEEE754 bytes
		return new Uint8Array(buffer);
	}

	// bind passed textureUNIT to passed matrix
	_bindSingleSrcTexture(gl, renderer, m, textureUNIT, sampler) {
		// get float array data for texture to multiply
		var texels = this._texelsFromMatrix(m);
		// create the texture from our 4 bytes/texel (IEEE754)
		var texture = gl.createTexture();
		gl.activeTexture(textureUNIT);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(
			gl.TEXTURE_2D,
			/*level*/ 0,
			gl.RGBA,
			m.c,
			m.r,
			0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			texels
		);
		// clamp to edge to support non-power of two textures
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		// don't interpolate when getting data from texture
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		// set up the appropriate sampler
		sampler = gl.getUniformLocation(renderer, sampler);
		gl.uniform1i(sampler, textureUNIT - gl.TEXTURE0);
		return texture;
	}

	// get the canvas to render to
	_createRenderCanvas() {
		var rendercanvas = document.getElementById("mycanvas");
		return rendercanvas;
	}

	// bind destination texture
	_createDstTexture(gl, rendercanvas) {
		// create and bind texture to render to
		var dstTex = gl.createTexture();
		gl.activeTexture(gl.TEXTURE2);
		gl.bindTexture(gl.TEXTURE_2D, dstTex);
		gl.texImage2D(
			gl.TEXTURE_2D,
			/*level*/ 0,
			gl.RGBA,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			rendercanvas
		);
		return dstTex;
	}

	// bind a framebuffer, renderbuffer, texture
	_bindFramebuffer(gl, dstTex, m1, m2) {
		// create and bind renderbuffer
		this.renderbuffer = this.renderbuffer || gl.createRenderbuffer();
		gl.bindRenderbuffer(gl.RENDERBUFFER, null);
		gl.bindRenderbuffer(gl.RENDERBUFFER, this.renderbuffer);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, m2.c, m1.r);
		// create and bind framebuffer
		this.framebuffer = this.framebuffer || gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
		gl.framebufferTexture2D(
			gl.FRAMEBUFFER,
			gl.COLOR_ATTACHMENT0,
			gl.TEXTURE_2D,
			dstTex,
			/*level*/ 0
		);
		gl.framebufferRenderbuffer(
			gl.FRAMEBUFFER,
			gl.DEPTH_ATTACHMENT,
			gl.RENDERBUFFER,
			this.renderbuffer
		);
		return this.framebuffer;
	}

	// build the glslang program to do the matrix multiply
	_buildRenderer(gl) {
		// get compiled shaders
		var vertShader = this._getShader(gl, "x-shader/x-vertex", _vertexShader);
		var fragShader = this._getShader(gl, "x-shader/x-fragment", _shader_RGBA);

		// link into a program
		var renderer = gl.createProgram();
		gl.attachShader(renderer, vertShader);
		gl.attachShader(renderer, fragShader);
		gl.linkProgram(renderer);
		gl.useProgram(renderer);
		return renderer;
	}

	// setup required to draw a square to our vertex shader and have
	// fragment shader called for each pixel
	_bindVertices(gl, renderer) {
		// bind vertices
		var aPos = gl.getAttribLocation(renderer, "aPos");
		var vertexBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
		var vertices = [
			-1.0, -1.0, 0.0, 1.0, -1.0, 0.0, 1.0, 1.0, 0.0, -1.0, 1.0, 0.0,
		];
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
		gl.vertexAttribPointer(aPos, /*item size*/ 3, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(aPos);

		// bind texture cords
		var aTex = gl.getAttribLocation(renderer, "aTex");
		var texCoords = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, texCoords);
		var textureCoords = [0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0];
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array(textureCoords),
			gl.STATIC_DRAW
		);
		gl.vertexAttribPointer(aTex, /*item size*/ 2, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(aTex);

		// index to vertices
		var indices = gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
		var vertexIndices = [0, 1, 2, 0, 2, 3];
		gl.bufferData(
			gl.ELEMENT_ARRAY_BUFFER,
			new Uint16Array(vertexIndices),
			gl.STATIC_DRAW
		);
	}

	// set up vars for the shaders
	_bindUniforms(gl, renderer, m1, m2) {
		// get var locations
		var length = gl.getUniformLocation(renderer, "uLength");
		var outR = gl.getUniformLocation(renderer, "uOutRows");
		var outC = gl.getUniformLocation(renderer, "uOutCols");
		var stepS = gl.getUniformLocation(renderer, "uStepS");
		var stepT = gl.getUniformLocation(renderer, "uStepT");
		// bind length of one multiply run
		gl.uniform1i(length, m1.c);
		// bind output size
		// 3x1 x 1x2  -> 3x2  input and output canvas/texture
		// [2] x [1 1] = [2 2] called for each point in *output* texture
		// [3]			 [3 3]
		// [5]			 [5 5]
		gl.uniform1f(outR, m1.r);
		gl.uniform1f(outC, m2.c);
		// bind step size for input texture
		// 3x10 x 10x2 -> 3x2 output, but requires 10x10 *input* texture
		gl.uniform1f(stepS, 1 / Math.max(m1.c, m2.c));
		gl.uniform1f(stepT, 1 / Math.max(m1.r, m2.r));
	}

	// multiply m1 x m2
	_multiply(m1, m2) {
		var startTime = performance.now();
		// get the basics up and running
		var rawbuffer = new ArrayBuffer(m2.c * m1.r * 4);
		var gl = this._checkinit(m1.r, m2.c);
		var renderer = this._buildRenderer(gl);

		this._bindSingleSrcTexture(gl, renderer, m1, gl.TEXTURE0, "usampler1");
		this._bindSingleSrcTexture(gl, renderer, m2, gl.TEXTURE1, "usampler2");

		this._bindUniforms(gl, renderer, m1, m2);
		this._bindVertices(gl, renderer, m1, m2);

		// create a framebuffer to render to
		var rendercanvas = this._createRenderCanvas(gl, m1, m2);
		var dstTex = this._createDstTexture(gl, rendercanvas);
		var fbuffer = this._bindFramebuffer(gl, dstTex, m1, m2);

		// draw to framebuffer
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbuffer);
		if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
			throw new Error("bound framebuffer is not complete.");
		}

		gl.drawElements(gl.TRIANGLES, /*num items*/ 6, gl.UNSIGNED_SHORT, 0);

		// extract the product and return in new matrix
		var prod = new Uint8Array(rawbuffer);
		gl.readPixels(0, 0, m2.c, m1.r, gl.RGBA, gl.UNSIGNED_BYTE, prod);
		//return gpu_matrix.create(m1.r, m2.c, new Float32Array(rawbuffer));
		var endTime = performance.now();
		return endTime - startTime;
	}

	// get shader from script tag
	_getShader(gl, shadertype, str) {
		//console.log("\n" + str + "\n");
		// create appropriate type of shader
		var shader;
		if (shadertype == "x-shader/x-fragment")
			shader = gl.createShader(gl.FRAGMENT_SHADER);
		else if (shadertype == "x-shader/x-vertex")
			shader = gl.createShader(gl.VERTEX_SHADER);
		else {
			throw "unknown shader type " + shadertype;
		}
		gl.shaderSource(shader, str);
		gl.compileShader(shader);
		if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) == 0)
			alert(gl.getShaderInfoLog(shader));
		return shader;
	}
}

const _vertexShader = `
	// vertex shader for a single quad
	// work is performed based on the texels being passed
	// through to the texture shader.
	#ifdef GL_ES 
	precision highp float; 
	#endif
	attribute vec3 aPos;
	attribute vec2 aTex;
	varying vec2   vTex;
	void main(void) {
	// just pass the position and texture coords 
	gl_Position = vec4(aPos, 1.0); 
	vTex = aTex; 
	}`;

const _shader_RGBA =
	"	// EXPERIMENTAL: READ FLOAT DATA FROM RGBA BYTES IN IEEE754 \n" +
	"    // fragment shader that calculates the sum of the passed row and \n" +
	"    // column (texture coord). \n" +
	"    // we loop over the row and column and sum the product. \n" +
	"    // product is then rendered to 32-bit IEEE754 floating point in the \n" +
	"    // output RGBA canvas. \n" +
	"    // readPixel is used to read the bytes. \n" +
	"#ifdef GL_ES \n" +
	"	precision highp float; \n" +
	"#endif \n" +
	"\n" +
	"	varying vec2	  vTex;         // row, column to calculate \n" +
	"	uniform sampler2D usampler1;	// LEFT \n" +
	"	uniform sampler2D usampler2;	// RIGHT \n" +
	"	uniform int		  uLength;      // r1xc1.r2xc2 => product has r2 (or c1) terms \n" +
	"	uniform float	  uStepS;       // increment across source texture \n" +
	"	uniform float	  uStepT;       // increment down source texture \n" +
	"	uniform float	  uOutRows;     // size of output in rows \n" +
	"	uniform float	  uOutCols;     // size of output in columns \n" +
	"\n" +
	"	/* \n" +
	"	// javascript decrypt ieee754 2013/02/08 \n" +
	"	mant3 = prod[src+0]; \n" +
	"	mant2 = prod[src+1]; \n" +
	"	bit = Math.floor(prod[src+2]/128.)*128; \n" +
	"	mant1 = prod[src+2]-(bit-128.); \n" +
	"	exp = ((prod[src+3] % 128)*2) + bit/128.; \n" +
	"	sgn = Math.floor(prod[src+3]/128.); \n" +
	"	f = mant1*256*256 + mant2*256 + mant3; \n" +
	"	f = f * Math.pow(2,(exp-150))*(1-2*sgn); \n" +
	"	*/ \n" +
	"\n" +
	"	float toIEEE754(vec4 bytes) { \n" +
	"		// RETURN AN IEEE754 FLOAT FROM 4 BYTES \n" +
	"		// GET BYTES \n" +
	"		float byte0 = bytes.r*255.; \n" +
	"		float byte1 = bytes.g*255.; \n" +
	"		float byte2 = bytes.b*255.; \n" +
	"		float byte3 = bytes.a*255.; \n" +
	"		// COMPUTE \n" +
	"		float mant3 = byte0; \n" +
	"		float mant2 = byte1; \n" +
	"		float bitv = floor(byte2/128.)*128.; \n" +
	"		float mant1 = byte2-(bitv-128.); \n" +
	"		float expv = (mod(byte3,128.))*2. + bitv/128.; \n" +
	"		float sgnv = floor(byte3/128.); \n" +
	"		float f = (mant1*256.*256.) + (mant2*256.) + mant3; \n" +
	"		f = f * pow(2.,(expv-150.))*(1.-2.*sgnv); \n" +
	"		return f; \n" +
	"	} \n" +
	"\n" +
	"	// sum row r x col c \n" +
	"	float sumrowcol(float row, float col) { \n" +
	"		float sum = 0.;             // sum \n" +
	"		float ss = 0.;              // column on source texture \n" +
	"		float tt = 0.;              // row on source texture \n" +
	"		float r = row*uStepT;       // moving texture coordinate \n" +
	"		float c = col*uStepS;       // moving texture coordinate \n" +
	"		for (int pos=0 ; pos<2048 ; ++pos) { \n" +
	"			if(pos>=uLength) break; // stop when we multiple a row by a column \n" +
	"			float m1 = toIEEE754(texture2D(usampler1,vec2(ss,r))); \n" +
	"			float m2 = toIEEE754(texture2D(usampler2,vec2(c,tt))); \n" +
	"// used for verifying correct sampling of texture" +
	"//			return m1; \n" +
	"//			return float(texture2D(usampler1,vec2(ss,r)).r*255.); \n" +
	"			sum += (m1*m2); \n" +
	"			ss += uStepS; \n" +
	"			tt += uStepT; \n" +
	"		} \n" +
	"		return sum; \n" +
	"	} \n" +
	"	 \n" +
	"	void main(void) { \n" +
	"		 \n" +
	"		// get the implied row and column from .s and .t of passed texel \n" +
	"		float col = floor((vTex.s*uOutRows)); \n" +
	"		float row = floor((vTex.t*uOutCols));    \n" +
	"\n" +
	"		// sum row x col for the passed pixel \n" +
	"		float v = sumrowcol(row,col); \n" +
	"\n" +
	"		// Render to IEEE 754 Floating Point \n" +
	"		if (v==0.) { \n" +
	"			gl_FragColor = vec4(0.,0.,0.,0.); \n" +
	"			return; \n" +
	"		} \n" +
	"		float a = abs(v);                           // encode absolute value + sign \n" +
	"		float exp = floor(log2(a));                 // number of powers of 2 \n" +
	"		float mant = (a * pow(2.,23.-exp));         // multiply to fill 24 bits (implied leading 1) \n" +
	"		float mant1 = floor(mant / 256. / 256.);    // first 8 bits of mantissa \n" +
	"		float mant2 = mod(floor(mant / 256.),256.); // second 8 bits \n" +
	"		float mant3 = mod(mant,256.);               // third 8 bits \n" +
	"		 \n" +
	"		highp float sign = 128.-128.*(a/v);			// sign bit is 256 or 0 \n" +
	"		highp float e = (sign+exp+127.)/510.;		// exponent and sign \n" +
	"		highp float m1 = (mant1-(128.*(1.-mod(exp+127.,2.))))/255.; // handle leading bit \n" +
	"		highp float m2 = (mant2)/255.;				// middle part \n" +
	"		highp float m3 = (mant3+.5)/255.;			// scale to 0 - 255 \n" +
	"		gl_FragColor = vec4(m3,m2,m1,e);			// output an IEEE754 32-bit floating point number \n" +
	"	} ";
