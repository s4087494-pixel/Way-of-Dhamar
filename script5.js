// Asura Scene - Independent scene
const asuraScene = new THREE.Scene();
asuraScene.background = new THREE.Color(0x404040); // Darker gray background

const asuraRenderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
});

asuraRenderer.setSize(window.innerWidth, window.innerHeight);
asuraRenderer.setPixelRatio(window.devicePixelRatio);
asuraRenderer.outputEncoding = THREE.sRGBEncoding;
asuraRenderer.toneMapping = THREE.ACESFilmicToneMapping;
asuraRenderer.toneMappingExposure = 0.01; // Increased from 0.8
asuraRenderer.physicallyCorrectLights = true;
asuraRenderer.shadowMap.enabled = true;
asuraRenderer.shadowMap.type = THREE.PCFShadowMap;

function fadeInCanvas(canvas) {
    canvas.style.opacity = '0';
    canvas.style.filter = 'blur(6px)';
    canvas.style.transition = 'opacity 950ms ease, filter 950ms ease';
    requestAnimationFrame(() => {
        canvas.style.opacity = '1';
        canvas.style.filter = 'blur(0px)';
    });
}

const asuraContainer = document.getElementById("asura");
asuraContainer.appendChild(asuraRenderer.domElement);

fadeInCanvas(asuraRenderer.domElement);

// Canvas style; final size set in updateAsuraViewport()
asuraRenderer.domElement.style.display = "block";

// No additional lights - we'll use the lights from Blender GLB instead

// Loader and clock for textures and animation (use asura-specific names to avoid conflicts)
const asuraTextureLoader = new THREE.TextureLoader();
const asuraAnimClock = new THREE.Clock();
const asuraMaxAnisotropy = asuraRenderer.capabilities.getMaxAnisotropy();

// Reference to the water mesh for wave animation
let asuraWaterMesh = null;

// Store light references so they don't rotate with the model
let asuraLights = [];
let asuraLightData = []; // Store original positions and rotations

// Get actual container dimensions
const asuraRect = asuraContainer.getBoundingClientRect();
asuraRenderer.setSize(asuraRect.width, asuraRect.height);

// Asura camera
let asuraCamera = new THREE.PerspectiveCamera(
    50,
    asuraRect.width / asuraRect.height,
    0.1,
    1000
);
asuraCamera.position.set(0, 1, 2.5);

// No controls - camera position is fixed from viewport

