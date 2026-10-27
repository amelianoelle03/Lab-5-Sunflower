// Teachable Machine loads a trained TensorFlow.js image model from this URL.
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/RgNspmd3u/";

const cameraButton = document.querySelector("#camera-button");
const buttonLabel = document.querySelector("#button-label");
const cameraWindow = document.querySelector("#camera-window");
const cameraPlaceholder = document.querySelector("#camera-placeholder");
const cameraStatus = document.querySelector("#camera-status");
const cameraHelp = document.querySelector("#camera-help");
const predictionResult = document.querySelector("#prediction-result");
const confidenceLabel = document.querySelector("#confidence-label");
const confidenceCaption = document.querySelector("#confidence-caption");
const confidenceTrack = document.querySelector("#confidence-track");
const confidenceBar = document.querySelector("#confidence-bar");
const fieldScene = document.querySelector("#field-scene");
const plantState = document.querySelector("#plant-state");
const stageDot = document.querySelector("#stage-dot");

let model;
let webcam;
let animationFrameId;
let isRunning = false;
let isLoading = false;

cameraButton.addEventListener("click", () => {
	if (isLoading) return;
	if (isRunning) {
		stopCamera();
	} else {
		startCamera();
	}
});

async function startCamera() {
	isLoading = true;
	cameraButton.disabled = true;
	buttonLabel.textContent = "Loading model…";
	setHelp("Loading the trained model and preparing your camera.");

	try {
		if (!window.tmImage) {
			throw new Error("The Teachable Machine library did not load. Check your internet connection and refresh.");
		}

		// Load both model.json and metadata.json from the user's Teachable Machine model directory.
		model = await tmImage.load(`${MODEL_URL}model.json`, `${MODEL_URL}metadata.json`);

		// Teachable Machine's webcam helper requests permission and provides frames for prediction.
		webcam = new tmImage.Webcam(320, 240, true);
		await webcam.setup();
		await webcam.play();

		cameraWindow.appendChild(webcam.canvas);
		cameraPlaceholder.classList.add("is-hidden");
		isRunning = true;
		cameraStatus.classList.add("is-online");
		cameraStatus.innerHTML = '<span class="status-dot"></span> LIVE';
		buttonLabel.textContent = "Stop camera";
		cameraButton.querySelector(".button-icon").textContent = "■";
		setHelp("Point the camera toward a bright or dim scene.");
		animationFrameId = window.requestAnimationFrame(predictFrame);
	} catch (error) {
		stopWebcamTracks();
		cameraWindow.querySelector("canvas")?.remove();
		cameraPlaceholder.classList.remove("is-hidden");
		setHelp(getCameraErrorMessage(error), true);
		resetCameraControls();
	} finally {
		isLoading = false;
		cameraButton.disabled = false;
	}
}

function stopCamera() {
	isRunning = false;
	window.cancelAnimationFrame(animationFrameId);
	stopWebcamTracks();
	cameraWindow.querySelector("canvas")?.remove();
	cameraPlaceholder.classList.remove("is-hidden");
	cameraStatus.classList.remove("is-online");
	cameraStatus.innerHTML = '<span class="status-dot"></span> OFFLINE';
	buttonLabel.textContent = "Start camera";
	cameraButton.querySelector(".button-icon").textContent = "▶";
	setHelp("Camera stopped. Start again whenever you are ready.");
	showWaitingState();
}

function stopWebcamTracks() {
	if (webcam) {
		webcam.stop();
		webcam = null;
	}
}

async function predictFrame() {
	if (!isRunning || !webcam || !model) return;

	try {
		webcam.update();
		const predictions = await model.predict(webcam.canvas);
		if (!isRunning) return;

		// Use the most likely class, then map its label to the flower's two biomimicry states.
		const bestPrediction = predictions.reduce((best, prediction) =>
			prediction.probability > best.probability ? prediction : best
		);
		updatePrediction(bestPrediction, predictions);
		animationFrameId = window.requestAnimationFrame(predictFrame);
	} catch (error) {
		console.error("Prediction could not be completed:", error);
		setHelp("The camera is on, but a prediction failed. Try refreshing the page.", true);
		stopCamera();
	}
}

