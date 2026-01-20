// Hand Scene - Completely Independent from Buddha
const handScene = new THREE.Scene();
let handModel = null; // keep reference for responsive scaling/offset
let handBaseTarget = null; // base target to realign camera on resize
const handRenderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    alpha: true 
});

handRenderer.setSize(window.innerWidth, window.innerHeight);
handRenderer.setPixelRatio(window.devicePixelRatio);
handRenderer.outputEncoding = THREE.sRGBEncoding;
handRenderer.toneMapping = THREE.ACESFilmicToneMapping;
handRenderer.toneMappingExposure = 0.6;
handRenderer.physicallyCorrectLights = true;

const handContainer = document.getElementById('hand-container');
handContainer.appendChild(handRenderer.domElement);

// Get actual container dimensions
const containerRect = handContainer.getBoundingClientRect();
handRenderer.setSize(containerRect.width, containerRect.height);

// Default hand camera (will be replaced if hand.glb has one)
let handCamera = new THREE.PerspectiveCamera(
    50,
    containerRect.width / containerRect.height,
    0.1,
    1000
);
handCamera.position.set(0, 1, 3);
let initialHandCameraPos = handCamera.position.clone();

// Hand controls
const handControls = new THREE.OrbitControls(handCamera, handRenderer.domElement);
handControls.enableDamping = true;
handControls.dampingFactor = 0.05;
handControls.enablePan = false;
handControls.minPolarAngle = Math.PI * 0.3; // Limit vertical rotation
handControls.maxPolarAngle = Math.PI * 0.7;

// Helper to derive a safe hand scale based on container width
const getHandScaleFromWidth = (width) => {
    // Keep original size on all screens, only reduce slightly on very small screens to prevent clipping
    if (width >= 1366) {
        return 0.8; // original size
    }
    // Only scale down below 1366px
    const normalized = width / 1366;
    return 0.5 * Math.max(normalized, 0.85); // minimal reduction only for very small screens
};

// Shift hand to the right on smaller screens (or think of it as camera nudging left)
const getHandOffsetXFromWidth = (width) => {
    const normalized = Math.min(Math.max(width / 1920, 0.5), 1.1);
    // At 1920 -> 0, at ~1200 -> ~1.0, stronger shift for smaller screens
    return (1 - normalized) * 1.3;
};

