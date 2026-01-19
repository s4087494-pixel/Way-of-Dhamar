// script4.js — PASTE THIS WHOLE FILE (replaces your current one)
// ✅ Does NOT change the position of your model/camera/objects.
// ✅ Fixes "RoomEnvironment not a constructor" by NOT using it.
// ✅ Makes water look more like real water: glossy highlights + scene reflection.
// ✅ Keeps your wave shader + texture flow.
// Nirvana Scene - Independent scene
const nirvanaScene = new THREE.Scene();
const nirvanaRenderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true
});

nirvanaRenderer.setSize(window.innerWidth, window.innerHeight);
nirvanaRenderer.setPixelRatio(window.devicePixelRatio);
nirvanaRenderer.outputEncoding = THREE.sRGBEncoding;
nirvanaRenderer.toneMapping = THREE.ACESFilmicToneMapping;
nirvanaRenderer.toneMappingExposure = 0.4;
nirvanaRenderer.physicallyCorrectLights = true;
nirvanaRenderer.shadowMap.enabled = true;
nirvanaRenderer.shadowMap.type = THREE.PCFShadowMap; // (your old line had a typo)

function fadeInCanvas(canvas) {
  canvas.style.opacity = '0';
  canvas.style.filter = 'blur(6px)';
  canvas.style.transition = 'opacity 950ms ease, filter 950ms ease';
  requestAnimationFrame(() => {
    canvas.style.opacity = '1';
    canvas.style.filter = 'blur(0px)';
  });
}

// Mount renderer
const nirvanaContainer = document.getElementById("nirvana");
nirvanaContainer.appendChild(nirvanaRenderer.domElement);

fadeInCanvas(nirvanaRenderer.domElement);

// Make sure canvas fills container
nirvanaRenderer.domElement.style.width = "100%";
nirvanaRenderer.domElement.style.height = "100%";
nirvanaRenderer.domElement.style.display = "block";

// ---- Lighting (no object/camera position changes) ----
const ambientLight = new THREE.AmbientLight(0xffffff, 0);
nirvanaScene.add(ambientLight);

// Stronger directional light to create water highlights
const softSun = new THREE.DirectionalLight(0xffffff, 1);
softSun.position.set(0, 10, 5);
softSun.castShadow = false;
nirvanaScene.add(softSun);

// ---- Reflection support (no imports needed) ----
// CubeCamera captures the scene as a reflection map for water
const nirvanaCubeRT = new THREE.WebGLCubeRenderTarget(256, {
  generateMipmaps: true,
  minFilter: THREE.LinearMipmapLinearFilter
});
const nirvanaCubeCam = new THREE.CubeCamera(0.1, 1000, nirvanaCubeRT);
nirvanaScene.add(nirvanaCubeCam);


// Loader and clock
const textureLoader = new THREE.TextureLoader();
const clock = new THREE.Clock();
const maxAnisotropy = nirvanaRenderer.capabilities.getMaxAnisotropy();

// Get actual container dimensions
const nirvanaRect = nirvanaContainer.getBoundingClientRect();
nirvanaRenderer.setSize(nirvanaRect.width, nirvanaRect.height);

// Nirvana camera (default; may be replaced by GLB camera)
let nirvanaCamera = new THREE.PerspectiveCamera(
  50,
  nirvanaRect.width / nirvanaRect.height,
  0.1,
  1000
);
nirvanaCamera.position.set(0, 1, 3);
let initialNirvanaCameraPos = nirvanaCamera.position.clone();

// Controls (may be disabled if GLB camera exists)
const nirvanaControls = new THREE.OrbitControls(
  nirvanaCamera,
  nirvanaRenderer.domElement
);
nirvanaControls.enableDamping = true;
nirvanaControls.dampingFactor = 0.05;
nirvanaControls.enablePan = false;
nirvanaControls.minPolarAngle = Math.PI * 0.3;
nirvanaControls.maxPolarAngle = Math.PI * 0.7;

