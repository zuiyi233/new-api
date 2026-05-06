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
import { animate, engine } from 'animejs';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const EARTH_REGIONS = [
  { lat: 51, lon: -100, latRadius: 28, lonRadius: 50, density: 0.78 },
  { lat: -16, lon: -60, latRadius: 28, lonRadius: 24, density: 0.72 },
  { lat: 51, lon: 16, latRadius: 18, lonRadius: 22, density: 0.84 },
  { lat: 8, lon: 20, latRadius: 42, lonRadius: 32, density: 0.66 },
  { lat: 45, lon: 88, latRadius: 35, lonRadius: 60, density: 0.76 },
  { lat: -3, lon: 123, latRadius: 18, lonRadius: 30, density: 0.58 },
  { lat: -26, lon: 135, latRadius: 16, lonRadius: 22, density: 0.52 },
];

const DARK_PALETTE = {
  haloInner: 'rgba(108, 156, 255, 0.16)',
  haloOuter: 'rgba(108, 156, 255, 0.02)',
  grid: 'rgba(148, 163, 184, 0.14)',
  ring: 'rgba(125, 164, 228, 0.24)',
  ringSoft: 'rgba(125, 164, 228, 0.11)',
  orbit: 'rgba(122, 173, 255, 0.72)',
  edge: 'rgba(106, 157, 242, 0.2)',
  pointLand: 'rgba(198, 221, 255, 0.9)',
  pointOcean: 'rgba(136, 168, 213, 0.5)',
  pointGlow: 'rgba(123, 188, 255, 0.62)',
};

const LIGHT_PALETTE = {
  haloInner: 'rgba(37, 99, 235, 0.14)',
  haloOuter: 'rgba(37, 99, 235, 0.02)',
  grid: 'rgba(71, 85, 105, 0.16)',
  ring: 'rgba(71, 85, 105, 0.26)',
  ringSoft: 'rgba(71, 85, 105, 0.13)',
  orbit: 'rgba(37, 99, 235, 0.66)',
  edge: 'rgba(37, 99, 235, 0.18)',
  pointLand: 'rgba(30, 64, 175, 0.86)',
  pointOcean: 'rgba(51, 65, 85, 0.48)',
  pointGlow: 'rgba(59, 130, 246, 0.48)',
};

function fract(v) {
  return v - Math.floor(v);
}

function stableNoise(seed) {
  return fract(Math.sin(seed * 12.9898) * 43758.5453);
}

function wrapLongitudeDelta(a, b) {
  const diff = Math.abs(a - b);
  return diff > 180 ? 360 - diff : diff;
}

function getLandProbability(lat, lon) {
  for (const region of EARTH_REGIONS) {
    const latDelta = (lat - region.lat) / region.latRadius;
    const lonDelta = wrapLongitudeDelta(lon, region.lon) / region.lonRadius;
    const distance = latDelta * latDelta + lonDelta * lonDelta;
    if (distance <= 1) {
      return region.density * (1 - distance * 0.45);
    }
  }
  return 0;
}

function createPointCloud(count) {
  const points = new Array(count);

  for (let i = 0; i < count; i++) {
    const y = 1 - ((i + 0.5) / count) * 2;
    const ringRadius = Math.sqrt(1 - y * y);
    const theta = GOLDEN_ANGLE * i;
    const x = Math.cos(theta) * ringRadius;
    const z = Math.sin(theta) * ringRadius;

    const lat = Math.asin(y) / DEG;
    const lon = Math.atan2(z, x) / DEG;
    const probability = getLandProbability(lat, lon);
    const noise = stableNoise(i + 1);
    const isLand = probability > 0.01 && noise < probability;
    const emphasis = isLand && noise > probability * 0.4;

    points[i] = {
      x,
      y,
      z,
      isLand,
      emphasis,
      twinkle: noise * TAU,
      brightness: isLand ? 0.62 + noise * 0.34 : 0.28 + noise * 0.24,
      size: isLand ? 0.72 + noise * 0.62 : 0.44 + noise * 0.3,
    };
  }

  return points;
}

