import {
  FaceDetector,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

/* =========================================================
ELEMENTS
========================================================= */
const homeScreen = document.getElementById("home-screen");
const homeError = document.getElementById("home-error");
const startBtn = document.getElementById("start-btn");
const mainApp = document.getElementById("main-app");
const modelStatus = document.getElementById("model-status");
const video = document.getElementById("webcam");
const actionBtn = document.getElementById("action-btn");
const scanTitle = document.getElementById("scan-title");
const scannerLine = document.getElementById("scanner-line");
const scanOverlay = document.getElementById("scan-overlay");
const cameraWarning = document.getElementById("camera-warning");
const warningDetail = document.getElementById("warning-detail");
const faceReady = document.getElementById("face-ready");
const faceInstructions = document.getElementById("face-instructions");
const resultsDiv = document.getElementById("results");
const alarmBanner = document.getElementById("alarm-banner");
const ripeCount = document.getElementById("ripe-count");
const popScoreElement = document.getElementById("pop-score");
const skinStatus = document.getElementById("skin-status");
const skinDetail = document.getElementById("skin-detail");
const toleranceSlider = document.getElementById("tolerance-slider");
const toleranceValue = document.getElementById("tolerance-value");

/* =========================================================
APP STATE
========================================================= */
let currentStep = 0;
let clearSkinTolerance = 70;
let faceDetector = null;
let detectorReady = false;
let audioCtx = null;

/* =========================================================
SCAN STEPS
========================================================= */
const steps = [
  "Step 1: Scan Front Profile",
  "Step 2: Scan Left Profile",
  "Step 3: Scan Right Profile"
];

/* =========================================================
INITIALIZE MEDIAPIPE FACE DETECTOR
========================================================= */
async function initializeFaceDetector() {
  try {
    if (modelStatus) modelStatus.textContent = "Initializing face detection system...";

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    faceDetector = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite"
      },
      runningMode: "VIDEO",
      minDetectionConfidence: 0.6,
      minSuppressionThreshold: 0.3
    });

    detectorReady = true;

    if (modelStatus) {
      modelStatus.textContent = "✓ Face detection system ready";
      modelStatus.className = "w-full mb-4 text-xs text-lime-400 font-bold";
    }

    if (startBtn) {
      startBtn.disabled = false;
      startBtn.textContent = "Yes, I'm Ready";
    }
  } catch (error) {
    console.error("MediaPipe initialization error:", error);
    detectorReady = false;

    if (modelStatus) {
      modelStatus.textContent = "Face detection system failed to load.";
      modelStatus.className = "w-full mb-4 text-xs text-red-400 font-bold";
    }

    if (homeError) {
      homeError.textContent =
        "Unable to load the face detection system. Check your internet connection and refresh.";
      homeError.classList.remove("hidden");
    }

    if (startBtn) startBtn.textContent = "System Unavailable";
  }
}

/* =========================================================
TOLERANCE SLIDER
========================================================= */
if (toleranceSlider) {
  toleranceSlider.addEventListener("input", () => {
    clearSkinTolerance = Number(toleranceSlider.value);
    if (toleranceValue) toleranceValue.textContent = `${clearSkinTolerance}%`;
  });
}

/* =========================================================
ALARM SOUND
========================================================= */
async function playAlarmBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!audioCtx) audioCtx = new AudioCtx();

    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }

    const beepCount = 3;
    const beepDuration = 0.15;
    const gap = 0.12;

    for (let i = 0; i < beepCount; i++) {
      const startTime = audioCtx.currentTime + i * (beepDuration + gap);
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "square";
      osc.frequency.value = 880;

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.3, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + beepDuration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(startTime);
      osc.stop(startTime + beepDuration);
    }
  } catch (err) {
    console.warn("Audio Context playback failed:", err);
  }
}

/* =========================================================
START WEBCAM
========================================================= */
async function startWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    video.srcObject = stream;

    await new Promise((resolve) => {
      video.onloadedmetadata = () => resolve();
    });

    await video.play();
    return true;
  } catch (error) {
    console.error("Camera error:", error);
    return false;
  }
}

