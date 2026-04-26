import { useEffect, useRef } from 'react';
import { METERS_PER_PIXEL } from '../simulation/constants';
import type { SimulationState, Vector2 } from '../simulation/types';

type Props = { state: SimulationState };

const toCanvas = (origin: Vector2, point: Vector2): Vector2 => ({
  x: origin.x + point.x / METERS_PER_PIXEL,
  y: origin.y + point.y / METERS_PER_PIXEL,
});

const drawPath = (ctx: CanvasRenderingContext2D, origin: Vector2, path: Vector2[], color: string, width = 1.2) => {
  if (path.length < 2) return;
  ctx.beginPath();
  const first = toCanvas(origin, path[0]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < path.length; i += 1) {
    const p = toCanvas(origin, path[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
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
    const origin = { x: width * 0.18, y: height * 0.5 };

    ctx.fillStyle = '#050913';
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 180; i += 1) {
      const x = (i * 53) % width;
      const y = (i * 97) % height;
      ctx.fillStyle = `rgba(255,255,255,${0.1 + (i % 6) * 0.1})`;
      ctx.fillRect(x, y, 1, 1);
    }

    if (state.showGravityFields) {
      const earth = toCanvas(origin, state.earth.position);
      const moon = toCanvas(origin, state.moon.position);
      ctx.beginPath();
      ctx.arc(earth.x, earth.y, 130, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(68, 126, 238, 0.15)';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(moon.x, moon.y, 80, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(185, 194, 208, 0.16)';
      ctx.stroke();
    }

    drawPath(ctx, origin, state.plannedPath, '#56dfff77', 1.4);
    drawPath(ctx, origin, state.actualPath, '#ffca6b', 1.8);

    const earth = toCanvas(origin, state.earth.position);
    const moon = toCanvas(origin, state.moon.position);
    const capsule = toCanvas(origin, state.capsule.position);

    ctx.beginPath();
    ctx.arc(earth.x, earth.y, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#3478ff';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(moon.x, moon.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#aeb6c3';
    ctx.fill();

    const heading = Math.atan2(state.capsule.velocity.y, state.capsule.velocity.x);
    ctx.save();
    ctx.translate(capsule.x, capsule.y);
    ctx.rotate(heading);
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-5, -4);
    ctx.lineTo(-5, 4);
    ctx.closePath();
    ctx.fillStyle = '#fff6ea';
    ctx.fill();
    ctx.restore();

    if (state.showVectors) {
      ctx.beginPath();
      ctx.moveTo(capsule.x, capsule.y);
      ctx.lineTo(capsule.x + state.capsule.velocity.x * 0.05, capsule.y + state.capsule.velocity.y * 0.05);
      ctx.strokeStyle = '#5cffd2';
      ctx.lineWidth = 1.3;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(capsule.x, capsule.y);
      ctx.lineTo(capsule.x + state.capsule.acceleration.x * 2800, capsule.y + state.capsule.acceleration.y * 2800);
      ctx.strokeStyle = '#ff7a9b';
      ctx.stroke();
    }

    ctx.fillStyle = '#d4dced';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('Planned trajectory', width - 180, 24);
    ctx.fillStyle = '#56dfff';
    ctx.fillRect(width - 205, 16, 16, 2);

    ctx.fillStyle = '#d4dced';
    ctx.fillText('Actual trajectory', width - 180, 44);
    ctx.fillStyle = '#ffca6b';
    ctx.fillRect(width - 205, 36, 16, 2);
  }, [state]);

  return <canvas ref={canvasRef} className="sim-canvas" aria-label="Apollo 13 mission simulation canvas" />;
}
