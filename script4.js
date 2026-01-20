// script4.js — Nirvana Scene with Video (No Three.js)
const nirvanaContainer = document.getElementById("nirvana");

// Create video element
const nirvanaVideo = document.createElement('video');
nirvanaVideo.src = 'assets/animation/nirvana.mp4';
nirvanaVideo.loop = true;
nirvanaVideo.muted = true;
nirvanaVideo.playsInline = true;
nirvanaVideo.autoplay = true;
nirvanaVideo.style.width = '100vw';
nirvanaVideo.style.height = '100vh';
nirvanaVideo.style.objectFit = 'cover';
nirvanaVideo.style.display = 'block';
nirvanaVideo.style.position = 'fixed';
nirvanaVideo.style.top = '0';
nirvanaVideo.style.left = '0';

// Add video to container
nirvanaContainer.appendChild(nirvanaVideo);

// Start video playback
nirvanaVideo.play().catch(err => {
  console.log('Video autoplay prevented, waiting for user interaction:', err);
  document.addEventListener('click', () => {
    nirvanaVideo.play();
  }, { once: true });
});

// Expose globally for hand tracking compatibility
window.nirvanaModel = nirvanaVideo;

console.log('Nirvana video loaded');
