// Gesture detection and redirect logic for index2.html
// Detects: Left hand pinch (Gyan Mudra) + Right hand horizontal movement
// Redirects to index3.html after 2 seconds of sustained gestures

let leftPinching = false;
let rightMovingHorizontally = false;
let rightPrevX = null;
let rightMovementCounter = 0;
let gestureStartTime = null;
const GESTURE_DURATION_MS = 2000; // Hold gesture for 2 seconds to redirect

const canvasOutput = document.getElementById('canvasOutput');
const canvasCtx = canvasOutput.getContext('2d');
const videoElement = document.getElementById('handVideo');
const leftHandStatus = document.getElementById('leftHandStatus');
const rightHandStatus = document.getElementById('rightHandStatus');
const progressStatus = document.getElementById('progressStatus');

// Helper function to calculate pinch distance
function pinchDistance(landmarks) {
    const thumb = landmarks[4];  // thumb tip
    const index = landmarks[8];  // index tip
    const dx = thumb.x - index.x;
    const dy = thumb.y - index.y;
    const dz = thumb.z - index.z;
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
}

// Helper function to get average X position
function avgX(landmarks) {
    let sum = 0;
    for (const lm of landmarks) sum += lm.x;
    return sum / landmarks.length;
}

function onHandResults(results) {
    // Clear canvas
    canvasCtx.clearRect(0, 0, canvasOutput.width, canvasOutput.height);
    
    if (results.image) {
        canvasCtx.save();
        canvasCtx.scale(-1, 1);
        canvasCtx.drawImage(results.image, -canvasOutput.width, 0, canvasOutput.width, canvasOutput.height);
        canvasCtx.restore();
    }

    leftPinching = false;
    const currentRightX = rightPrevX;
    let rightX = null;

    const landmarksArr = results.multiHandLandmarks || [];
    const handedArr = results.multiHandedness || [];

    if (landmarksArr.length === 0) {
        leftHandStatus.textContent = 'Not detected';
        rightHandStatus.textContent = 'Not detected';
        gestureStartTime = null;
        progressStatus.textContent = '-';
        return;
    }

    for (let i = 0; i < landmarksArr.length; i++) {
        const lm = landmarksArr[i];
        let handed = handedArr[i] && handedArr[i].label ? handedArr[i].label : "Unknown";
        
        // Flip labels since camera is mirrored
        if (handed === "Left") handed = "Right";
        else if (handed === "Right") handed = "Left";

        // LEFT HAND: Check for pinch (thumb + index together)
        if (handed === "Left") {
            const dist = pinchDistance(lm);
            leftPinching = dist < 0.08;  // Threshold for pinch
            leftHandStatus.textContent = leftPinching ? '🤏 Pinching (Gyan Mudra)' : '✋ Open';
            
            // Draw hand
            drawHandLandmarks(lm, '#00FF00');
        }

        // RIGHT HAND: Check for horizontal movement
        if (handed === "Right") {
            rightX = avgX(lm);
            
            if (rightPrevX !== null) {
                const movement = Math.abs(rightX - rightPrevX);
                if (movement > 0.01) {  // Significant horizontal movement
                    rightMovementCounter++;
                    if (rightMovementCounter > 3) {
                        rightMovingHorizontally = true;
                    }
                } else {
                    rightMovementCounter = Math.max(0, rightMovementCounter - 1);
                    if (rightMovementCounter === 0) {
                        rightMovingHorizontally = false;
                    }
                }
            }
            
            rightHandStatus.textContent = rightMovingHorizontally ? '↔️ Moving Horizontally' : '🤚 Stationary';
            
            // Draw hand
            drawHandLandmarks(lm, '#FF00FF');
        }
    }

    // Update rightPrevX for next frame
    if (rightX !== null) {
        rightPrevX = rightX;
    }

    // Check if both gestures are active
    if (leftPinching && rightMovingHorizontally) {
        if (gestureStartTime === null) {
            gestureStartTime = Date.now();
        }
        
        const elapsed = Date.now() - gestureStartTime;
        const progress = Math.min(100, (elapsed / GESTURE_DURATION_MS) * 100);
        progressStatus.textContent = `${progress.toFixed(0)}% - Hold gesture!`;
        
        // Redirect when duration is met
        if (elapsed >= GESTURE_DURATION_MS) {
            progressStatus.textContent = 'Redirecting...';
            setTimeout(() => {
                window.location.href = 'index3.html';
            }, 500);
        }
    } else {
        gestureStartTime = null;
        progressStatus.textContent = leftPinching || rightMovingHorizontally ? 'Perform both gestures' : '-';
    }
}

function drawHandLandmarks(landmarks, color) {
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
        canvasCtx.beginPath();
        canvasCtx.moveTo((1 - startLm.x) * width, startLm.y * height);
        canvasCtx.lineTo((1 - endLm.x) * width, endLm.y * height);
        canvasCtx.stroke();
    });
    
    canvasCtx.fillStyle = color;
    landmarks.forEach(landmark => {
        canvasCtx.beginPath();
        canvasCtx.arc((1 - landmark.x) * width, landmark.y * height, 3, 0, 2 * Math.PI);
        canvasCtx.fill();
    });
}

// Initialize hand tracking
const checkReady = setInterval(() => {
    if (typeof Hands !== 'undefined' && typeof Camera !== 'undefined') {
        clearInterval(checkReady);
        initializeHandTracking();
    }
}, 100);

function initializeHandTracking() {
    console.log('Initializing hand tracking...');
    
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
        console.log('Camera started');
        canvasOutput.width = videoElement.videoWidth || 640;
        canvasOutput.height = videoElement.videoHeight || 480;
    }).catch(err => {
        console.error('Camera failed:', err);
    });
}
