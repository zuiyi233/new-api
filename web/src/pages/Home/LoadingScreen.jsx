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

import React, { useEffect, useRef, useState } from 'react';

const LOADING_DURATION = 1750;
const EXIT_DURATION = 500;

function createParticles(count) {
  const particles = new Array(count);
  for (let i = 0; i < count; i++) {
    particles[i] = {
      x: Math.random(),
      y: Math.random(),
      radius: 0.7 + Math.random() * 1.5,
      speedX: (Math.random() - 0.5) * 0.00022,
      speedY: (Math.random() - 0.5) * 0.00016,
      alpha: 0.16 + Math.random() * 0.3,
      phase: Math.random() * Math.PI * 2,
    };
  }
  return particles;
}

const LoadingScreen = ({ onComplete }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(0);
  const startRef = useRef(0);
  const progressRef = useRef(0);
  const particlesRef = useRef([]);

  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('loading');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let disposed = false;
    let width = 0;
    let height = 0;
    let exitTimer = 0;

    const reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reducedMotion = reducedMotionMedia.matches;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width || window.innerWidth || 0;
      height = rect.height || window.innerHeight || 0;
      if (!width || !height) return;

      const dpr = Math.min(window.devicePixelRatio || 1, width < 768 ? 1.4 : 1.8);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = reducedMotion
        ? 14
        : width < 640
          ? 24
          : 36;
      particlesRef.current = createParticles(count);
    };

    const draw = (time) => {
      if (!width || !height) return;

      ctx.clearRect(0, 0, width, height);

      const halo = ctx.createRadialGradient(
        width * 0.72,
        height * 0.2,
        0,
        width * 0.72,
        height * 0.2,
        Math.max(width, height) * 0.55,
      );
      halo.addColorStop(0, 'rgba(96, 165, 250, 0.16)');
      halo.addColorStop(1, 'rgba(96, 165, 250, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, width, height);

      const soft = ctx.createRadialGradient(
        width * 0.2,
        height * 0.08,
        0,
        width * 0.2,
        height * 0.08,
        Math.max(width, height) * 0.48,
      );
      soft.addColorStop(0, 'rgba(167, 139, 250, 0.12)');
      soft.addColorStop(1, 'rgba(167, 139, 250, 0)');
      ctx.fillStyle = soft;
      ctx.fillRect(0, 0, width, height);

      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];

        if (!reducedMotion) {
          particle.x += particle.speedX;
          particle.y += particle.speedY;
          if (particle.x < -0.03) particle.x = 1.03;
          if (particle.x > 1.03) particle.x = -0.03;
          if (particle.y < -0.03) particle.y = 1.03;
          if (particle.y > 1.03) particle.y = -0.03;
        }

        const pulse = Math.sin(time * 0.0012 + particle.phase) * 0.18 + 0.82;
        const alpha = particle.alpha * pulse;

        ctx.beginPath();
        ctx.arc(particle.x * width, particle.y * height, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(176, 199, 236, ${alpha.toFixed(3)})`;
        ctx.fill();
      }
    };

    const tick = (timestamp) => {
      if (disposed) return;

      draw(timestamp);

      const elapsed = timestamp - startRef.current;
      const percent = Math.min(1, elapsed / LOADING_DURATION);
      if (Math.abs(percent - progressRef.current) >= 0.01) {
        progressRef.current = percent;
        setProgress(percent);
      }

      if (!reducedMotion) {
        animationRef.current = requestAnimationFrame(tick);
      }
    };

    const finish = () => {
      setPhase('transition');
      exitTimer = window.setTimeout(() => {
        if (disposed) return;
        setPhase('done');
        onComplete?.();
      }, EXIT_DURATION);
    };

    resize();
    startRef.current = performance.now();

    if (reducedMotion) {
      draw(startRef.current);
    } else {
      animationRef.current = requestAnimationFrame(tick);
    }

    const completeTimer = window.setTimeout(() => {
      progressRef.current = 1;
      setProgress(1);
      finish();
    }, reducedMotion ? 850 : LOADING_DURATION + 80);

    window.addEventListener('resize', resize);

    return () => {
      disposed = true;
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(animationRef.current);
      window.clearTimeout(completeTimer);
      window.clearTimeout(exitTimer);
    };
  }, [onComplete]);

  if (phase === 'done') return null;

  return (
    <div className={`loading-screen ${phase === 'transition' ? 'loading-screen-exit' : ''}`}>
      <canvas ref={canvasRef} className='loading-canvas' aria-hidden='true' />

      <div className='loading-content'>
        <div className='loading-logo' aria-hidden='true'>
          <div className='loading-logo-ring' />
          <div className='loading-logo-core' />
        </div>

        <div className='loading-text'>
          <span className='loading-text-main'>New API</span>
          <span className='loading-text-sub'>连接全球 AI 生态</span>
        </div>

        <div className='loading-progress'>
          <div
            className='loading-progress-bar'
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;