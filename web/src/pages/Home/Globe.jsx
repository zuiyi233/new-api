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

import React, { useEffect, useMemo, useRef } from 'react';

const TAU = Math.PI * 2;

function generateSpherePoints(count) {
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const u = Math.random() * 2 - 1;
    const theta = Math.random() * TAU;
    const base = Math.sqrt(1 - u * u);
    points.push({
      x: base * Math.cos(theta),
      y: u,
      z: base * Math.sin(theta),
      intensity: 0.2 + Math.random() * 0.8,
    });
  }
  return points;
}

function drawOrbit(ctx, cx, cy, radius, rotateX, rotateY, opacity = 0.16) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotateY);
  ctx.scale(1, Math.max(0.2, Math.cos(rotateX)));
  ctx.beginPath();
  ctx.ellipse(0, 0, radius, radius, 0, 0, TAU);
  ctx.strokeStyle = `rgba(148, 163, 184, ${opacity})`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

const Globe = ({ isActive = true }) => {
  const canvasRef = useRef(null);
  const frameRef = useRef(0);
  const points = useMemo(() => {
    const isSmallScreen =
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 768px)').matches;
    return generateSpherePoints(isSmallScreen ? 560 : 980);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    let width = 0;
    let height = 0;
    let dpr = 1;
    let rotation = 0;

    const reducedMotionQuery =
      typeof window !== 'undefined' && 'matchMedia' in window
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    let disposed = false;
    let animationRunning = false;

    const resize = () => {
      width = canvas.clientWidth || canvas.parentElement?.clientWidth || 0;
      height = canvas.clientHeight || canvas.parentElement?.clientHeight || 0;
      if (!width || !height) {
        return;
      }

      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const render = () => {
      if (!width || !height) {
        return;
      }

      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.31;
      const perspective = radius * 1.9;

      context.clearRect(0, 0, width, height);

      const gradient = context.createRadialGradient(
        cx,
        cy,
        radius * 0.2,
        cx,
        cy,
        radius * 1.5,
      );
      gradient.addColorStop(0, 'rgba(148, 163, 184, 0.06)');
      gradient.addColorStop(1, 'rgba(15, 23, 42, 0)');
      context.beginPath();
      context.arc(cx, cy, radius * 1.6, 0, TAU);
      context.fillStyle = gradient;
      context.fill();

      drawOrbit(
        context,
        cx,
        cy,
        radius * 1.26,
        Math.PI * 0.32,
        rotation * 0.2,
        0.2,
      );
      drawOrbit(
        context,
        cx,
        cy,
        radius * 1.42,
        Math.PI * 0.52,
        -rotation * 0.16,
        0.12,
      );

      context.beginPath();
      context.arc(cx, cy, radius, 0, TAU);
      context.strokeStyle = 'rgba(148, 163, 184, 0.22)';
      context.lineWidth = 1;
      context.stroke();

      for (let index = 0; index < points.length; index += 1) {
        const point = points[index];

        const cosY = Math.cos(rotation);
        const sinY = Math.sin(rotation);
        const x1 = point.x * cosY - point.z * sinY;
        const z1 = point.x * sinY + point.z * cosY;

        const cosX = Math.cos(Math.PI * 0.15);
        const sinX = Math.sin(Math.PI * 0.15);
        const y2 = point.y * cosX - z1 * sinX;
        const z2 = point.y * sinX + z1 * cosX;

        const depth = perspective / (perspective - z2 * radius);
        const x2 = cx + x1 * radius * depth;
        const y3 = cy + y2 * radius * depth;

        if (z2 < -0.3 || depth <= 0) {
          continue;
        }

        const alpha = Math.min(0.88, (0.22 + z2 * 0.35) * point.intensity);
        const size = Math.max(0.6, (0.7 + z2 * 0.9) * point.intensity);

        context.beginPath();
        context.arc(x2, y3, size, 0, TAU);
        context.fillStyle = `rgba(200, 215, 235, ${alpha})`;
        context.fill();
      }
    };

    const stopAnimation = () => {
      animationRunning = false;
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      }
    };

    const animate = () => {
      if (!animationRunning || disposed) {
        return;
      }
      if (
        !document.hidden &&
        isActive &&
        !(reducedMotionQuery && reducedMotionQuery.matches)
      ) {
        rotation += 0.0042;
      }
      render();
      if (!document.hidden && isActive) {
        frameRef.current = window.requestAnimationFrame(animate);
      } else {
        stopAnimation();
      }
    };

    const startAnimation = () => {
      if (animationRunning || !isActive || document.hidden) {
        return;
      }
      if (reducedMotionQuery && reducedMotionQuery.matches) {
        render();
        return;
      }
      animationRunning = true;
      frameRef.current = window.requestAnimationFrame(animate);
    };

    const syncAnimationState = () => {
      if (
        isActive &&
        !document.hidden &&
        !(reducedMotionQuery && reducedMotionQuery.matches)
      ) {
        startAnimation();
      } else {
        stopAnimation();
        render();
      }
    };

    const onVisibilityChange = () => {
      syncAnimationState();
    };

    const onReducedMotionChange = () => {
      syncAnimationState();
    };

    resize();
    syncAnimationState();

    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibilityChange);
    if (reducedMotionQuery) {
      if (typeof reducedMotionQuery.addEventListener === 'function') {
        reducedMotionQuery.addEventListener('change', onReducedMotionChange);
      } else if (typeof reducedMotionQuery.addListener === 'function') {
        reducedMotionQuery.addListener(onReducedMotionChange);
      }
    }

    return () => {
      disposed = true;
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (reducedMotionQuery) {
        if (typeof reducedMotionQuery.removeEventListener === 'function') {
          reducedMotionQuery.removeEventListener(
            'change',
            onReducedMotionChange,
          );
        } else if (typeof reducedMotionQuery.removeListener === 'function') {
          reducedMotionQuery.removeListener(onReducedMotionChange);
        }
      }
      stopAnimation();
    };
  }, [isActive, points]);

  return (
    <canvas
      ref={canvasRef}
      className='home-globe-canvas'
      aria-hidden='true'
      role='presentation'
    />
  );
};

export default Globe;