function createConnections(points, maxDistance, maxPerPoint) {
  const edges = [];
  const sourceLimit = Math.min(points.length, 180);

  for (let i = 0; i < sourceLimit; i++) {
    const from = points[i];
    if (!from.isLand) continue;

    const candidates = [];
    for (let j = i + 1; j < sourceLimit; j++) {
      const to = points[j];
      if (!to.isLand) continue;

      const dx = from.x - to.x;
      const dy = from.y - to.y;
      const dz = from.z - to.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist <= maxDistance) {
        candidates.push({
          from: i,
          to: j,
          strength: 1 - dist / maxDistance,
        });
      }
    }

    candidates.sort((a, b) => b.strength - a.strength);
    edges.push(...candidates.slice(0, maxPerPoint));
  }

  return edges;
}

function createGridLines() {
  const lines = [];

  for (let lat = -60; lat <= 60; lat += 30) {
    const normalized = [];
    const latRad = lat * DEG;
    const y = Math.sin(latRad);
    const radius = Math.cos(latRad);

    for (let lon = 0; lon <= 360; lon += 8) {
      const lonRad = lon * DEG;
      normalized.push({
        x: Math.cos(lonRad) * radius,
        y,
        z: Math.sin(lonRad) * radius,
      });
    }

    lines.push(normalized);
  }

  for (let lon = 0; lon < 360; lon += 30) {
    const normalized = [];
    const lonRad = lon * DEG;
    const cosLon = Math.cos(lonRad);
    const sinLon = Math.sin(lonRad);

    for (let lat = -80; lat <= 80; lat += 6) {
      const latRad = lat * DEG;
      const y = Math.sin(latRad);
      const radius = Math.cos(latRad);
      normalized.push({
        x: cosLon * radius,
        y,
        z: sinLon * radius,
      });
    }

    lines.push(normalized);
  }

  return lines;
}

function createOrbiters(seedShift, count, radiusScale, tilt) {
  const orbiters = new Array(count);
  for (let i = 0; i < count; i++) {
    const seed = seedShift + i * 17.23;
    const noise = stableNoise(seed);
    orbiters[i] = {
      angle: noise * TAU,
      speed: 0.00036 + stableNoise(seed + 31.7) * 0.00028,
      radius: radiusScale + (stableNoise(seed + 73.1) - 0.5) * 0.06,
      size: 0.75 + stableNoise(seed + 19.4) * 0.95,
      alpha: 0.36 + stableNoise(seed + 4.2) * 0.4,
      tilt,
    };
  }
  return orbiters;
}

function choosePointCount(width, reducedMotion) {
  if (reducedMotion) {
    if (width < 640) return 150;
    if (width < 1024) return 190;
    return 240;
  }

  if (width < 640) return 220;
  if (width < 1024) return 320;
  return 430;
}

function withAlpha(rgba, alpha) {
  return rgba.replace(/\d?\.\d+\)$/, `${alpha})`);
}

let manualAnimeEngineConsumerCount = 0;
let previousAnimeDefaultMainLoop = true;

function acquireManualAnimeEngineLoop() {
  if (manualAnimeEngineConsumerCount === 0) {
    previousAnimeDefaultMainLoop = engine.useDefaultMainLoop;
    engine.useDefaultMainLoop = false;
  }
  manualAnimeEngineConsumerCount += 1;
}

function releaseManualAnimeEngineLoop() {
  manualAnimeEngineConsumerCount = Math.max(0, manualAnimeEngineConsumerCount - 1);
  if (manualAnimeEngineConsumerCount === 0) {
    engine.useDefaultMainLoop = previousAnimeDefaultMainLoop;
  }
}