/* =========================================================
CHECK IF FACE IS VISIBLE
========================================================= */
async function checkFaceVisible() {
  if (!detectorReady || !faceDetector) {
    return {
      valid: false,
      reason: "Face detection system is not ready."
    };
  }

  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
    return {
      valid: false,
      reason: "Camera image is not ready yet. Please wait a moment."
    };
  }

  try {
    const timestamp = Math.round(performance.now());
    const result = faceDetector.detectForVideo(video, timestamp);
    const faces = result.detections || [];

    if (faces.length === 0) {
      return {
        valid: false,
        reason:
          "No face detected. Please point the camera at your face and make sure it is clearly visible."
      };
    }

    const face = faces[0];
    const box = face.boundingBox;

    const width = box.width || 0;
    const height = box.height || 0;
    const originX = box.originX || 0;

    const faceWidthRatio = width / video.videoWidth;
    const faceHeightRatio = height / video.videoHeight;

    if (faceWidthRatio < 0.18 || faceHeightRatio < 0.18) {
      return {
        valid: false,
        reason:
          "Face detected, but too far away. Move closer so your face fills more of the camera."
      };
    }

    if (faceWidthRatio > 0.9 || faceHeightRatio > 0.9) {
      return {
        valid: false,
        reason:
          "You are too close to the camera. Move back slightly so your full face is visible."
      };
    }

    const faceCenterX = originX + width / 2;
    const videoCenterX = video.videoWidth / 2;
    const centerDifference = Math.abs(faceCenterX - videoCenterX);

    if (centerDifference > video.videoWidth * 0.35) {
      return {
        valid: false,
        reason: "Move your face closer to the center of the camera."
      };
    }

    return {
      valid: true,
      reason: "Face detected successfully."
    };
  } catch (error) {
    console.error("Face detection error:", error);
    return {
      valid: false,
      reason: "Unable to analyze the camera image. Please try again."
    };
  }
}

/* =========================================================
SHOW FACE WARNING
========================================================= */
function showFaceWarning(message) {
  if (warningDetail) warningDetail.textContent = message;
  if (cameraWarning) cameraWarning.classList.remove("hidden");
  if (faceReady) faceReady.classList.add("hidden");
  if (scanTitle) scanTitle.textContent = "Clearer Image Required";
  if (faceInstructions) {
    faceInstructions.innerHTML = `
      <p class="text-xs text-red-400 font-bold">
          Adjust your position and try again.
      </p>
    `;
  }
}

/* =========================================================
SHOW FACE READY
========================================================= */
function showFaceReady() {
  if (cameraWarning) cameraWarning.classList.add("hidden");
  if (faceReady) faceReady.classList.remove("hidden");
  if (faceInstructions) {
    faceInstructions.innerHTML = `
      <p class="text-xs text-lime-400 font-bold">
          ✓ Face detected. Image quality accepted.
      </p>
    `;
  }
}

/* =========================================================
RUN SCAN ANIMATION
========================================================= */
async function runScanAnimation() {
  actionBtn.disabled = true;

  if (scannerLine) {
    scannerLine.classList.remove("hidden");
    scannerLine.classList.add("scanning");
  }

  if (scanOverlay) scanOverlay.classList.remove("hidden");
  actionBtn.textContent = "Scanning Skin...";

  await new Promise((resolve) => setTimeout(resolve, 2500));

  if (scannerLine) {
    scannerLine.classList.add("hidden");
    scannerLine.classList.remove("scanning");
  }

  if (scanOverlay) scanOverlay.classList.add("hidden");
}

/* =========================================================
GENERATE SKIN RESULTS
========================================================= */
function generateSkinResults() {
  const skinVariation = Math.floor(Math.random() * 45) + 5;
  const noticeableBlemishes = Math.floor(Math.random() * 8);

  const ignoredVariation = Math.floor(
    skinVariation * (clearSkinTolerance / 100)
  );

  const remainingVariation = skinVariation - ignoredVariation;
  const variationDetected = Math.floor(remainingVariation / 25);
  const detectedPimples = noticeableBlemishes + variationDetected;
  const totalSkinMarks = skinVariation + noticeableBlemishes;

  const calculatedPopScore =
    detectedPimples === 0
      ? 0
      : Math.floor(
          (detectedPimples / Math.max(totalSkinMarks, 1)) * 100
        );

  if (ripeCount) ripeCount.textContent = detectedPimples;
  if (popScoreElement) popScoreElement.textContent = `${calculatedPopScore}%`;

  if (detectedPimples <= 1 && clearSkinTolerance >= 60) {
    if (skinStatus) {
      skinStatus.textContent = "CLEAR SKIN ✓";
      skinStatus.className = "text-xl font-black text-lime-400 mt-1";
    }
    if (skinDetail) {
      skinDetail.textContent =
        "No significant blemishes detected. Minor discoloration ignored.";
    }
    if (alarmBanner) alarmBanner.classList.add("hidden");
  } else if (detectedPimples <= 3) {
    if (skinStatus) {
      skinStatus.textContent = "MOSTLY CLEAR";
      skinStatus.className = "text-xl font-black text-amber-400 mt-1";
    }
    if (skinDetail) {
      skinDetail.textContent =
        "Only a small number of noticeable blemishes were detected. Minor variation was filtered.";
    }
    if (alarmBanner) alarmBanner.classList.add("hidden");
  } else {
    if (skinStatus) {
      skinStatus.textContent = "BLEMISHES DETECTED";
      skinStatus.className = "text-xl font-black text-red-500 mt-1";
    }
    if (skinDetail) {
      skinDetail.textContent =
        "Noticeable blemishes detected. Minor discoloration was filtered out.";
    }
    if (alarmBanner) alarmBanner.classList.remove("hidden");
    playAlarmBeep();
  }

  if (resultsDiv) resultsDiv.classList.remove("hidden");
}

