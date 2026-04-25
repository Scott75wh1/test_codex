import { useEffect, useRef } from 'react';
import { METERS_PER_PIXEL } from '../simulation/constants';
import type { SimulationState, Vector2 } from '../simulation/types';

type Props = {
  state: SimulationState;
};

const toCanvas = (origin: Vector2, point: Vector2): Vector2 => ({
  x: origin.x + point.x / METERS_PER_PIXEL,
  y: origin.y + point.y / METERS_PER_PIXEL,
});

const drawPath = (ctx: CanvasRenderingContext2D, origin: Vector2, path: Vector2[], color: string) => {
  if (path.length < 2) return;

  ctx.beginPath();
  const first = toCanvas(origin, path[0]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < path.length; i += 1) {
    const p = toCanvas(origin, path[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.stroke();
};

export function SimulationCanvas({ state }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const width = rect.width;
    const height = rect.height;
    const origin = { x: width / 2 - 70, y: height / 2 };

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, width, height);

    // Star field background
    for (let i = 0; i < 120; i += 1) {
      const x = (i * 97) % width;
      const y = (i * 61) % height;
      ctx.fillStyle = `rgba(255,255,255,${0.15 + (i % 7) * 0.07})`;
      ctx.fillRect(x, y, 1.4, 1.4);
    }

    if (state.showGravityFields) {
      const earth = toCanvas(origin, state.earth.position);
      const moon = toCanvas(origin, state.moon.position);
      ctx.beginPath();
      ctx.arc(earth.x, earth.y, 90, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(74, 136, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(moon.x, moon.y, 55, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(196, 204, 216, 0.12)';
      ctx.stroke();
    }

    drawPath(ctx, origin, state.plannedPath, '#57d6ff80');
    drawPath(ctx, origin, state.actualPath, '#ffd27f');

    const earthCanvas = toCanvas(origin, state.earth.position);
    const moonCanvas = toCanvas(origin, state.moon.position);
    const capsuleCanvas = toCanvas(origin, state.capsule.position);

    // Earth
    ctx.beginPath();
    ctx.arc(earthCanvas.x, earthCanvas.y, 13, 0, Math.PI * 2);
    ctx.fillStyle = '#2a72ff';
    ctx.fill();

    // Moon
    ctx.beginPath();
    ctx.arc(moonCanvas.x, moonCanvas.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#a6adb8';
    ctx.fill();

    // Capsule marker as triangle
    const angle = Math.atan2(state.capsule.velocity.y, state.capsule.velocity.x);
    ctx.save();
    ctx.translate(capsuleCanvas.x, capsuleCanvas.y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, 4);
    ctx.lineTo(-5, -4);
    ctx.closePath();
    ctx.fillStyle = '#f5f7fa';
    ctx.fill();
    ctx.restore();

    // Mission points
    const points = [
      { label: 'Launch', p: { x: 0, y: state.earth.radius + 90_000 } },
      { label: 'TLI', p: { x: state.earth.radius + 280_000, y: 0 } },
      { label: 'Flyby', p: { x: state.moon.position.x - 42_000_000, y: 0 } },
      { label: 'Return', p: { x: 0, y: -state.earth.radius - 220_000 } },
    ];

    ctx.font = '11px Inter, sans-serif';
    points.forEach((pt) => {
      const p = toCanvas(origin, pt.p);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffe29e';
      ctx.fill();
      ctx.fillStyle = '#d6dde8';
      ctx.fillText(pt.label, p.x + 6, p.y - 6);
    });

    if (state.showVectors) {
      const vectorScale = 0.07;
      const accelScale = 2_700;

      // Velocity vector
      ctx.beginPath();
      ctx.moveTo(capsuleCanvas.x, capsuleCanvas.y);
      ctx.lineTo(
        capsuleCanvas.x + state.capsule.velocity.x * vectorScale,
        capsuleCanvas.y + state.capsule.velocity.y * vectorScale,
      );
      ctx.strokeStyle = '#53f7c9';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Acceleration vector
      ctx.beginPath();
      ctx.moveTo(capsuleCanvas.x, capsuleCanvas.y);
      ctx.lineTo(
        capsuleCanvas.x + state.capsule.acceleration.x * accelScale,
        capsuleCanvas.y + state.capsule.acceleration.y * accelScale,
      );
      ctx.strokeStyle = '#ff7188';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }, [state]);

  return <canvas ref={canvasRef} className="sim-canvas" aria-label="Apollo 13 mission simulation canvas" />;
}
