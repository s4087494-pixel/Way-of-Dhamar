
const handScene = new THREE.Scene();
let handModel = null;

// Renderer setup
const handRenderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    alpha: true 
});

handRenderer.setSize(window.innerWidth, window.innerHeight);
handRenderer.setPixelRatio(window.devicePixelRatio);
handRenderer.outputEncoding = THREE.sRGBEncoding;
handRenderer.toneMapping = THREE.ACESFilmicToneMapping;
handRenderer.toneMappingExposure = 0.7;
handRenderer.physicallyCorrectLights = true;

// Append to body
document.body.appendChild(handRenderer.domElement);
handRenderer.domElement.style.position = 'absolute';
handRenderer.domElement.style.top = '0';
handRenderer.domElement.style.left = '-40px';
handRenderer.domElement.style.zIndex = '-2';
handRenderer.domElement.style.pointerEvents = 'none';

// Camera
let handCamera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
handCamera.position.set(0, 0, 10.5);

// Controls
const handControls = new THREE.OrbitControls(handCamera, handRenderer.domElement);
handControls.enableDamping = true;
handControls.dampingFactor = 0.05;
handControls.enablePan = false;

// Store initial camera position for parallax effect
let initialHandCameraPos = handCamera.position.clone();
const handParallaxAmount = 0.3;

// Mouse tracking for parallax
let handMouseX = 0.5;
let handMouseY = 0.5;

document.addEventListener('mousemove', (event) => {
    handMouseX = event.clientX / window.innerWidth;
    handMouseY = event.clientY / window.innerHeight;
});

// get hand scale based on screen width
function getHandScale() {
    const screenWidth = window.innerWidth;
    
    if (screenWidth <= 1366) {
        return 0.025; // Smaller for 1366×768
    } else if (screenWidth <= 1536) {
        return 0.028; // Medium for 1536×864
    } else if (screenWidth >= 1920) {
        return 0.035; // Larger for 1920×1080
    }
    return 0.03; // Default
}

// Load hand model
const handLoader = new THREE.GLTFLoader();
handLoader.load('assets/3D/hand.glb', (gltf) => {
    handModel = gltf.scene;
    console.log('Hand model loaded successfully!');
    
    // Play animations if available
    if (gltf.animations && gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(handModel);
        gltf.animations.forEach((clip) => {
            mixer.clipAction(clip).play();
            console.log('Playing animation:', clip.name);
        });
        handModel.userData.mixer = mixer;
    }
    
    // Replace camera if hand.glb has one
    if (gltf.cameras && gltf.cameras.length > 0) {
        handCamera = gltf.cameras[0];
        handCamera.aspect = window.innerWidth / window.innerHeight;
        // Reduce FOV to make hand appear smaller
        handCamera.fov = 40; 
        handCamera.updateProjectionMatrix();
        handControls.object = handCamera;
        handControls.update();
    }
    
    // Store initial camera position for parallax
    initialHandCameraPos = handCamera.position.clone();
    
    // Scale down GLB lights 
    handModel.traverse((child) => {
        if (child.isLight) {
            child.intensity *= 0.003;
        }
    });
    
    // Fallback lights 
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    handScene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(5, 10, 7.5);
    handScene.add(dirLight);

    // Scale model responsively based on screen size
    const scale = getHandScale() * 0.5; // 50% smaller
    handModel.scale.set(scale, scale, scale);
    
    // Position hand - up a bit on small screens
    handModel.position.x = 0;
    if (window.innerWidth <= 1366) {
        handModel.position.y = 0.08; // move up for 13" laptops
    } else {
        handModel.position.y = -0.02;
    }
    handModel.position.z = 0;
    
    // Add model to scene
    handScene.add(handModel);
}, undefined, (error) => {
    console.error('Error loading hand model:', error);
});

// Animation loop
const clock = new THREE.Clock();

function animateHand() {
    requestAnimationFrame(animateHand);
    
    // Update animation mixer if exists
    if (handModel && handModel.userData.mixer) {
        const delta = clock.getDelta();
        handModel.userData.mixer.update(delta);
    }
    
    // Apply parallax effect based on mouse position
    handCamera.position.x = initialHandCameraPos.x + (handMouseX - 0.5) * handParallaxAmount;
    handCamera.position.y = initialHandCameraPos.y + (0.5 - handMouseY) * handParallaxAmount * 0.5;
    handCamera.position.z = initialHandCameraPos.z;
    
    handControls.update();
    handRenderer.render(handScene, handCamera);
}

animateHand();

// Handle window resize
window.addEventListener('resize', () => {
    handCamera.aspect = window.innerWidth / window.innerHeight;
    handCamera.fov = 40; // Maintain smaller FOV for smaller hand
    handCamera.updateProjectionMatrix();
    handRenderer.setSize(window.innerWidth, window.innerHeight);
    
    // Update hand scale for new screen size
    if (handModel) {
        const scale = getHandScale();
        handModel.scale.set(scale, scale, scale);
    }
});
