import { useEffect, useRef } from 'react';

type Point = [number, number, number];
// Outer pentagon, five spokes, inner pentagram: every vertex has degree three.
const edges = Array.from({ length: 5 }, (_, i) => [
  [i, (i + 1) % 5], [i, i + 5], [i + 5, ((i + 2) % 5) + 5],
]).flat();
const layouts: Point[][] = [0, 1, 2].map((layout) =>
  Array.from({ length: 10 }, (_, i): Point => {
    const a = (i % 5) * Math.PI * 2 / 5 - Math.PI / 2;
    if (layout === 0) {
      const r = i < 5 ? 1 : 0.46;
      return [Math.cos(a) * r, Math.sin(a) * r, 0];
    }
    if (layout === 1) return [Math.cos(a) * 0.8, Math.sin(a) * 0.8, i < 5 ? -0.65 : 0.65];
    const angle = i * Math.PI * 2 / 10;
    return [Math.cos(angle), Math.sin(angle), Math.sin(angle * 3) * 0.45];
  }),
);

export function AsciiPetersenBackground() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let last = -Infinity;
    let elapsed = 0;
    let previous: number | undefined;
    let width = 0;
    let height = 0;
    const cellX = 9;
    const cellY = 13;
    const draw = (time: number) => {
      if (previous !== undefined) elapsed += Math.min(time - previous, 100);
      previous = time;
      if (time - last < 50 && !motion.matches) {
        frame = requestAnimationFrame(draw);
        return;
      }
      last = time;
      const t = motion.matches ? 0 : elapsed / 1000;
      ctx.clearRect(0, 0, width, height);
      const phase = t / 12;
      const index = Math.floor(phase) % layouts.length;
      const f = (phase % 1);
      const blend = f * f * (3 - 2 * f);
      const rotation = t * 0.09 + 0.2;
      const scale = Math.min(width * 0.43, height * 0.39, 410);
      const points = layouts[index].map((p, i) => {
        const q = layouts[(index + 1) % layouts.length][i];
        const [x, y, z] = p.map((v, j) => v + (q[j] - v) * blend) as Point;
        const rx = x * Math.cos(rotation) - z * Math.sin(rotation);
        const rz = x * Math.sin(rotation) + z * Math.cos(rotation);
        const ry = y * Math.cos(0.3) - rz * Math.sin(0.3);
        const perspective = 3.8 / (3.8 + rz);
        return [width / 2 + rx * scale * perspective, height / 2 + ry * scale * perspective, rz];
      });
      const cells = new Map<string, { x: number; y: number; char: string }>();
      const put = (x: number, y: number, char: string) => {
        const col = Math.round(x / cellX), row = Math.round(y / cellY);
        cells.set(`${col},${row}`, { x: col * cellX, y: row * cellY, char });
      };
      for (const [a, b] of edges) {
        const p = points[a], q = points[b];
        const steps = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 5);
        for (let k = 0; k <= steps; k++) {
          const f = k / Math.max(steps, 1);
          const depth = p[2] * (1 - f) + q[2] * f;
          put(p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, depth > 0.35 ? ':' : depth < -0.35 ? '+' : '*');
        }
      }
      for (const p of points) {
        for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) {
          put(p[0] + x * cellX, p[1] + y * cellY, x === 0 && y === 0 ? '@' : 'o');
        }
      }
      ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#9ab8ca' : '#405b70';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      for (const cell of cells.values()) ctx.fillText(cell.char, cell.x, cell.y);
      if (!motion.matches) frame = requestAnimationFrame(draw);
    };
    const start = () => {
      cancelAnimationFrame(frame);
      previous = undefined;
      if (!document.hidden) frame = requestAnimationFrame(draw);
    };
    const resize = () => {
      width = window.innerWidth; height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr; canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      start();
    };
    const observer = new MutationObserver(start);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', start);
    motion.addEventListener('change', start);
    resize();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', start);
      motion.removeEventListener('change', start);
    };
  }, []);
  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-[0.18] dark:opacity-[0.15]" data-testid="ascii-petersen-background" />;
}
