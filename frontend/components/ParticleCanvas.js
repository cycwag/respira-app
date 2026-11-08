'use client';

import { useEffect, useRef } from 'react';

export default function ParticleCanvas({ particleCount = 38 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const colors = [
      'rgba(92, 74, 228, 0.45)',
      'rgba(56, 189, 248, 0.4)',
      'rgba(168, 85, 247, 0.35)',
      'rgba(214, 249, 59, 0.3)',
      'rgba(148, 163, 184, 0.35)'
    ];

    function resizeCanvas() {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }

    window.addEventListener('resize', resizeCanvas);

    class Particle {
      constructor() {
        this.reset(true);
      }

      reset(initial = false) {
        this.x = Math.random() * width;
        this.y = initial ? Math.random() * height : height + 10;
        this.radius = Math.random() * 3 + 1.2;
        this.speedY = Math.random() * 0.45 + 0.2;
        this.speedX = (Math.random() - 0.5) * 0.3;
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.alpha = Math.random() * 0.5 + 0.25;
        this.pulseSpeed = Math.random() * 0.02 + 0.01;
        this.pulseAngle = Math.random() * Math.PI * 2;
        this.wobbleSpeed = Math.random() * 0.02 + 0.005;
        this.wobbleAngle = Math.random() * Math.PI * 2;
      }

      update() {
        this.y -= this.speedY;
        this.wobbleAngle += this.wobbleSpeed;
        this.x += Math.sin(this.wobbleAngle) * 0.5 + this.speedX;

        this.pulseAngle += this.pulseSpeed;
        this.currentAlpha = this.alpha + Math.sin(this.pulseAngle) * 0.15;

        if (this.y < -20 || this.x < -20 || this.x > width + 20) {
          this.reset(false);
        }
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = this.radius * 2.5;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    const particles = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function animate() {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
      }
      animationFrameId = requestAnimationFrame(animate);
    }

    if (!prefersReducedMotion) {
      animate();
    }

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [particleCount]);

  return <canvas ref={canvasRef} className="particles-bg" aria-hidden="true" />;
}
