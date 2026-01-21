

let particles = [];
let lastX = null;
let lastY = null;
let isDragging = false;


const BG = { r: 0, g: 0, b: 0, a: 0 };     
const TRAIL_FADE_ALPHA = 15;               
const INK = { r: 40, g: 80, b: 70 };             
const SPAWN = {
  rate: 1.3,            
  startAlpha: 120,      
  size: 3,
  minMove: 3,       
  density: 1         
};
const KILL_ALPHA = 3;                           
const MAX_PARTICLES = 5000;                   
const NOISE_SCALE = 0.002;
const VELOCITY_RANDOM = 0.8;

function setup() {
  const cnv = createCanvas(windowWidth, windowHeight);
  clear(); 
 
  cnv.canvas.style.pointerEvents = 'none';
  cnv.style('position', 'fixed');
  cnv.style('top', '0');
  cnv.style('left', '0');
  cnv.style('z-index', '12');
  lastX = mouseX;
  lastY = mouseY;
}

function draw() {
  drawingContext.save();
  drawingContext.globalCompositeOperation = 'destination-out';
  noStroke();
  fill(0, 0, 0, TRAIL_FADE_ALPHA);
  rect(0, 0, width, height);
  drawingContext.restore();


  if (isDragging) {
    spawnOnMove(mouseX, mouseY);
  }

  
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update(particles);
    particles[i].show();
    if (particles[i].alpha <= KILL_ALPHA) particles.splice(i, 1);
  }
}

function spawnOnMove(x, y) {
  if (lastX === null || lastY === null) {
    lastX = x; lastY = y;
    return;
  }

  const dx = x - lastX;
  const dy = y - lastY;
  const d = Math.hypot(dx, dy);

  if (d >= SPAWN.minMove) {
   
    const steps = Math.max(1, Math.floor(d / 12)); 
    for (let s = 0; s < steps; s++) {
      const t = steps === 1 ? 1 : s / (steps - 1);
      const px = lastX + dx * t;
      const py = lastY + dy * t;

      for (let k = 0; k < SPAWN.density; k++) {
        if (particles.length < MAX_PARTICLES) {
          particles.push(new Particle(px, py, SPAWN.rate, SPAWN.startAlpha, SPAWN.size));
        }
      }
    }

    lastX = x;
    lastY = y;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function mousePressed() {
  // Create ink burst on click with outward velocities
  if (particles.length < MAX_PARTICLES - 100) {
    for (let i = 0; i < 120; i++) {
      const angle = random(TWO_PI);
      const radius = random(2, 24);
      const speed = random(0.6, 2.2);
      const px = mouseX + cos(angle) * radius;
      const py = mouseY + sin(angle) * radius;
      const vx = cos(angle) * speed + random(-0.2, 0.2);
      const vy = sin(angle) * speed + random(-0.2, 0.2);
      particles.push(new Particle(px, py, SPAWN.rate * 0.9, SPAWN.startAlpha, random(2, 5), vx, vy));
    }
  }

  isDragging = true;
  lastX = mouseX;
  lastY = mouseY;
}

function mouseReleased() {
  isDragging = false;
}

function touchStarted() {
  isDragging = true;
  lastX = touches.length > 0 ? touches[0].x : mouseX;
  lastY = touches.length > 0 ? touches[0].y : mouseY;
  return false;
}

function touchEnded() {
  isDragging = false;
  return false;
}

// Touch support: draw by finger drag
function touchMoved() {
  if (isDragging && touches.length > 0) {
    spawnOnMove(touches[0].x, touches[0].y);
  }
  return false; // prevent page scroll
}


class Particle {
  constructor(x, y, r, a, s, vx = null, vy = null) {
    this.location = createVector(x, y);
    if (vx !== null && vy !== null) {
      this.velocity = createVector(vx, vy);
    } else {
      this.velocity = createVector(
        random(-VELOCITY_RANDOM, VELOCITY_RANDOM),
        random(-VELOCITY_RANDOM, VELOCITY_RANDOM)
      );
    }
    this.acceleration = createVector();

    this.alpha = this.palpha = a;
    this.rate = r;
    this.amp = s;
  }

  update(p) {
    const nx = this.location.x * NOISE_SCALE;
    const ny = this.location.y * NOISE_SCALE;

    const ax = noise(nx, ny) * 2 - 1;
    const ay = noise(ny, nx) * 2 - 1;

    this.acceleration.add(ax, ay);
    this.velocity.add(this.acceleration);
    this.acceleration.mult(0);

    // damp velocity for tighter motion
    this.velocity.mult(0.95);

    this.location.add(this.velocity);
    this.alpha -= this.rate;


  }

  show() {
    noStroke();
    fill(INK.r, INK.g, INK.b, this.alpha);
    ellipse(this.location.x, this.location.y, this.amp);
  }
}
