(function attachP5Overlay() {
  window.__p5OverlayOwnedByScript4 = true;
  if (!window.p5) return;

  const overlayHost = document.getElementById("p5Overlay");
  const nirvanaContainer = document.getElementById("nirvana");
  if (!overlayHost || !nirvanaContainer) return;

  // Ensure overlay is positioned correctly
  const st = getComputedStyle(nirvanaContainer);
  if (st.position === "static") nirvanaContainer.style.position = "relative";
  if (overlayHost.parentElement !== nirvanaContainer) nirvanaContainer.appendChild(overlayHost);

  // === STORY ===
  const STORY_LINES = [
    "For the rivers to flow, nature had to learn to let go.",
    "Before birds first flied, they had to say goodbye.",
    "Be willing to grow if you want to ever get anywhere,",
    "Embrace yourself - escape the cycle of despair."
  ];

  // === LOOK ===
const STYLE = {
  fontPath: "assets/typefaces/Legitima-Italic.ttf",
  size: 34,
  sampleFactor: 0.2,

  // particle trail stroke (ADD BACK)
  strokeRGB: [120, 30, 30],
  strokeAlpha: 40,

  // text color
 coreRGB: [255, 157, 82],
  coreAlpha: 81,

  // halo
  glowRGB: [255, 248, 200],
  haloAlpha: 200,

  // text glow (ADD THESE because your later code uses them)
  glowAlpha: 255,
  glowBlur: 45
};





  // === FIXED POSITION (no flying around) ===
  // This is where the text FORMS on screen.
  // x: 0 left → 1 right, y: 0 top → 1 bottom
  const ANCHOR = { x: 0.55, y: 0.72 };
// Per-line position offsets (0..1 of screen)
// Edit these to place each sentence wherever you want.
const LINE_POS = [
  { x: 0.37, y: 0.42 }, // line 0
  { x: 0.43, y: 0.48 }, // line 1
  { x: 0.65, y: 0.56 }, // line 2
  { x: 0.64, y: 0.64 }  // line 3
];
  // === HAND TRIGGER ===
  const SPAWN_THRESHOLD = 0.18;
  const SPAWN_COOLDOWN_MS = 1200;
  let clarity = 0; // 0..1, driven by right hand x
  new p5((p) => {
    let font;
    let particles = [];
    let lineIndex = 0;

    let revealedLines = []; // ✅ store finished lines so we can draw solid text


    let lastRightX = 0.5;
    let handMotion = 0;
    let lastSpawnMs = 0;

    function isRightOpen() {
      return window.handTracking && typeof window.handTracking.isRightOpen === "function"
        ? window.handTracking.isRightOpen()
        : false;
    }
    function getRightX() {
      return window.handTracking && typeof window.handTracking.getRightX === "function"
        ? window.handTracking.getRightX()
        : 0.5;
    }
    function isNirvanaVisible() {
      return nirvanaContainer.style.display !== "none";
    }
    function resizeToNirvana() {
      const r = nirvanaContainer.getBoundingClientRect();
      p.resizeCanvas(Math.max(1, r.width), Math.max(1, r.height));
    }

    class Particle {
      constructor(x, y, tx, ty) {
        this.x = x;
        this.y = y;
        this.tx = tx;
        this.ty = ty;
        this.a = 0;
      }
      update(clarity) {
        // clarity 0 = jittery / slow settle
        // clarity 1 = crisp / fast settle

        const settle = p.lerp(0.03, 0.14, clarity);     // how fast it snaps to target
        const jitter = p.lerp(2.4, 0.15, clarity);      // how much it jitters

        const jx = p.random(-jitter, jitter);
        const jy = p.random(-jitter, jitter);

        this.x = p.lerp(this.x, this.tx + jx, settle);
        this.y = p.lerp(this.y, this.ty + jy, settle);

        // alpha also depends on clarity
        const aSpeed = p.lerp(2.5, 12.0, clarity);
        this.a = Math.min(this.a + aSpeed, STYLE.coreAlpha);
      }

      draw() {
        // 👇 particles fade out as clarity goes up
        const particleAlphaScale = 1 - clarity * 0.85;

        // faint trail stroke
        p.stroke(
          STYLE.strokeRGB[0],
          STYLE.strokeRGB[1],
          STYLE.strokeRGB[2],
          STYLE.strokeAlpha * particleAlphaScale
        );
        p.strokeWeight(1);
        p.point(this.x, this.y);

        // bright core dot
        p.stroke(
          STYLE.coreRGB[0],
          STYLE.coreRGB[1],
          STYLE.coreRGB[2],
          this.a * particleAlphaScale
        );
        p.strokeWeight(1.6);
        p.point(this.x, this.y);
      }
      done() {
        return (
          Math.abs(this.x - this.tx) < 0.35 &&
          Math.abs(this.y - this.ty) < 0.35 &&
          this.a >= STYLE.coreAlpha
        );
      }

    }

    function spawnLine(text) {
      const w = p.width, h = p.height;

      // Fixed formation position
   const pos = LINE_POS[lineIndex] || ANCHOR;
const baseX = w * pos.x;
const baseY = h * pos.y;
      
      // Add to revealed lines immediately (no font check)
      revealedLines.push({ text, x: baseX, y: baseY, a: 0 });
      
      // Only create particle effects if font is loaded
      if (!font) {
        return;
      }
      
      // Center each line around anchor
      const textW = font.textBounds(text, 0, 0, STYLE.size).w;
      const x = baseX - textW / 2;
      const y = baseY;
      
      const pts = font.textToPoints(text, x, y, STYLE.size, {
        sampleFactor: STYLE.sampleFactor
      });

      // spawn particles from a “source cloud” near the hand zone
   const spawnX = baseX + p.random(-50, 50);
const spawnY = baseY + p.random(-50, 50);

      for (const pt of pts) {
        particles.push(
          new Particle(
            spawnX + p.random(-120, 120),
            spawnY + p.random(-90, 90),
            pt.x,
            pt.y
          )
        );
      }

      lineIndex++;
    }

    let fontLoadPromise = null;
    let fontReady = false;

    p.preload = () => {
      // Try to load custom font, but don't block if it fails
      fontLoadPromise = new Promise((resolve) => {
        try {
          font = p.loadFont(STYLE.fontPath, () => {
            console.log('✓ Custom font loaded');
            fontReady = true;
            resolve(true);
          }, (err) => {
            console.warn('⚠ Custom font failed, using default:', err);
            font = null;
            fontReady = true;
            resolve(false);
          });
        } catch (err) {
          console.warn('⚠ Font loading error:', err);
          font = null;
          fontReady = true;
          resolve(false);
        }
      });
    };

    p.setup = () => {
      const r = nirvanaContainer.getBoundingClientRect();
      const w = r.width > 0 ? r.width : window.innerWidth;
      const h = r.height > 0 ? r.height : window.innerHeight;
      const c = p.createCanvas(Math.max(1, w), Math.max(1, h));
      c.parent(overlayHost);
      p.clear();

      if (font) p.textFont(font);
      p.textStyle(p.ITALIC);

      window.addEventListener("resize", resizeToNirvana);
      resizeToNirvana();
      
      // Wait for font to load before spawning lines
      if (fontLoadPromise) {
        fontLoadPromise.then(() => {
          for (let i = 0; i < STORY_LINES.length; i++) {
            spawnLine(STORY_LINES[i]);
          }
          lineIndex = STORY_LINES.length;
          console.log('✓ All lines spawned after font ready');
        });
      } else {
        // Fallback if promise doesn't exist
        for (let i = 0; i < STORY_LINES.length; i++) {
          spawnLine(STORY_LINES[i]);
        }
        lineIndex = STORY_LINES.length;
      }
    };

    p.draw = () => {
      if (!isNirvanaVisible()) {
        p.clear();
        return;
      }

      p.clear();

      const open = isRightOpen();
      const rx = getRightX();
      const now = p.millis();
      
      // ✅ clarity is controlled by how far right the hand is
      // tweak these two numbers to set the "clear zone"
      const CLEAR_START = 0.20;
      const CLEAR_END = 0.70;
      clarity = open
        ? 1 - p.constrain((rx - CLEAR_START) / (CLEAR_END - CLEAR_START), 0, 1)
        : 0;

      // Apply blur to nirvana video based on right hand position
      const nirvanaVideo = document.querySelector('#nirvana video');
      if (nirvanaVideo && open) {
        // Map clarity (0 to 1) to blur (0px to 20px)
        // Higher clarity = more blur (flipped)
        const blurAmount = clarity * 20;
        nirvanaVideo.style.filter = `blur(${blurAmount}px)`;
      } else if (nirvanaVideo && !open) {
        nirvanaVideo.style.filter = 'blur(0px)';
      }

      // accumulate motion only when open
      if (open) {
        handMotion += Math.abs(rx - lastRightX) * 1.6 + 0.004;
        handMotion = Math.min(handMotion, 1.2);
      } else {
        handMotion = Math.max(0, handMotion - 0.02);
      }

      // spawn next line - DISABLED since all lines auto-spawn on load
      // if (
      //   open &&
      //   handMotion > SPAWN_THRESHOLD &&
      //   now - lastSpawnMs > SPAWN_COOLDOWN_MS &&
      //   lineIndex < STORY_LINES.length
      // ) {
      //   spawnLine(STORY_LINES[lineIndex]);
      //   handMotion *= 0.35;
      //   lastSpawnMs = now;
      // }

      lastRightX = rx;

      // draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.update(clarity);
        pt.draw();
        // optional cleanup when stable (keeps fps good)
        if (pt.done() && particles.length > 9000) particles.splice(i, 1);
      }
      // ✅ draw solid words (fade in) on top of particles
      p.noStroke();
      p.fill(STYLE.coreRGB[0], STYLE.coreRGB[1], STYLE.coreRGB[2]);
      p.textAlign(p.CENTER, p.BASELINE);
      p.textSize(STYLE.size);
      if (font) p.textFont(font);
      p.textStyle(p.ITALIC);

  for (let i = 0; i < revealedLines.length; i++) {
  const line = revealedLines[i];
  const a = 255 * clarity;

  // 🌕 BIG soft background glow (blurred cloud)
 // 🌫️ BLURRED HALO (real blur, not just glow)
p.noStroke();

// ⬇️ ACTUAL blur - increased for more blur effect
p.drawingContext.filter = `blur(${p.lerp(48, 28, clarity)}px)`;


// soft yellow mist color
p.fill(
  STYLE.glowRGB[0],
  STYLE.glowRGB[1],
  STYLE.glowRGB[2],
  STYLE.haloAlpha * clarity
);

// draw halo - reduced width
p.ellipse(
  line.x,
  line.y - STYLE.size * 0.35,
  STYLE.size * line.text.length * 0.55,
  STYLE.size * 1
);

// ⬆️ IMPORTANT: reset filter so text stays sharp
p.drawingContext.filter = "none";


  // ✨ TEXT GLOW (inner light)
  p.drawingContext.shadowColor =
    `rgba(${STYLE.glowRGB[0]},${STYLE.glowRGB[1]},${STYLE.glowRGB[2]},${STYLE.glowAlpha / 255})`;
  p.drawingContext.shadowBlur = STYLE.glowBlur;

  // ✍️ GOLD TEXT
  p.fill(
    STYLE.coreRGB[0],
    STYLE.coreRGB[1],
    STYLE.coreRGB[2],
    a
  );
  p.text(line.text, line.x, line.y);

  // 🧹 reset shadows so particles don’t glow
  p.drawingContext.shadowBlur = 0;
}

    };
  });
})();
