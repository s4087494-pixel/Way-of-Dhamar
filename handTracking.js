// Hand Tracking Controller
// Switches between Nirvana (pinch) and Asura (no pinch)
// Rotates model on z-axis based on hand horizontal position

console.log('Hand tracking script loaded');

// Global state - MUST be accessible to onHandResults
let leftPinching = false;
let leftX = 0.5;
let rightOpen = false;
let rightX = 0.5;
let hasHands = false;

// Pinch smoothing + hysteresis
const PINCH_ON = 0.070;          // Smoothed distance to switch ON
const PINCH_ON_FAST = 0.055;     // Raw distance to instantly latch ON
const PINCH_OFF = 0.095;         // Smoothed distance to release
const PINCH_SMOOTH = 0.45;       // Higher = snappier but a bit noisier
let smoothedLeftPinchDist = null;

// Canvas references
const canvasOutput = document.getElementById('canvasOutput');
const canvasCtx = canvasOutput.getContext('2d');
const videoElement = document.getElementById('handVideo');

// Helper functions
function pinchDistance(landmarks) {
  const t = landmarks[4];  // thumb tip
  const i = landmarks[8];  // index tip
  const dx = t.x - i.x, dy = t.y - i.y, dz = t.z - i.z;
  const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
  return dist;
}

function opennessScore(landmarks) {
  const w = landmarks[0];
  const tips = [8, 12, 16, 20];
  let sum = 0;
  for (const idx of tips) {
    const p = landmarks[idx];
    const dx = p.x - w.x, dy = p.y - w.y;
    sum += Math.sqrt(dx*dx + dy*dy);
  }
  return sum / tips.length;
}

function avgX(landmarks) {
  let sum = 0;
  for (const lm of landmarks) sum += lm.x;
  return sum / landmarks.length;
}

function drawHandLandmarks(landmarks, color = '#00FF00') {
    const width = canvasOutput.width;
    const height = canvasOutput.height;
    
    canvasCtx.strokeStyle = color;
    canvasCtx.lineWidth = 2;
    
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [0, 5], [5, 6], [6, 7], [7, 8],
        [0, 9], [9, 10], [10, 11], [11, 12],
        [0, 13], [13, 14], [14, 15], [15, 16],
        [0, 17], [17, 18], [18, 19], [19, 20]
    ];
    
    connections.forEach(([start, end]) => {
        const startLm = landmarks[start];
        const endLm = landmarks[end];
        // Flip X coordinate: (1 - x) instead of x
        canvasCtx.beginPath();
        canvasCtx.moveTo((1 - startLm.x) * width, startLm.y * height);
        canvasCtx.lineTo((1 - endLm.x) * width, endLm.y * height);
        canvasCtx.stroke();
    });
    
    canvasCtx.fillStyle = color;
    landmarks.forEach(landmark => {
        canvasCtx.beginPath();
        // Flip X coordinate: (1 - x) instead of x
        canvasCtx.arc((1 - landmark.x) * width, landmark.y * height, 3, 0, 2 * Math.PI);
        canvasCtx.fill();
    });
}

function updateSceneVisibility() {
  const nirvanaLayer = document.getElementById('nirvanaLayer');
  const asuraLayer = document.getElementById('asuraLayer');
  const nirvanaDiv = document.getElementById('nirvana');
  const asuraDiv = document.getElementById('asura');
  const sceneStatus = document.getElementById('sceneStatus');

  const fadeDelayMs = 140;

  // Hide everything when no hands are detected
  if (!hasHands) {
    if (nirvanaLayer && asuraLayer) {
      nirvanaLayer.classList.remove('isOn');
      asuraLayer.classList.remove('isOn');
      nirvanaLayer.style.display = 'none';
      asuraLayer.style.display = 'none';
    }
    if (nirvanaDiv) nirvanaDiv.style.display = 'none';
    if (asuraDiv) asuraDiv.style.display = 'none';
    if (sceneStatus) sceneStatus.textContent = 'No hands';
    return;
  }

  // Ensure layers are shown so fades work once hands return
  if (nirvanaLayer) nirvanaLayer.style.display = '';
  if (asuraLayer) asuraLayer.style.display = '';

  if (leftPinching) {
    if (nirvanaLayer && asuraLayer) {
      nirvanaLayer.classList.add('isOn');
      nirvanaLayer.style.display = '';
      setTimeout(() => {
        asuraLayer.classList.remove('isOn');
        asuraLayer.style.display = '';
      }, fadeDelayMs);
    } else {
      if (nirvanaDiv) nirvanaDiv.style.display = 'block';
      if (asuraDiv) asuraDiv.style.display = 'none';
    }
    if (nirvanaDiv) nirvanaDiv.style.display = 'block';
    if (asuraDiv) asuraDiv.style.display = 'none';
    if (sceneStatus) sceneStatus.textContent = 'Nirvana (LEFT pinch)';
  } else {
    if (nirvanaLayer && asuraLayer) {
      asuraLayer.classList.add('isOn');
      asuraLayer.style.display = '';
      setTimeout(() => {
        nirvanaLayer.classList.remove('isOn');
        nirvanaLayer.style.display = '';
      }, fadeDelayMs);
    } else {
      if (nirvanaDiv) nirvanaDiv.style.display = 'none';
      if (asuraDiv) asuraDiv.style.display = 'block';
    }
    if (nirvanaDiv) nirvanaDiv.style.display = 'none';
    if (asuraDiv) asuraDiv.style.display = 'block';
    if (sceneStatus) sceneStatus.textContent = 'Asura (LEFT open)';
  }
}

