/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useRef } from 'react';

function createParticles(count) {
  const particles = new Array(count);
  for (let i = 0; i < count; i++) {
    particles[i] = {
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.00018,
      vy: (Math.random() - 0.5) * 0.00012,
      radius: 0.8 + Math.random() * 1.3,
      alpha: 0.14 + Math.random() * 0.34,
      phase: Math.random() * Math.PI * 2,
    };
  }
  return particles;
}

const AmbientParticles = ({ isActive = true }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(0);
  const frameClockRef = useRef(0);
  const particlesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let disposed = false;
    let running = false;
    let targetFrameMs = 1000 / 26;

    const reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');

    const isDarkTheme = () => document.documentElement.classList.contains('dark');

    const setupParticles = (reducedMotion) => {
      const count = reducedMotion
        ? 10
        : width < 640
          ? 18
          : width < 1024
            ? 26
            : 34;
      particlesRef.current = createParticles(count);
      targetFrameMs = reducedMotion ? 1000 : width < 768 ? 1000 / 22 : 1000 / 26;
    };

    const resize = () => {
      width = canvas.clientWidth || canvas.parentElement?.clientWidth || 0;
      height = canvas.clientHeight || canvas.parentElement?.clientHeight || 0;
      if (!width || !height) return;

      const dpr = Math.min(window.devicePixelRatio || 1, width < 768 ? 1.35 : 1.7);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      setupParticles(reducedMotionMedia.matches);
    };

    const draw = (timestamp) => {
      if (!width || !height) return;

      const dark = isDarkTheme();
      const pointColor = dark
        ? 'rgba(173, 205, 255,'
        : 'rgba(37, 99, 235,';
      const lineColor = dark
        ? 'rgba(125, 176, 255,'
        : 'rgba(59, 130, 246,';

      ctx.clearRect(0, 0, width, height);

      const halo = ctx.createRadialGradient(
        width * 0.78,
        height * 0.2,
        0,
        width * 0.78,
        height * 0.2,
        Math.max(width, height) * 0.66,
      );
      halo.addColorStop(0, dark ? 'rgba(96, 165, 250, 0.12)' : 'rgba(59, 130, 246, 0.1)');
      halo.addColorStop(1, 'rgba(96, 165, 250, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, width, height);

      const reducedMotion = reducedMotionMedia.matches;
      const particles = particlesRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (!reducedMotion) {
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < -0.03) p.x = 1.03;
          if (p.x > 1.03) p.x = -0.03;
          if (p.y < -0.03) p.y = 1.03;
          if (p.y > 1.03) p.y = -0.03;
        }

        const pulse = Math.sin(timestamp * 0.0009 + p.phase) * 0.15 + 0.85;
        const alpha = p.alpha * pulse;

        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${pointColor}${alpha.toFixed(3)})`;
        ctx.fill();
      }

      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        const x1 = p1.x * width;
        const y1 = p1.y * height;

        const edgeLimit = Math.min(i + 7, particles.length);
        for (let j = i + 1; j < edgeLimit; j++) {
          const p2 = particles[j];
          const x2 = p2.x * width;
          const y2 = p2.y * height;
          const dx = x1 - x2;
          const dy = y1 - y2;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const threshold = Math.min(width, height) * 0.2;

          if (dist > threshold) continue;

          const alpha = ((1 - dist / threshold) * (dark ? 0.1 : 0.08)).toFixed(3);
          ctx.strokeStyle = `${lineColor}${alpha})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }
    };

    const stop = () => {
      running = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = 0;
      }
      frameClockRef.current = 0;
    };

    const loop = (timestamp) => {
      if (disposed || !running) return;

      if (!frameClockRef.current) {
        frameClockRef.current = timestamp;
      }
      const delta = timestamp - frameClockRef.current;

      if (delta >= targetFrameMs) {
        draw(timestamp);
        frameClockRef.current = timestamp - (delta % targetFrameMs);
      }

      animationRef.current = requestAnimationFrame(loop);
    };

    const renderStatic = () => {
      draw(performance.now());
    };

    const start = () => {
      if (
        running ||
        reducedMotionMedia.matches ||
        !isActive ||
        document.hidden
      ) {
        return;
      }
      running = true;
      animationRef.current = requestAnimationFrame(loop);
    };

    const syncAnimationState = () => {
      if (reducedMotionMedia.matches || !isActive || document.hidden) {
        stop();
        renderStatic();
      } else {
        start();
      }
    };

    const onResize = () => {
      resize();
      syncAnimationState();
    };

    const onVisibilityChange = () => {
      syncAnimationState();
    };

    resize();
    renderStatic();
    syncAnimationState();

    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibilityChange);

    const onReducedMotionChanged = () => {
      setupParticles(reducedMotionMedia.matches);
      syncAnimationState();
    };
    reducedMotionMedia.addEventListener('change', onReducedMotionChanged);

    return () => {
      disposed = true;
      stop();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      reducedMotionMedia.removeEventListener('change', onReducedMotionChanged);
    };
  }, [isActive]);

  return (
    <canvas
      ref={canvasRef}
      className='ambient-particles-canvas'
      aria-hidden='true'
      role='presentation'
    />
  );
};

export default AmbientParticles;