// Load Asura model
const asuraLoader = new THREE.GLTFLoader();
asuraLoader.load(
    "assets/3D/asura.glb",
    (gltf) => {
        const asuraModel = gltf.scene;

        // Expose globally for hand tracking
        window.asuraModel = asuraModel;

        console.log("=== ASURA MODEL LOADED ===");
        const camCount = gltf.cameras ? gltf.cameras.length : 0;
        console.log("Cameras in Asura GLB:", camCount);
        if (camCount > 0) {
            gltf.cameras.forEach((cam, idx) => {
                console.log(`Asura Camera[${idx}] name: ${cam.name || '(unnamed)'}`, "pos", cam.position, "rot", cam.rotation, "fov", cam.fov);
            });
        }

        // Play animations if available
        let asuraMixer;
        if (gltf.animations && gltf.animations.length > 0) {
            asuraMixer = new THREE.AnimationMixer(asuraModel);
            gltf.animations.forEach((clip) => {
                console.log("Asura animation:", clip.name);
                const action = asuraMixer.clipAction(clip);
                action.loop = THREE.LoopRepeat;
                action.play();
            });
            window.asuraMixer = asuraMixer;
        }

        // Use camera from GLB if available
        if (gltf.cameras && gltf.cameras.length > 0) {
            console.log("Using exported camera from Asura GLB");
            asuraCamera = gltf.cameras[0];

            // Log detailed camera info from Blender
            console.log("=== CAMERA FROM BLENDER ===");
            console.log("Position:", asuraCamera.position.x, asuraCamera.position.y, asuraCamera.position.z);
            console.log("Rotation (Euler):", asuraCamera.rotation.x, asuraCamera.rotation.y, asuraCamera.rotation.z);
            console.log("Quaternion:", asuraCamera.quaternion.x, asuraCamera.quaternion.y, asuraCamera.quaternion.z, asuraCamera.quaternion.w);
            console.log("FOV:", asuraCamera.fov);
            console.log("Original Near:", asuraCamera.near);
            console.log("Original Far:", asuraCamera.far);

            // IMPORTANT: Get dimensions when scene is visible
            const rect = asuraContainer.getBoundingClientRect();
            const width = rect.width || window.innerWidth;
            const height = rect.height || window.innerHeight;

            console.log("Container dimensions:", width, "x", height);

            // Match camera aspect to container so model fills screen
            asuraCamera.aspect = width / height;
            asuraCamera.updateProjectionMatrix();
            asuraRenderer.setSize(width, height);

            console.log("=== FINAL CAMERA STATE ===");
            console.log("Aspect ratio (stretched to container):", asuraCamera.aspect);
            console.log("Camera matrix applied");
        } else {
            console.log("No camera found in Asura GLB, using default camera");
            asuraCamera.position.set(0, 0, 5);
            asuraCamera.lookAt(0, 0, 0);
        }

        // Process model materials
        asuraModel.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.side = THREE.DoubleSide;
                child.castShadow = true;
                child.receiveShadow = true;

                // WATER - Apply water texture and shaders
                if (child.name.toLowerCase().includes("water")) {
                    console.log("WATER material type:", child.material.type);
                    console.log("Configuring water:", child.name);
                    console.log("WATER HIT:", child.name, child.uuid);
                    asuraWaterMesh = child;
                    // ✅ NO texture — pure tinted water
                    child.material.map = null;
                    child.material.alphaMap = null;

                    child.material.transparent = true;  // allow soft blending
     child.material.opacity = 1.0;

                    child.material.color.setHex(0x380C07); // dark cherry red
                    child.material.emissive.setHex(0x000000);
                    child.material.emissiveIntensity = 0.0;

                    child.material.metalness = 0.0;
                    child.material.roughness = 0.35;


                    child.material.needsUpdate = true;


                    // Water flow + wave params
                    child.material.userData = {
                        ...(child.material.userData || {}),
                        waterFlowSpeed: 0.025,
                        waveAmp: 0.12,
                        waveFreq: 10.0,
                        waveSpeed: 1.5
                    };

                    child.material.needsUpdate = true;

                    // Wave vertex displacement shader
                    if (!child.material.userData.waveShaderAdded) {
                        if (!child.material.userData.waveShaderAdded) {
                            child.material.onBeforeCompile = (shader) => {
                                child.material.userData.shader = shader;

                                shader.uniforms.time = { value: 0 };
                                shader.uniforms.waveAmp = { value: child.material.userData.waveAmp ?? 0.06 };
                                shader.uniforms.waveFreq = { value: child.material.userData.waveFreq ?? 6.0 };
                                shader.uniforms.waveSpeed = { value: child.material.userData.waveSpeed ?? 0.6 };

                                shader.vertexShader =
                                    `uniform float time;\n` +
                                    `uniform float waveAmp;\n` +
                                    `uniform float waveFreq;\n` +
                                    `uniform float waveSpeed;\n` +
                                    shader.vertexShader;
                                // add varying to pass world Y into fragment
                                shader.vertexShader =
                                    `varying float vWorldY;\n` +
                                    shader.vertexShader;

                                // write world y
                                shader.vertexShader = shader.vertexShader.replace(
                                    "#include <project_vertex>",
                                    `
  #include <project_vertex>
  vec4 wPos = modelMatrix * vec4(transformed, 1.0);
  vWorldY = wPos.y;
  `
                                );

                                shader.fragmentShader =
                                    `varying float vWorldY;\n` +
                                    shader.fragmentShader;

                                shader.vertexShader = shader.vertexShader.replace(
                                    "#include <begin_vertex>",
                                    `#include <begin_vertex>
       float t = time * waveSpeed;
       transformed.y += sin(position.x * waveFreq + t) * waveAmp;
       transformed.y += cos(position.z * waveFreq * 0.8 + t * 1.1) * waveAmp * 0.6;`
                                );

                                // ✅ Soft edge fade (kills harsh rims/lines)
                                shader.fragmentShader = shader.fragmentShader.replace(
                                    "gl_FragColor = vec4( outgoingLight, diffuseColor.a );",
                                    `
    // ✅ smooth fade based on world height (kills harsh UV band)
    float y0 = 0.15;   // start fading (adjust)
    float y1 = 0.60;   // fully visible (adjust)

    float fade = smoothstep(y0, y1, vWorldY);
    float minA = 0.35; // keep tint in "transparent" zones
    float a = mix(minA, 1.0, fade);

    gl_FragColor = vec4(outgoingLight, diffuseColor.a * a);
  `
                                );

                            };

                            child.material.userData.waveShaderAdded = true;
                            child.material.needsUpdate = true;
                        }


                        child.material.userData.waveShaderAdded = true;
                        child.material.needsUpdate = true;
                    }
                }

                // Improve texture filtering
                if (child.material.map) {
                    child.material.map.minFilter = THREE.LinearMipMapLinearFilter;
                    child.material.map.magFilter = THREE.LinearFilter;
                }
            }

            // Scale Blender lights
            if (child.isLight) {
                console.log("Blender light found:", child.type, "original intensity:", child.intensity);
                child.intensity *= 0.5;
                console.log("Scaled intensity:", child.intensity);

                // Store light reference and original transform so we can keep it fixed
                asuraLights.push(child);
                asuraLightData.push({
                    light: child,
                    originalPos: child.position.clone(),
                    originalRot: child.rotation.order ? child.eulerOrder : undefined,
                    originalQuaternion: child.quaternion.clone(),
                    originalScale: child.scale.clone()
                });
            }
        });

        // Add model to scene
        asuraScene.add(asuraModel);
        console.log("Asura model added to scene");
    },
    (progress) => {
        console.log(
            "Asura loading:",
            ((progress.loaded / progress.total) * 100).toFixed(2) + "%"
        );
    },
    (error) => {
        console.error("Error loading Asura:", error);
    }
);

