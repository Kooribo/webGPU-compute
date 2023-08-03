/**
 * calculate Matrices CPU
 */
export function calculateCpu(mat1, mat2) {
	// generated matrices
	const firstMatrix = mat1;
	const secondMatrix = mat2;

	let resultMatrix = new Float32Array(firstMatrix[0] * secondMatrix[1] + 2);

	//matrix mult = zeile von a * spalte von b
	//add calculation
	resultMatrix[0] = firstMatrix[0];
	resultMatrix[1] = secondMatrix[1];

	let i = 1;
	// Schleife über Zeile von a , 2
	for (let a = 0; a < firstMatrix[0]; a++) {
		// Schleife über Spalte von b, 2
		for (let b = 0; b < secondMatrix[1]; b++) {
			let result = 0;
			// Schleife über Spalte von a und Zeile von b, 3
			for (let c = 0; c < firstMatrix[1]; c++) {
				let oneVal = a * firstMatrix[1] + c; //first c loop = [0] , second c loop = [1]
				let twoVal = c * secondMatrix[1] + b; //first c loop = [0], second c loop = [2], in einer spalte
				result += firstMatrix[oneVal + 2] * secondMatrix[twoVal + 2];
			}
			i++;
			resultMatrix[i] = result;
		}
	}

	//console.log(resultMatrix);

	return performance.now();
}
