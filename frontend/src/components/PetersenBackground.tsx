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

export function PetersenBackground() {
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
      const index = 0;
      const blend = (1 - Math.cos(t / 24 * Math.PI * 2)) * 0.16;
      // Keep the graph flat and still; only the inner pentagram rotates in place.
      const scale = Math.min(width * 0.42, height * 0.38, 390);
      const points = layouts[index].map((p, i) => {
        const q = i < 5 ? p : layouts[(index + 1) % layouts.length][i];
        let [x, y] = p.slice(0, 2).map((v, j) => v + (q[j] - v) * blend) as [number, number];
        const z = p[2] + (q[2] - p[2]) * blend;
        const local = i >= 5 ? t * 0.16 : 0;
        const twistedX = x * Math.cos(local) - y * Math.sin(local);
        const twistedY = x * Math.sin(local) + y * Math.cos(local);
        x = twistedX; y = twistedY;
        return [width / 2 + x * scale, height / 2 + y * scale, z];
      });
      const dark = document.documentElement.classList.contains('dark');
      const gradient = ctx.createLinearGradient(width / 2 - scale, height / 2 - scale, width / 2 + scale, height / 2 + scale);
      gradient.addColorStop(0, dark ? '#93c5fd' : '#2563a6');
      gradient.addColorStop(0.5, dark ? '#67e8f9' : '#178c9c');
      gradient.addColorStop(1, dark ? '#a5b4fc' : '#6475b8');
      ctx.lineCap = 'round';
      ctx.strokeStyle = gradient;
      // Soft underlay, followed by a crisp stroke; no vertex decorations.
      for (const [lineWidth, alpha] of [[7, 0.06], [1.5, 0.8]]) {
        ctx.lineWidth = lineWidth;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        for (const [a, b] of edges) {
          ctx.moveTo(points[a][0], points[a][1]);
          ctx.lineTo(points[b][0], points[b][1]);
        }
        ctx.stroke();
      }
      // A few short traveling highlights emphasize connections, not vertices.
      edges.forEach(([a, b], i) => {
        if (i % 3 !== 1) return;
        const p = points[a], q = points[b];
        const f = (t * 0.045 + i * 0.173) % 1;
        const tail = Math.max(0, f - 0.08);
        ctx.globalAlpha = Math.sin(f * Math.PI) * 0.8;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(p[0] + (q[0] - p[0]) * tail, p[1] + (q[1] - p[1]) * tail);
        ctx.lineTo(p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;

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
  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-[0.42] dark:opacity-[0.40]" data-testid="petersen-background" />;
}