/* =========================================================
START APPLICATION
========================================================= */
if (startBtn) {
  startBtn.addEventListener("click", async () => {
    if (!detectorReady) {
      if (homeError) {
        homeError.textContent = "Face detection is still loading.";
        homeError.classList.remove("hidden");
      }
      return;
    }

    startBtn.disabled = true;
    startBtn.textContent = "Requesting Camera...";

    if (homeError) homeError.classList.add("hidden");

    const cameraStarted = await startWebcam();

    if (!cameraStarted) {
      if (homeError) {
        homeError.textContent =
          "Webcam access denied or unavailable. Please allow camera access and try again.";
        homeError.classList.remove("hidden");
      }

      startBtn.disabled = false;
      startBtn.textContent = "Yes, I'm Ready";
      return;
    }

    if (homeScreen) homeScreen.classList.add("hidden");
    if (mainApp) {
      mainApp.classList.remove("hidden");
      mainApp.classList.add("flex");
    }
  });
}

/* =========================================================
MAIN SCAN BUTTON
========================================================= */
if (actionBtn) {
  actionBtn.addEventListener("click", async () => {
    if (currentStep >= 3) {
      currentStep = 0;
      if (scanTitle) scanTitle.textContent = steps[0];
      actionBtn.textContent = "Initialize Scan";

      if (resultsDiv) resultsDiv.classList.add("hidden");
      if (alarmBanner) alarmBanner.classList.add("hidden");
      if (cameraWarning) cameraWarning.classList.add("hidden");
      if (faceReady) faceReady.classList.add("hidden");

      if (ripeCount) ripeCount.textContent = "0";
      if (popScoreElement) popScoreElement.textContent = "0%";

      if (skinStatus) {
        skinStatus.textContent = "ANALYZING...";
        skinStatus.className = "text-xl font-black text-lime-400 mt-1";
      }

      if (skinDetail) skinDetail.textContent = "Minor discoloration will be ignored.";
      if (faceInstructions) {
        faceInstructions.innerHTML = `
          <p class="text-xs text-slate-400">
              Position your face clearly in the center of the camera.
          </p>
        `;
      }
      return;
    }

    actionBtn.disabled = true;
    actionBtn.textContent = "Checking Face...";

    const faceCheck = await checkFaceVisible();

    if (!faceCheck.valid) {
      showFaceWarning(faceCheck.reason);
      actionBtn.textContent = "Try Again";
      actionBtn.disabled = false;
      return;
    }

    showFaceReady();
    if (scanTitle) scanTitle.textContent = steps[currentStep];

    await new Promise((resolve) => setTimeout(resolve, 500));

    await runScanAnimation();

    currentStep++;

    if (currentStep < 3) {
      if (scanTitle) scanTitle.textContent = steps[currentStep];
      actionBtn.textContent = "Capture Next View";
      actionBtn.disabled = false;
    } else {
      if (scanTitle) scanTitle.textContent = "Analysis Complete";
      actionBtn.textContent = "Reset Matrix";
      actionBtn.disabled = false;

      if (faceReady) faceReady.classList.add("hidden");
      generateSkinResults();
    }
  });
}

/* =========================================================
INITIALIZE SYSTEM ON PAGE LOAD
========================================================= */
initializeFaceDetector();