import { useEffect, useState } from "react";
import "./WebCompute.css";
import { calculateWebGpu } from "./calculateWebGpu";
import { calculateCpu } from "./calculateCpu";
import { Matrix } from "./calculateWebGl";

function WebCompute() {
	const [matrixSize, setMatrixSize] = useState(0);
	const [calcTime, setCalcTime] = useState(0);
	const [gpuInfo, setGpuInfo] = useState({});
	const [method, setMethod] = useState("CPU");

	// render gpu info
	useEffect(() => {
		initAdapter().then((adapterInfo) =>
			setGpuInfo({
				architecture: adapterInfo.architecture,
				description: adapterInfo.description,
				device: adapterInfo.device,
				vendor: adapterInfo.vendor,
			})
		);
	}, []);

	/*
	 * return gpu info
	 */
	const initAdapter = async () => {
		const adapter = await navigator.gpu.requestAdapter();
		const adapterInfo = adapter.requestAdapterInfo();

		return adapterInfo;
	};

	/**
	 * calculate Matrices
	 */
	const calculateMatMult = (aMethod) => {
		const firstMatrix = generateMatrix();
		const secondMatrix = generateMatrix();
		//const firstMatrix = new Float32Array([3, 3, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
		//const secondMatrix = new Float32Array([3, 3, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

		var startTime = performance.now();

		switch (aMethod) {
			case "CPU": {
				let endTime = calculateCpu(firstMatrix, secondMatrix);
				performance.measure("CPU", { start: startTime, end: endTime });
				setCalcTime(endTime - startTime);
				break;
			}
			case "WebGPU": {
				calculateWebGpu(firstMatrix, secondMatrix).then((endTime) => {
					performance.measure("WebGPU", { start: startTime, end: endTime });
					setCalcTime(endTime - startTime);
				});
				break;
			}
			case "WebGL": {
				const [mSize, , ...mmfirst] = firstMatrix; // put inside matrix class
				const [, , ...mmsecond] = secondMatrix;
				const mm1 = new Matrix(mSize, mSize, new Float32Array(mmfirst));
				const mm2 = new Matrix(mSize, mSize, new Float32Array(mmsecond));
				let endTime = mm1.multiply(mm2);
				performance.measure("WebGL", { start: startTime, end: endTime });
				setCalcTime(endTime - startTime);
				break;
			}
		}
	};

	/*
	 * generate Matrices
	 */
	const generateMatrix = () => {
		//update to only one more for size (quadratische matrix)
		let mSize = matrixSize > 1 ? matrixSize : 4;
		let arrLength = mSize * mSize + 2;
		let flArr = new Float32Array(arrLength); //two more for columns and rows number
		flArr[0] = mSize;
		flArr[1] = mSize;
		for (let i = 2; i < arrLength; i++) {
			flArr[i] = Math.random() * 10 + 1; //Math.floor(Math.random() * 10) + 1;
		}
		return flArr;
	};

	return (
		<>
			<div className="gpu-info">
				<div>GPU: {gpuInfo.description}</div>
				<div className="gpu-small">
					<div>Architecture: {gpuInfo.architecture}</div>
					<div>Device ID: {gpuInfo.device}</div>
					<div>Vendor: {gpuInfo.vendor}</div>
				</div>
			</div>
			<br />
			<div>
				<button
					className={method == "CPU" ? "select-button active" : "select-button"}
					onClick={() => setMethod("CPU")}
				>
					CPU
				</button>
				<button
					className={
						method == "WebGPU" ? "select-button active" : "select-button"
					}
					onClick={() => setMethod("WebGPU")}
				>
					WebGPU
				</button>
				<button
					className={
						method == "WebGL" ? "select-button active" : "select-button"
					}
					onClick={() => setMethod("WebGL")}
				>
					WebGL
				</button>
			</div>
			<div className="matrix-info">
				Matrix size:
				<input
					className="matrix-input"
					type="number"
					placeholder="4"
					onChange={(e) => {
						setMatrixSize(e.target.value);
					}}
				></input>
				<button
					className="matrix-button"
					onClick={() => calculateMatMult(method)}
				>
					Calculate
				</button>
			</div>
			<span className="material-symbols-outlined">
				timer {calcTime?.toFixed(2) + " ms"}
			</span>
		</>
	);
}

export default WebCompute;
