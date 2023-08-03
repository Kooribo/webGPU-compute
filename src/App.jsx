import "./App.css";
import WebCompute from "./WebCompute";

function App() {
	return (
		<>
			<h1>Matrix Multiplication</h1>
			<div className="card-full">
				{!navigator.gpu ? (
					<div className="support-error">
						It seems like your current browser does{" "}
						<a
							href="https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API#browser_compatibility"
							target="_blank"
							rel="noreferrer"
						>
							not support WebGPU
						</a>
					</div>
				) : (
					<WebCompute />
				)}
			</div>
		</>
	);
}

export default App;