function updatePrediction(prediction, predictions) {
	const label = prediction.className.trim();
	const normalizedLabel = label.toLowerCase();
	const confidence = Math.max(0, Math.min(1, prediction.probability));
	const percent = Math.round(confidence * 100);
	const lightClass = normalizedLabel.includes("light");
	const darkClass = normalizedLabel.includes("dark");

	predictionResult.textContent = label;
	predictionResult.classList.toggle("is-light", lightClass);
	predictionResult.classList.toggle("is-dark", darkClass);
	confidenceLabel.textContent = `${percent}%`;
	confidenceBar.style.width = `${percent}%`;
	confidenceTrack.setAttribute("aria-valuenow", String(percent));
	confidenceTrack.setAttribute("aria-valuetext", `${percent}% confidence for ${label}`);
	confidenceTrack.classList.toggle("is-dark", darkClass);
	const runnerUp = predictions
		.filter((item) => item !== prediction)
		.sort((a, b) => b.probability - a.probability)[0];
	confidenceCaption.textContent = runnerUp
		? `${Math.round(runnerUp.probability * 100)}% ${runnerUp.className}`
		: "Top model match";

	if (lightClass) {
		// Biomimicry: the Light class raises the sun and turns the whole field into daytime.
		setFieldState("light");
	} else if (darkClass) {
		// Biomimicry: the Dark class lowers the sun and returns the whole field to night.
		setFieldState("dark");
	} else {
		// Keep an unknown label honest instead of pretending it is one of the trained classes.
		plantState.textContent = `Model sees ${label}`;
		stageDot.style.background = "#b6bea9";
		fieldScene.setAttribute("aria-label", `A field of sunflowers; the model predicts ${label}`);
	}
}

function setFieldState(state) {
	const isLight = state === "light";
	fieldScene.classList.toggle("is-light", isLight);
	fieldScene.classList.toggle("is-dark", !isLight);
	plantState.textContent = isLight ? "Sunrise — the field wakes" : "Nightfall — the field rests";
	stageDot.style.background = isLight ? "#d2a633" : "#8b9b84";
	stageDot.style.boxShadow = isLight ? "0 0 0 4px rgba(210, 166, 51, .14)" : "0 0 0 4px rgba(139, 155, 132, .14)";
	fieldScene.setAttribute(
		"aria-label",
		isLight ? "The sun is up over a bright field of sunflowers" : "The sun has set over a field of sunflowers at night"
	);
}

function showWaitingState() {
	predictionResult.textContent = "Waiting for input";
	predictionResult.classList.remove("is-light", "is-dark");
	confidenceLabel.textContent = "—%";
	confidenceCaption.textContent = "No prediction yet";
	confidenceBar.style.width = "0%";
	confidenceTrack.setAttribute("aria-valuenow", "0");
	confidenceTrack.removeAttribute("aria-valuetext");
	confidenceTrack.classList.remove("is-dark");
	fieldScene.classList.remove("is-light");
	fieldScene.classList.add("is-dark");
	fieldScene.setAttribute("aria-label", "A field of sunflowers at night, waiting for light");
	plantState.textContent = "Waiting for sunrise";
	stageDot.style.background = "#b6bea9";
	stageDot.style.boxShadow = "none";
}

function resetCameraControls() {
	isRunning = false;
	cameraStatus.classList.remove("is-online");
	cameraStatus.innerHTML = '<span class="status-dot"></span> OFFLINE';
	buttonLabel.textContent = "Start camera";
	cameraButton.querySelector(".button-icon").textContent = "▶";
}

function setHelp(message, isError = false) {
	cameraHelp.textContent = message;
	cameraHelp.classList.toggle("is-error", isError);
}

function getCameraErrorMessage(error) {
	if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") {
		return "Camera access was blocked. Allow it in your browser settings, then try again.";
	}
	if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") {
		return "No camera was found. Connect a camera and try again.";
	}
	if (error?.name === "NotReadableError" || error?.name === "TrackStartError") {
		return "Your camera may already be in use by another app. Close it and try again.";
	}
	return error?.message || "Could not start the camera. Try again from a secure page such as VS Code Live Server.";
}

showWaitingState();