function updateModelRotation() {
  // Videos don't need rotation like 3D models did
  // Hand position can be used for other effects if needed in the future
  // For now, this function does nothing since we're using plain videos
}

function onHandResults(results) {
  if (results.image) {
    // Flip the canvas horizontally so left hand appears on left (not mirrored)
    canvasCtx.save();
    canvasCtx.scale(-1, 1);
    canvasCtx.drawImage(results.image, -canvasOutput.width, 0, canvasOutput.width, canvasOutput.height);
    canvasCtx.restore();
  }

  leftPinching = false;
  leftX = 0.5;
  rightOpen = false;
  rightX = 0.5;

  const hand1Status = document.getElementById('hand1Status');
  const hand2Status = document.getElementById('hand2Status');

  const landmarksArr = results.multiHandLandmarks || [];
  const handedArr = results.multiHandedness || [];

  hasHands = landmarksArr.length > 0;

  if (landmarksArr.length === 0) {
    smoothedLeftPinchDist = null;
    if (hand1Status) hand1Status.textContent = '-';
    if (hand2Status) hand2Status.textContent = '-';
    updateSceneVisibility();
    updateModelRotation();
    return;
  }

  for (let i = 0; i < landmarksArr.length; i++) {
    const lm = landmarksArr[i];
    // FLIP the hand labels because camera is flipped
    let handed = handedArr[i] && handedArr[i].label ? handedArr[i].label : "Unknown";
    // Swap Left <-> Right to match actual hand positions
    if (handed === "Left") handed = "Right";
    else if (handed === "Right") handed = "Left";

    if (handed === "Left") {
      const dist = pinchDistance(lm);

      // Low-pass filter with a fast path when fingers really meet
      if (smoothedLeftPinchDist === null) smoothedLeftPinchDist = dist;
      smoothedLeftPinchDist =
        smoothedLeftPinchDist * (1 - PINCH_SMOOTH) + dist * PINCH_SMOOTH;

      const pinchDown = dist < PINCH_ON_FAST || smoothedLeftPinchDist < PINCH_ON;
      const pinchUp = smoothedLeftPinchDist > PINCH_OFF;

      if (pinchDown) leftPinching = true;
      else if (pinchUp) leftPinching = false;

      leftX = avgX(lm);

      if (hand1Status) hand1Status.textContent = leftPinching ? 'LEFT: 🤏 Pinch (Nirvana)' : 'LEFT: ✋ Open (Asura)';
      drawHandLandmarks(lm, '#00FF00');
    }

    if (handed === "Right") {
      const open = opennessScore(lm);
      rightOpen = open > 0.18;  // Lowered for more sensitive detection
      rightX = avgX(lm);

      if (hand2Status) hand2Status.textContent = rightOpen ? 'RIGHT: ✋ Open (Story)' : 'RIGHT: 🤚 Closed';
      drawHandLandmarks(lm, '#FF00FF');
    }
  }

  updateSceneVisibility();
  updateModelRotation();
}

// Wait for MediaPipe to load
console.log('Waiting for MediaPipe to load...');
const checkReady = setInterval(() => {
    if (typeof Hands !== 'undefined' && typeof Camera !== 'undefined') {
        clearInterval(checkReady);
        initializeHandTracking();
    }
}, 100);

function initializeHandTracking() {
    console.log('MediaPipe loaded, initializing...');
    
    const hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    hands.onResults(onHandResults);

    function startMediaPipeCamera() {
        return new Promise((resolve, reject) => {
            const camera = new Camera(videoElement, {
                onFrame: async () => {
                    try {
                        await hands.send({ image: videoElement });
                    } catch (e) {
                        console.error('Hand tracking error:', e);
                    }
                },
                width: 640,
                height: 480
            });

            camera.start().then(() => {
                console.log('✓ MediaPipe Camera started');
                canvasOutput.width = videoElement.videoWidth || 640;
                canvasOutput.height = videoElement.videoHeight || 480;
                resolve(camera);
            }).catch(reject);
        });
    }

    function startGetUserMediaFallback() {
        console.warn('Falling back to navigator.mediaDevices.getUserMedia');
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            return Promise.reject(new Error('getUserMedia not supported'));
        }

        return navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 }, 
                height: { ideal: 480 },
                facingMode: 'user'
            } 
        })
            .then((stream) => {
                videoElement.srcObject = stream;
                return videoElement.play().then(() => {
                    console.log('✓ getUserMedia stream started');
                    canvasOutput.width = videoElement.videoWidth || 640;
                    canvasOutput.height = videoElement.videoHeight || 480;

                    let running = true;
                    (function frameLoop() {
                        if (!running) return;
                        hands.send({ image: videoElement }).catch(e => console.error('hands.send error:', e));
                        requestAnimationFrame(frameLoop);
                    })();

                    return {
                        stop: () => {
                            running = false;
                            stream.getTracks().forEach(t => t.stop());
                        }
                    };
                });
            });
    }

    startMediaPipeCamera()
        .catch((mpErr) => {
            console.warn('MediaPipe Camera failed:', mpErr);
            return startGetUserMediaFallback();
        })
        .catch((fallbackErr) => {
            console.error('Camera initialization failed (both MediaPipe and fallback):', fallbackErr);
            console.info('Ensure camera permissions are granted and HTTPS/localhost is used.');
        });
}

window.handTracking = {
  isLeftPinching: () => leftPinching,
  getLeftX: () => leftX,
  isRightOpen: () => rightOpen,
  getRightX: () => rightX,
};

console.log('Hand tracking script ready');