const Globe = ({ isActive = true }) => {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(0);
  const rotationRef = useRef(0);
  const orbitClockRef = useRef(0);
  const lastFrameTsRef = useRef(0);
  const animeAnimationsRef = useRef([]);
  const motionStateRef = useRef({
    glowScale: 1,
    tiltOffset: 0,
    spinBoost: 1,
    orbitAlphaScale: 1,
    haloPulse: 1,
  });
  const sceneRef = useRef({ count: 0, points: [], edges: [], orbiters: [] });
  const reducedMotionRef = useRef(false);
  const gridLines = useMemo(() => createGridLines(), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    acquireManualAnimeEngineLoop();

    let width = 0;
    let height = 0;
    let disposed = false;
    let running = false;
    let targetFrameMs = 1000 / 36;

    const reducedMotionMedia = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    );

    const stopAnimeMotion = () => {
      for (const animation of animeAnimationsRef.current) {
        animation.pause?.();
        animation.cancel?.();
      }
      animeAnimationsRef.current = [];
    };

    const startAnimeMotion = () => {
      const motion = motionStateRef.current;
      motion.glowScale = 1;
      motion.tiltOffset = 0;
      motion.spinBoost = 1;
      motion.orbitAlphaScale = 1;
      motion.haloPulse = 1;

      stopAnimeMotion();

      animeAnimationsRef.current = [
        animate(motion, {
          glowScale: [0.92, 1.18],
          duration: 3200,
          ease: 'inOutSine',
          alternate: true,
          loop: true,
        }),
        animate(motion, {
          tiltOffset: [-0.05, 0.06],
          duration: 4600,
          ease: 'inOutQuad',
          alternate: true,
          loop: true,
        }),
        animate(motion, {
          spinBoost: [0.84, 1.34],
          duration: 5200,
          ease: 'inOutSine',
          alternate: true,
          loop: true,
        }),
        animate(motion, {
          orbitAlphaScale: [0.72, 1.18],
          duration: 3600,
          ease: 'inOutSine',
          alternate: true,
          loop: true,
        }),
        animate(motion, {
          haloPulse: [0.88, 1.14],
          duration: 2800,
          ease: 'inOutSine',
          alternate: true,
          loop: true,
        }),
      ];
    };

    const setReducedMotion = () => {
      reducedMotionRef.current = reducedMotionMedia.matches;
      targetFrameMs = reducedMotionRef.current
        ? 1000
        : width <= 768
          ? 1000 / 30
          : 1000 / 36;
    };

    const rebuildSceneIfNeeded = () => {
      const nextCount = choosePointCount(width, reducedMotionRef.current);
      if (sceneRef.current.count === nextCount) return;

      const points = createPointCloud(nextCount);
      sceneRef.current = {
        count: nextCount,
        points,
        edges: createConnections(
          points,
          reducedMotionRef.current ? 0.18 : 0.2,
          reducedMotionRef.current ? 2 : 3,
        ),
        orbiters: [
          createOrbiters(11.2, reducedMotionRef.current ? 10 : 15, 1.18, 0.45),
          createOrbiters(41.7, reducedMotionRef.current ? 8 : 13, 1.42, -0.42),
          createOrbiters(77.4, reducedMotionRef.current ? 6 : 10, 1.62, 0.74),
        ],
      };
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      if (!width || !height) return;

      const dpr = Math.min(window.devicePixelRatio || 1, width < 768 ? 1.6 : 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      setReducedMotion();
      rebuildSceneIfNeeded();
    };

    const project = (point, radius, perspective, cosY, sinY, cosX, sinX) => {
      const rx = point.x * cosY - point.z * sinY;
      const rz = point.x * sinY + point.z * cosY;
      const ry = point.y * cosX - rz * sinX;
      const finalZ = point.y * sinX + rz * cosX;

      if (finalZ <= -0.32) return null;

      const depth = perspective / (perspective - finalZ * radius);
      return {
        x: rx * radius * depth,
        y: ry * radius * depth,
        z: finalZ,
        depth,
      };
    };

    const render = (timestamp, deltaMs = 16) => {
      if (!width || !height) return;
      const { points, edges, orbiters } = sceneRef.current;
      if (!points.length) return;

      const isDark = document.documentElement.classList.contains('dark');
      const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;
      const motion = motionStateRef.current;
      const glowScale = reducedMotionRef.current ? 1 : motion.glowScale;
      const tiltOffset = reducedMotionRef.current ? 0 : motion.tiltOffset;
      const orbitAlphaScale = reducedMotionRef.current ? 1 : motion.orbitAlphaScale;
      const spinBoost = reducedMotionRef.current ? 1 : motion.spinBoost;
      const haloPulse = reducedMotionRef.current ? 1 : motion.haloPulse;

      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.41 * (1 + (glowScale - 1) * 0.06);
      const perspective = radius * 2.85;
      const tilt =
        (reducedMotionRef.current ? 0.34 : 0.27 + tiltOffset) +
        Math.sin(timestamp * 0.0002) * (reducedMotionRef.current ? 0 : 0.03 * haloPulse);

      ctx.clearRect(0, 0, width, height);

      const aura = ctx.createRadialGradient(cx, cy, radius * 0.55, cx, cy, radius * 1.8);
      aura.addColorStop(0, palette.haloInner);
      aura.addColorStop(1, palette.haloOuter);
      ctx.save();
      ctx.globalAlpha = Math.min(1, 0.72 + haloPulse * 0.28);
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.8, 0, TAU);
      ctx.fill();
      ctx.restore();

      const cosY = Math.cos(rotationRef.current);
      const sinY = Math.sin(rotationRef.current);
      const cosX = Math.cos(tilt);
      const sinX = Math.sin(tilt);

      ctx.strokeStyle = palette.ring;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, TAU);
      ctx.stroke();

      ctx.strokeStyle = palette.ringSoft;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.95, 0, TAU);
      ctx.stroke();

      ctx.strokeStyle = palette.grid;
      ctx.lineWidth = 0.7;
      for (const line of gridLines) {
        let started = false;
        ctx.beginPath();
        for (const point of line) {
          const projected = project(
            point,
            radius,
            perspective,
            cosY,
            sinY,
            cosX,
            sinX,
          );
          if (!projected || projected.z <= -0.1) {
            started = false;
            continue;
          }
          const sx = cx + projected.x;
          const sy = cy + projected.y;
          if (!started) {
            ctx.moveTo(sx, sy);
            started = true;
          } else {
            ctx.lineTo(sx, sy);
          }
        }
        ctx.stroke();
      }

      const projectedPoints = new Array(points.length);
      const visibleIndices = [];
      for (let i = 0; i < points.length; i++) {
        const projected = project(
          points[i],
          radius,
          perspective,
          cosY,
          sinY,
          cosX,
          sinX,
        );
        if (!projected) continue;
        projectedPoints[i] = projected;
        visibleIndices.push(i);
      }

      visibleIndices.sort(
        (a, b) => projectedPoints[a].z - projectedPoints[b].z,
      );

      for (const edge of edges) {
        const a = projectedPoints[edge.from];
        const b = projectedPoints[edge.to];
        if (!a || !b || a.z <= -0.05 || b.z <= -0.05) continue;

        const alpha = edge.strength * (0.04 + ((a.z + b.z) * 0.5 + 1) * 0.08);
        if (alpha <= 0.02) continue;

        ctx.strokeStyle = withAlpha(palette.edge, alpha.toFixed(3));
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(cx + a.x, cy + a.y);
        ctx.lineTo(cx + b.x, cy + b.y);
        ctx.stroke();
      }

      const timeFactor = timestamp * 0.001;
      for (let i = 0; i < visibleIndices.length; i++) {
        const index = visibleIndices[i];
        const point = points[index];
        const projected = projectedPoints[index];
        if (!projected) continue;

        const zFactor = Math.max(0.02, (projected.z + 1) / 2);
        const twinkle = Math.sin(timeFactor * 1.3 + point.twinkle) * 0.12 + 0.88;
        const alpha = Math.min(0.96, point.brightness * zFactor * twinkle);
        const size = Math.max(0.55, point.size * (0.68 + projected.depth * 0.4));
        const x = cx + projected.x;
        const y = cy + projected.y;

        if (point.emphasis && projected.z > 0.08) {
          ctx.save();
          ctx.shadowBlur = 12 * projected.depth;
          ctx.shadowColor = palette.pointGlow;
          ctx.fillStyle = withAlpha(palette.pointGlow, (alpha * 0.6).toFixed(3));
          ctx.beginPath();
          ctx.arc(x, y, size * 0.92, 0, TAU);
          ctx.fill();
          ctx.restore();
        }

        ctx.fillStyle = point.isLand
          ? withAlpha(palette.pointLand, alpha.toFixed(3))
          : withAlpha(palette.pointOcean, (alpha * 0.9).toFixed(3));
        ctx.beginPath();
        ctx.arc(x, y, size, 0, TAU);
        ctx.fill();
      }

      const orbitBase = orbitClockRef.current;
      for (const ring of orbiters) {
        for (const orbiter of ring) {
          const orbitAngle = orbitBase * orbiter.speed + orbiter.angle;

          const normalized = {
            x: Math.cos(orbitAngle) * orbiter.radius,
            y: Math.sin(orbitAngle) * orbiter.radius * Math.sin(orbiter.tilt),
            z: Math.sin(orbitAngle) * orbiter.radius * Math.cos(orbiter.tilt),
          };

          const projected = project(
            normalized,
            radius,
            perspective,
            cosY,
            sinY,
            cosX,
            sinX,
          );
          if (!projected || projected.z <= -0.14) continue;

          const alpha = Math.min(
            0.88,
            orbiter.alpha * orbitAlphaScale * (0.35 + projected.depth * 0.35),
          );
          ctx.fillStyle = withAlpha(palette.orbit, alpha.toFixed(3));
          ctx.beginPath();
          ctx.arc(
            cx + projected.x,
            cy + projected.y,
            orbiter.size * (0.48 + projected.depth * 0.42),
            0,
            TAU,
          );
          ctx.fill();
        }
      }

      if (!reducedMotionRef.current) {
        rotationRef.current += deltaMs * 0.00024 * spinBoost;
      }
      orbitClockRef.current += deltaMs;
    };

    const stop = () => {
      running = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = 0;
      }
      lastFrameTsRef.current = 0;
    };

    const loop = (timestamp) => {
      if (disposed || !running) return;

      if (!lastFrameTsRef.current) {
        lastFrameTsRef.current = timestamp;
      }
      const delta = timestamp - lastFrameTsRef.current;

      if (delta >= targetFrameMs) {
        engine.update();
        render(timestamp, delta);
        lastFrameTsRef.current = timestamp - (delta % targetFrameMs);
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    const start = () => {
      if (running || reducedMotionRef.current || !isActive || document.hidden) return;
      running = true;
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    const renderStatic = () => {
      render(performance.now(), 16);
    };

    const applyAnimationState = () => {
      if (reducedMotionRef.current || !isActive || document.hidden) {
        stop();
        renderStatic();
      } else {
        start();
      }
    };

    const onResize = () => {
      resize();
      renderStatic();
      applyAnimationState();
    };

    const onVisibilityChange = () => {
      applyAnimationState();
    };

    startAnimeMotion();
    resize();
    setReducedMotion();
    rebuildSceneIfNeeded();
    renderStatic();
    applyAnimationState();

    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibilityChange);
    const onReducedMotionChanged = () => {
      setReducedMotion();
      renderStatic();
      applyAnimationState();
    };
    reducedMotionMedia.addEventListener('change', onReducedMotionChanged);

    return () => {
      disposed = true;
      stop();
      stopAnimeMotion();
      releaseManualAnimeEngineLoop();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      reducedMotionMedia.removeEventListener('change', onReducedMotionChanged);
    };
  }, [isActive, gridLines]);

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
