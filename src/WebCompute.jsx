import { useRef, useEffect } from "react";
import "./App.css";

function WebCompute() {
	// select canvas element
	const webGpuCanvas = useRef(null);

	// useEffect runs after render
	useEffect(() => {
		if (webGpuCanvas != null) {
			initWebGPU(webGpuCanvas.current);
		}
	}, []);

	/**
	 * init the webGpu test
	 */
	const initWebGPU = async (canvas) => {
		if (!navigator.gpu) {
			throw new Error("WebGPU not supported on this browser.");
		}

		// get adapter
		const adapter = await navigator.gpu.requestAdapter();

		// adapter can be null if GPU does not support WebGPU features
		if (!adapter) {
			throw new Error("No appropriate GPUAdapter found.");
		}

		// get device
		const device = await adapter.requestDevice();
	};

	return (
		<>
			<canvas ref={webGpuCanvas} width={512} height={512}></canvas>
		</>
	);
}

export default WebCompute;
