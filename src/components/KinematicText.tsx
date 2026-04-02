'use client';

import { useEffect, useRef } from 'react';

const REPEL_RADIUS = 130;
const REPEL_STRENGTH = 10000;
const SPRING_K = 0.10;
const DAMPING = 0.76;

interface WordState {
  el: HTMLSpanElement;
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  dx: number;
  dy: number;
}

interface Props {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function KinematicText({ text, className, style }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const spans = Array.from(container.querySelectorAll<HTMLSpanElement>('[data-kword]'));
    const states: WordState[] = [];

    const initPositions = () => {
      spans.forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        const ox = rect.left + rect.width / 2 + window.scrollX;
        const oy = rect.top + rect.height / 2 + window.scrollY;
        if (states[i]) {
          states[i].ox = ox;
          states[i].oy = oy;
        } else {
          states.push({ el, ox, oy, vx: 0, vy: 0, dx: 0, dy: 0 });
        }
      });
    };

    initPositions();

    const mouse = { x: -9999, y: -9999 };
    const onMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX + window.scrollX;
      mouse.y = e.clientY + window.scrollY;
    };

    let raf: number;
    const animate = () => {
      for (const s of states) {
        const cx = s.ox + s.dx;
        const cy = s.oy + s.dy;
        const distX = cx - mouse.x;
        const distY = cy - mouse.y;
        const dist = Math.sqrt(distX * distX + distY * distY) || 1;

        let fx = 0;
        let fy = 0;

        if (dist < REPEL_RADIUS) {
          const t = (REPEL_RADIUS - dist) / REPEL_RADIUS;
          const strength = t * t * REPEL_STRENGTH * 0.001;
          fx += (distX / dist) * strength;
          fy += (distY / dist) * strength;
        }

        fx -= s.dx * SPRING_K;
        fy -= s.dy * SPRING_K;

        s.vx = (s.vx + fx) * DAMPING;
        s.vy = (s.vy + fy) * DAMPING;
        s.dx += s.vx;
        s.dy += s.vy;

        s.el.style.transform = `translate(${s.dx.toFixed(2)}px, ${s.dy.toFixed(2)}px)`;
      }
      raf = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', initPositions);
    raf = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', initPositions);
      cancelAnimationFrame(raf);
    };
  }, []);

  const parts = text.split(/(\s+)/);

  return (
    <div ref={ref} className={className} style={style}>
      {parts.map((part, i) =>
        /\s+/.test(part) ? (
          <span key={i}>{part}</span>
        ) : (
          <span
            key={i}
            data-kword=""
            style={{ display: 'inline-block', willChange: 'transform' }}
          >
            {part}
          </span>
        )
      )}
    </div>
  );
}