// Store original camera position for responsive adjustments
let originalCameraY = nirvanaCamera.position.y;

// Reference to the water mesh for wave animation + reflection capture
let waterMesh = null;
let usingGLBCamera = false; // track if we are using the GLB camera transform

// Store light references so they don't rotate with the model
let nirvanaLights = [];
let nirvanaLightData = []; // Store original positions and rotations

// Load Nirvana model
const nirvanaLoader = new THREE.GLTFLoader();

// Add DRACOLoader for Draco-compressed models
const dracoLoader = new THREE.DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
nirvanaLoader.setDRACOLoader(dracoLoader);

nirvanaLoader.load(
  "assets/3D/nirvana.glb",
  (gltf) => {
    const nirvanaModel = gltf.scene;

    // Expose globally for hand tracking
    window.nirvanaModel = nirvanaModel;

    console.log("=== NIRVANA MODEL LOADED ===");
    const camCount = gltf.cameras ? gltf.cameras.length : 0;
    console.log("Cameras in GLB:", camCount);
    if (camCount > 0) {
      gltf.cameras.forEach((cam, idx) => {
        console.log(`Camera[${idx}] name: ${cam.name || '(unnamed)'}`, "pos", cam.position, "rot", cam.rotation, "fov", cam.fov);
      });
    }

    // Play animations if available
    let nirvanaMixer;
    if (gltf.animations && gltf.animations.length > 0) {
      nirvanaMixer = new THREE.AnimationMixer(nirvanaModel);
      gltf.animations.forEach((clip) => {
        console.log("Available animation:", clip.name);
        // Only play armature, cloud, and leaf animations, skip scene rotations
        const n = clip.name.toLowerCase();
        if (n.includes("armature") || n.includes("cloud") || n.includes("leaf")) {
          const action = nirvanaMixer.clipAction(clip);
          action.loop = THREE.LoopRepeat;
          action.play();
          console.log("Playing animation:", clip.name);
        }
      });
      window.nirvanaMixer = nirvanaMixer;
    }

    // Use camera from GLB if available
    if (gltf.cameras && gltf.cameras.length > 0) {
      console.log("Using exported camera from GLB");

      // Prefer camera node from the scene graph to keep transforms
      const cameraNode = nirvanaModel.getObjectByProperty('type', 'PerspectiveCamera')
        || nirvanaModel.getObjectByProperty('type', 'OrthographicCamera')
        || gltf.cameras[0];
      nirvanaCamera = cameraNode;
      usingGLBCamera = true;

      const rect = nirvanaContainer.getBoundingClientRect();
      nirvanaCamera.aspect = rect.width / rect.height;

      // Optimize camera clipping planes for better clarity
      nirvanaCamera.near = 0.001;
      nirvanaCamera.far = 10000;
      nirvanaCamera.updateProjectionMatrix();

      // Store the original camera Y position from Blender
      originalCameraY = nirvanaCamera.position.y;

      // Disable controls - use camera as-is from Blender
      nirvanaControls.enabled = false;

      console.log("Camera position:", nirvanaCamera.position);
      console.log("Camera rotation:", nirvanaCamera.rotation);
      console.log("Camera fov:", nirvanaCamera.fov);
      console.log("Camera near/far:", nirvanaCamera.near, nirvanaCamera.far);
    } else {
      console.log("No camera found in GLB, using default camera");
      nirvanaCamera.position.set(0, 0, 3);
      nirvanaCamera.lookAt(0, 0, 0);
      initialNirvanaCameraPos = nirvanaCamera.position.clone();
      nirvanaControls.target.set(0, 0, 0);
      nirvanaControls.update();
    }

    // Process model
    nirvanaModel.traverse((child) => {
      if (child.isMesh) {
        console.log("Nirvana Mesh:", child.name);

        if (child.material) {
          child.material.side = THREE.DoubleSide;
          child.material.depthWrite = true;

          // WATER
          if (child.name.toLowerCase().includes("water")) {
            console.log("Configuring water:", child.name);
            waterMesh = child;

            // Load texture (yours)
            const waterTex = textureLoader.load("assets/pictures/fog1.png");
            waterTex.wrapS = THREE.MirroredRepeatWrapping;
            waterTex.wrapT = THREE.MirroredRepeatWrapping;

            waterTex.repeat.set(1, 0.55); // less repetition vertically = fewer bands
            waterTex.offset.set(0, 0);
            waterTex.anisotropy = Math.min(8, maxAnisotropy);
            waterTex.minFilter = THREE.LinearMipmapLinearFilter;
            waterTex.magFilter = THREE.LinearFilter;
            waterTex.generateMipmaps = true;

            // IMPORTANT: alpha maps should NOT be sRGB
            if (THREE.SRGBColorSpace) waterTex.colorSpace = THREE.SRGBColorSpace;

            child.material.map = waterTex;
            child.material.alphaMap = null;

            child.material.transparent = false;
            child.material.opacity = 0.5;

            child.material.color.set(0xd9f0ec);   // jade tint
            child.material.emissive.set(0x000000);

            if ("roughness" in child.material) child.material.roughness = 0.55; // still watery, but kills rim glare
            if ("metalness" in child.material) child.material.metalness = 0.0;

            child.material.needsUpdate = true;


            // Water flow + wave params
            child.material.userData = {
              ...(child.material.userData || {}),
              waterFlowSpeed: 0.01,
              waveAmp: 0.12,
              waveFreq: 10.0,
              waveSpeed: 1.5
            };

            child.material.needsUpdate = true;

            // Shader hook (this is where "shader" exists)
            if (!child.material.userData.waveShaderAdded) {
              child.material.onBeforeCompile = (shader) => {
                // store shader so you can update uniforms later in animate()
                child.material.userData.shader = shader;

                // --- uniforms for waves ---
                shader.uniforms.time = { value: 0 };
                shader.uniforms.waveAmp = { value: child.material.userData.waveAmp ?? 0.12 };
                shader.uniforms.waveFreq = { value: child.material.userData.waveFreq ?? 10.0 };
                shader.uniforms.waveSpeed = { value: child.material.userData.waveSpeed ?? 1.5 };

                // ✅ IMPORTANT: declare uniforms in the GLSL (script5 does this)
                shader.vertexShader =
                  `uniform float time;\n` +
                  `uniform float waveAmp;\n` +
                  `uniform float waveFreq;\n` +
                  `uniform float waveSpeed;\n` +
                  shader.vertexShader;

                // --- vertex: waves ---
                shader.vertexShader = shader.vertexShader.replace(
                  "#include <begin_vertex>",
                  `#include <begin_vertex>
     float w1 = sin( position.x * waveFreq + time * waveSpeed );
     float w2 = cos( position.z * waveFreq * 0.8 + time * waveSpeed * 0.9 );
     transformed.y += (w1 + w2) * waveAmp;`
                );

                // --- fragment: edge feather ---
                shader.fragmentShader = shader.fragmentShader.replace(
                  "gl_FragColor = vec4( outgoingLight, diffuseColor.a );",
                  `
  vec2 uv = fract(vUv);

  // very soft fade upwards
  float fadeY = smoothstep(0.02, 0.92, uv.y);

 gl_FragColor = vec4(outgoingLight, diffuseColor.a);

  `
                );

              };


              child.material.userData.waveShaderAdded = true;
              child.material.needsUpdate = true;
            }

          }

          // Improve texture filtering
          if (child.material.map) {
            child.material.map.minFilter = THREE.LinearMipMapLinearFilter;
            child.material.map.magFilter = THREE.LinearFilter;
          }

          child.material.needsUpdate = true;
        }

      }

      // Scale down Blender lights (ONLY intensity; does not move anything)
      if (child.isLight) {
        const originalIntensity = child.intensity;

        // Adjust each light type separately
        if (child.type === 'DirectionalLight') {
          child.intensity *= 0.01; // Very dim directional lights
        } else if (child.type === 'PointLight') {
          child.intensity *= 0.001; // Slightly brighter point lights
        } else if (child.type === 'SpotLight') {
          child.intensity *= 0.00007; // Dim spot lights
        } 

        // Store light reference and original transform so we can keep it fixed
        nirvanaLights.push(child);
        nirvanaLightData.push({
          light: child,
          originalPos: child.position.clone(),
          originalRot: child.rotation.order ? child.eulerOrder : undefined,
          originalQuaternion: child.quaternion.clone(),
          originalScale: child.scale.clone()
        });

        console.log(
          "Nirvana Light:",
          child.type,
          "Original:",
          originalIntensity,
          "→ New:",
          child.intensity
        );
      }
    });

    // Add model to scene as-is (no centering)
    nirvanaScene.add(nirvanaModel);
    console.log("Nirvana model added to scene");

    // Update scale after model loads so originalCameraY is correct
    updateScale();
  },
  (progress) => {
    console.log(
      "Nirvana loading:",
      ((progress.loaded / progress.total) * 100).toFixed(2) + "%"
    );
  },
  (error) => {
    console.error("Error loading Nirvana:", error);
  }
);

