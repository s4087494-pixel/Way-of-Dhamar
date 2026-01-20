// script5.js — Asura Scene with Video (No Three.js)
const asuraContainer = document.getElementById("asura");

// Create video element
const asuraVideo = document.createElement('video');
asuraVideo.src = 'assets/animation/asura.mp4';
asuraVideo.loop = true;
asuraVideo.muted = true;
asuraVideo.playsInline = true;
asuraVideo.autoplay = true;
asuraVideo.style.width = '100vw';
asuraVideo.style.height = '100vh';
asuraVideo.style.objectFit = 'cover';
asuraVideo.style.display = 'block';
asuraVideo.style.position = 'fixed';
asuraVideo.style.top = '0';
asuraVideo.style.left = '0';

// Add video to container
asuraContainer.appendChild(asuraVideo);

// Start video playback
asuraVideo.play().catch(err => {
  console.log('Video autoplay prevented, waiting for user interaction:', err);
  document.addEventListener('click', () => {
    asuraVideo.play();
  }, { once: true });
});

// Expose globally for hand tracking compatibility
window.asuraModel = asuraVideo;

console.log('Asura video loaded');

