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

		switch (aMethod) {
			case "CPU": {
				setCalcTime(calculateCpu(firstMatrix, secondMatrix));
				break;
			}
			case "WebGPU": {
				calculateWebGpu(firstMatrix, secondMatrix).then((calcTime) => {
					setCalcTime(calcTime);
				});
				break;
			}
			case "WebGL": {
				const [mSize, , ...mmfirst] = firstMatrix;
				const [, , ...mmsecond] = secondMatrix;
				const mm1 = new Matrix(mSize, mSize, new Float32Array(mmfirst));
				const mm2 = new Matrix(mSize, mSize, new Float32Array(mmsecond));
				setCalcTime(mm1.multiply(mm2));
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
			flArr[i] = Math.random() * 1; //Math.floor(Math.random() * 10) + 1;
		}
		return flArr;
	};

	return (
		<>
			<div className="gpu-info">
				<div>Architecture: {gpuInfo.architecture}</div>
				<div>GPU: {gpuInfo.description}</div>
				<div>Device ID: {gpuInfo.device}</div>
				<div>Vendor: {gpuInfo.vendor}</div>
			</div>
			<br />
			<select value={method} onChange={(e) => setMethod(e.target.value)}>
				<option value="CPU">CPU</option>
				<option value="WebGPU">WebGPU</option>
				<option value="WebGL">WebGL</option>
			</select>
			<div>
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
			{"Calcutation time: " + calcTime?.toFixed(2) + " ms"}
		</>
	);
}

export default WebCompute;