// Handle window resize
function updateAsuraScale() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Update camera aspect ratio
    if (asuraCamera) {
        asuraCamera.aspect = width / height;
        asuraCamera.updateProjectionMatrix();
    }

    // Update renderer size
    asuraRenderer.setSize(width, height);
    asuraRenderer.setClearColor(0x101010, 1);
}

window.addEventListener("resize", updateAsuraScale);

// Animation loop
function animateAsura() {
    requestAnimationFrame(animateAsura);

    // Update animation mixer
    if (window.asuraMixer) {
        window.asuraMixer.update(0.016);
    }

    const delta = asuraAnimClock.getDelta();
    const elapsed = asuraAnimClock.getElapsedTime();

    // ✅ KEEP LIGHTS FIXED - Reset their transforms so they don't rotate with model
    for (const lightData of asuraLightData) {
        lightData.light.position.copy(lightData.originalPos);
        lightData.light.quaternion.copy(lightData.originalQuaternion);
        lightData.light.scale.copy(lightData.originalScale);
    }

    // Update water texture flow
    asuraScene.traverse((child) => {
        if (
            child.isMesh &&
            child.material &&
            child.material.map &&
            child.material.userData &&
            child.material.userData.waterFlowSpeed
        ) {

        }
    });

    // Drive wave shader time
    if (
        asuraWaterMesh &&
        asuraWaterMesh.material &&
        asuraWaterMesh.material.userData &&
        asuraWaterMesh.material.userData.shader &&
        asuraWaterMesh.material.userData.shader.uniforms
    ) {
        const s = asuraWaterMesh.material.userData.shader;
        if (s.uniforms.time) s.uniforms.time.value = elapsed;
        if (s.uniforms.waveAmp) s.uniforms.waveAmp.value = asuraWaterMesh.material.userData.waveAmp;
        if (s.uniforms.waveFreq) s.uniforms.waveFreq.value = asuraWaterMesh.material.userData.waveFreq;
        if (s.uniforms.waveSpeed) s.uniforms.waveSpeed.value = asuraWaterMesh.material.userData.waveSpeed;
    }

    asuraRenderer.render(asuraScene, asuraCamera);
}

animateAsura();
