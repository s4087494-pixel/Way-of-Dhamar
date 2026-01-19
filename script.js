// Scene setup
const scene = new THREE.Scene();

let camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById('buddha-container').appendChild(renderer.domElement);
// Color management and tone mapping to avoid blown-out highlights
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;
renderer.physicallyCorrectLights = true;

// Default camera position
camera.position.set(0, 2, 10);
camera.lookAt(0, 0, 0);

// OrbitControls for mouse interaction
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.autoRotate = false;
controls.enablePan = false;
controls.minPolarAngle = Math.PI * 0.3; // Limit vertical rotation
controls.maxPolarAngle = Math.PI * 0.7;

// Store initial camera position for parallax effect
let initialCameraPos = camera.position.clone();
const parallaxAmount = 0.3;

// Buddha model reference for animation
let buddhaModel = null;
let buddhaMixer = null;

// Mouse tracking for parallax
let mouseX = 0.5;
let mouseY = 0.5;

document.addEventListener('mousemove', (event) => {
    mouseX = event.clientX / window.innerWidth;
    mouseY = event.clientY / window.innerHeight;
});

// GLTF Loader
const loader = new THREE.GLTFLoader();

// Load Buddha model
loader.load('assets/3D/buddha.glb', (gltf) => {
    const model = gltf.scene;
    buddhaModel = model; // Store reference for animation
    
    // Load animations if available
    if (gltf.animations && gltf.animations.length > 0) {
        buddhaMixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach((clip) => {
            const action = buddhaMixer.clipAction(clip);
            action.loop = THREE.LoopRepeat; // Loop the animation
            action.play();
            console.log('Playing Buddha animation:', clip.name);
        });
    }
    
    console.log('=== BUDDHA MODEL LOADED ===');
    
    // Check for exported camera
    if (gltf.cameras && gltf.cameras.length > 0) {
        console.log('Using exported Blender camera');
        camera = gltf.cameras[0];
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        controls.object = camera;
        initialCameraPos = camera.position.clone();
    }
    
    // Process Buddha model
    model.traverse((child) => {
        if (child.isMesh) {
            console.log('Mesh:', child.name);
            
            // Enable transparency
            if (child.material) {
                child.material.transparent = true;
                child.material.needsUpdate = true;
            }
        }
        
        // Scale down Blender lights drastically (they're often 50k+ intensity)
        if (child.isLight) {
            const originalIntensity = child.intensity;
            child.intensity *= 0.005; // Scale down but keep visible
            console.log('Buddha Light:', child.type, 'Original:', originalIntensity, '→ Scaled:', child.intensity);
        }
    });
    
    // Center the model
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    console.log('Buddha size:', size);
    console.log('Buddha center:', center);
    
    model.position.sub(center);
    
    scene.add(model);
    console.log('Buddha model added to scene');
    
    // Adjust camera to view the model
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 1.5; // Add some buffer
    
    camera.position.z = cameraZ;
    controls.target.set(0, 0, 0);
    controls.update();
    
    console.log('Camera positioned at z:', cameraZ);
    
}, (progress) => {
    console.log('Buddha loading:', (progress.loaded / progress.total * 100).toFixed(2) + '%');
}, (error) => {
    console.error('Error loading Buddha:', error);
});

// No extra scene lights; using only lights exported from Blender.

// Handle window resize
window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    renderer.setSize(width, height);
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Update animation mixer for buddha
    if (buddhaMixer) {
        buddhaMixer.update(0.016); // ~60fps
    }
    
    // Apply parallax effect based on mouse position
    camera.position.x = initialCameraPos.x + (mouseX - 0.5) * parallaxAmount;
    camera.position.y = initialCameraPos.y + (0.5 - mouseY) * parallaxAmount * 0.5;
    camera.position.z = initialCameraPos.z;
    camera.lookAt(0, 1, 0);
    
    controls.update();
    renderer.render(scene, camera);
}

animate();