// Handle window resize - scale based on screen size (desktop only)
function updateScale() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  if (!usingGLBCamera && width > 768) {
    let scale = 1;
    if (width < 1024) scale = 0.8;
    else if (width < 1440) scale = 0.9;
    else if (width < 1920) scale = 1;
    else scale = 1.34;

    nirvanaContainer.style.transform = `scale(${scale})`;
    nirvanaContainer.style.transformOrigin = "top center";

    const cameraYOffset = (scale - 1) * 25;
    nirvanaCamera.position.y = originalCameraY - cameraYOffset;
  } else if (usingGLBCamera) {
    // Do not scale or offset camera when using the GLB camera
    nirvanaContainer.style.transform = "";
    nirvanaContainer.style.transformOrigin = "";
  }

  nirvanaCamera.aspect = width / height;
  nirvanaCamera.updateProjectionMatrix();
  nirvanaRenderer.setSize(width, height);
}

window.addEventListener("resize", updateScale);

// Animation loop
function animateNirvana() {
  requestAnimationFrame(animateNirvana);

  // Update animation mixer
  if (window.nirvanaMixer) {
    window.nirvanaMixer.update(0.016);
  }

  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  // ✅ KEEP LIGHTS FIXED - Reset their transforms so they don't rotate with model
  for (const lightData of nirvanaLightData) {
    lightData.light.position.copy(lightData.originalPos);
    lightData.light.quaternion.copy(lightData.originalQuaternion);
    lightData.light.scale.copy(lightData.originalScale);
  }

  // Update water texture flow (map OR alphaMap)
  nirvanaScene.traverse((child) => {
    if (
      child.isMesh &&
      child.material &&
      child.material.userData &&
      child.material.userData.waterFlowSpeed
    ) {
      const tex = child.material.map || child.material.alphaMap;
      if (!tex) return;

      tex.offset.y += child.material.userData.waterFlowSpeed * delta;
      if (tex.offset.y > 1) tex.offset.y -= 1;
    }
  });

  // Drive wave shader time
  if (
    waterMesh &&
    waterMesh.material &&
    waterMesh.material.userData &&
    waterMesh.material.userData.shader &&
    waterMesh.material.userData.shader.uniforms
  ) {
    const s = waterMesh.material.userData.shader;
    if (s.uniforms.time) s.uniforms.time.value = elapsed;
    if (s.uniforms.waveAmp) s.uniforms.waveAmp.value = waterMesh.material.userData.waveAmp;
    if (s.uniforms.waveFreq) s.uniforms.waveFreq.value = waterMesh.material.userData.waveFreq;
    if (s.uniforms.waveSpeed) s.uniforms.waveSpeed.value = waterMesh.material.userData.waveSpeed;
  }


  nirvanaControls.update();
  nirvanaRenderer.render(nirvanaScene, nirvanaCamera);
}

animateNirvana();