// Load hand model
const handLoader = new THREE.GLTFLoader();
handLoader.load('assets/3D/hand.glb', (gltf) => {
    handModel = gltf.scene;
    
    // Play animations if available
    let mixer;
    if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(handModel);
        gltf.animations.forEach((clip) => {
            const action = mixer.clipAction(clip);
            action.play();
            console.log('Playing animation:', clip.name);
        });
        // Store mixer globally for animation loop
        window.handMixer = mixer;
    }
    
    // Use camera from GLB if available
    if (gltf.cameras && gltf.cameras.length > 0) {
        handCamera = gltf.cameras[0];
        const rect = handContainer.getBoundingClientRect();
        handCamera.aspect = rect.width / rect.height;
        // Fix near/far planes to prevent clipping
        handCamera.near = 0.01;
        handCamera.far = 1000;
        handCamera.updateProjectionMatrix();
        initialHandCameraPos = handCamera.position.clone();
        
        // Update controls to use the GLB camera
        handControls.object = handCamera;
        handControls.target.set(0, 0, 0);
        handControls.update();
        handBaseTarget = handControls.target.clone();
        
        console.log('Using hand camera from GLB at position:', handCamera.position);
        handScene.add(handCamera);
    } else {
        // Fallback: use default camera setup
        handCamera.position.set(0, 0, 3);
        handCamera.lookAt(0, 0, 0);
        initialHandCameraPos = handCamera.position.clone();
        handControls.target.set(0, 0, 0);
        handControls.update();
        handBaseTarget = handControls.target.clone();
    }
    
    let lightCount = 0;

    // Process hand model
    handModel.traverse((child) => {
        if (child.isMesh) {
            console.log('Hand Mesh:', child.name);
            
            if (child.material) {
                child.material.side = THREE.DoubleSide;
                child.material.depthWrite = true;
                child.material.needsUpdate = true;
            }
        }
        
        // Scale down Blender lights
        if (child.isLight) {
            const originalIntensity = child.intensity;
            child.intensity *= 0.001;
            console.log('Hand Light:', child.type, 'Original:', originalIntensity, '→ Scaled:', child.intensity);
            lightCount += 1;
        }
    });

    // If the GLB contains no lights, add a gentle fallback so the model is visible
    if (lightCount === 0) {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.00002);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.00005);
        dirLight.position.set(3, 5, 4);
        handScene.add(ambientLight, dirLight);
        console.log('No lights in GLB; added fallback ambient + directional');
    }
    
    // Measure model bounds
    const box = new THREE.Box3().setFromObject(handModel);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // Vertical lift offset to place the model higher in the view
    const liftY = size.y * 0.2;

    // Global scale based on current container width to reduce clipping
    handModel.scale.setScalar(getHandScaleFromWidth(containerRect.width));

    // If using GLB camera, make sure it and the controls look at the model center
    if (gltf.cameras && gltf.cameras.length > 0) {
        handCamera.lookAt(center);
        handControls.target.copy(center);
        handControls.update();
        // Nudge the model upward in the frame
        handModel.position.y += liftY;
    }

    // If no GLB camera, center model, lift it, and auto-frame
    if (!gltf.cameras || gltf.cameras.length === 0) {
        handModel.position.sub(center);
        handModel.position.y += liftY;
        
        handScene.add(handModel);

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = handCamera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        cameraZ *= 2;
        
        handCamera.position.set(0, 0, cameraZ);
        handCamera.lookAt(0, 0, 0);
        initialHandCameraPos = handCamera.position.clone();
        handControls.target.set(0, 0, 0);
        handControls.update();
    } else {
        // With GLB camera: keep original model transform to preserve framing
        handScene.add(handModel);
    }

    // Store base position and apply horizontal offset based on current width
    const offsetX = getHandOffsetXFromWidth(containerRect.width);
    handModel.userData.basePosition = handModel.position.clone();
    handModel.position.x = handModel.userData.basePosition.x + offsetX;
    if (!handBaseTarget) {
        handBaseTarget = handControls.target.clone();
    }
    if (handBaseTarget) {
        handControls.target.x = handBaseTarget.x + offsetX;
        handControls.update();
    }
    
    console.log('Hand model loaded. Size:', size);
}, undefined, (error) => {
    console.error('Error loading hand model:', error);
});

// Hand animation loop
let handMouseX = 0.5, handMouseY = 0.5;
const handParallaxAmount = 0.5;
const clock = new THREE.Clock();

document.addEventListener('mousemove', (e) => {
    handMouseX = e.clientX / window.innerWidth;
    handMouseY = e.clientY / window.innerHeight;
});

function animateHand() {
    requestAnimationFrame(animateHand);
    
    // Update animation mixer if it exists
    if (window.handMixer) {
        const delta = clock.getDelta();
        window.handMixer.update(delta);
    }
    
    // Apply parallax effect to camera position based on mouse
    handCamera.position.x = initialHandCameraPos.x + (handMouseX - 0.5) * handParallaxAmount;
    handCamera.position.y = initialHandCameraPos.y + (0.5 - handMouseY) * handParallaxAmount * 0.5;
    handCamera.position.z = initialHandCameraPos.z;
    
    handControls.update();
    handRenderer.render(handScene, handCamera);
}

animateHand();

// Handle window resize for hand scene
window.addEventListener('resize', () => {
    const rect = handContainer.getBoundingClientRect();
    handCamera.aspect = rect.width / rect.height;
    handCamera.updateProjectionMatrix();
    // Rescale hand to keep composition and avoid clipping on resize
    if (handModel) {
        handModel.scale.setScalar(getHandScaleFromWidth(rect.width));
        const offsetX = getHandOffsetXFromWidth(rect.width);
        const baseX = handModel.userData.basePosition ? handModel.userData.basePosition.x : 0;
        handModel.position.x = baseX + offsetX;
        if (handBaseTarget) {
            handControls.target.x = handBaseTarget.x + offsetX;
            handControls.update();
        }
    }
    handRenderer.setSize(rect.width, rect.height);
});
