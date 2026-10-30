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
      // Keep the graph flat and still; only the inner pentagram rotates in place.
      const scale = Math.min(width * 0.46, height * 0.42, 440);
      const points = layouts[index].map((p, i) => {
        const q = layouts[(index + 1) % layouts.length][i];
        let [x, y] = p.slice(0, 2).map((v, j) => v + (q[j] - v) * blend) as [number, number];
        const z = p[2] + (q[2] - p[2]) * blend;
        const local = i >= 5 ? t * 0.62 : 0;
        const twistedX = x * Math.cos(local) - y * Math.sin(local);
        const twistedY = x * Math.sin(local) + y * Math.cos(local);
        x = twistedX; y = twistedY;
        return [width / 2 + x * scale, height / 2 + y * scale, z];
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
      const dark = document.documentElement.classList.contains('dark');
      ctx.fillStyle = dark ? '#c5edff' : '#173b52';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      for (const cell of cells.values()) ctx.fillText(cell.char, cell.x, cell.y);
      // Make the ten vertices unmistakable: a bright ring, a bold marker, and the site icon.
      for (const p of points) {
        ctx.beginPath();
        ctx.arc(p[0], p[1] - 4, 13, 0, Math.PI * 2);
        ctx.fillStyle = dark ? 'rgba(197,237,255,.42)' : 'rgba(23,59,82,.24)';
        ctx.fill();
        ctx.strokeStyle = dark ? '#e4f8ff' : '#173b52';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = dark ? '#e4f8ff' : '#173b52';
        ctx.font = 'bold 15px monospace';
        ctx.fillText('@', p[0], p[1] + 1);
      }
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
  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-[0.52] dark:opacity-[0.46]" data-testid="ascii-petersen-background" />;
}
