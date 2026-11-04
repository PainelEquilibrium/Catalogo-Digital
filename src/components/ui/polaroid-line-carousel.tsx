"use client";

import * as React from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import { copyPtBr } from "@/lib/copy/pt-br";
import styles from "./polaroid-line-carousel.module.css";

export type Slide = {
  image: string;
  alt: string;
  title?: string;
  width?: number;
  height?: number;
};

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function nearestAt(offset: number, spacing: number, count: number) {
  return clamp(Math.round(offset / spacing), 0, Math.max(0, count - 1));
}

export function stringY(x: number, width: number, y: number, sag: number) {
  const t = clamp(x / Math.max(1, width), 0, 1);
  return y + 4 * sag * t * (1 - t);
}

export function springStep(x: number, velocity: number, target: number, dt: number): [number, number] {
  const nextVelocity = velocity + (70 * (target - x) - 2 * Math.sqrt(70) * velocity) * dt;
  return [x + nextVelocity * dt, nextVelocity];
}

export function swingStep(angle: number, velocity: number, lineVelocity: number, dt: number, gain: number): [number, number] {
  const nextVelocity = velocity + (-38 * angle - 4.2 * velocity + lineVelocity * 0.0034 * gain) * dt;
  return [clamp(angle + nextVelocity * dt, -0.6, 0.6), nextVelocity];
}

type Props = {
  slides: Slide[];
  onChange?: (index: number) => void;
  ariaLabel: string;
  children?: React.ReactNode;
  suspended?: boolean;
};

const AUTOPLAY = 4500;

export default function PolaroidLineCarousel({ slides, onChange, ariaLabel, children, suspended = false }: Props) {
  const count = slides.length;
  const [selected, setSelected] = React.useState(0);
  const active = clamp(selected, 0, Math.max(0, count - 1));
  const [paused, setPaused] = React.useState(false);
  const [reduced, setReduced] = React.useState(false);
  const [announcement, setAnnouncement] = React.useState("");
  const rootRef = React.useRef<HTMLDivElement>(null);
  const pathRef = React.useRef<SVGPathElement>(null);
  const repaint = React.useRef<(() => void) | null>(null);
  const cards = React.useRef<(HTMLDivElement | null)[]>([]);
  const simulation = React.useRef({ offset: 0, velocity: 0, target: 0, spacing: 324, angles: [] as number[], swings: [] as number[] });
  const gesture = React.useRef<null | { id: number; x: number; y: number; offset: number; lastX: number; time: number; velocity: number; moved: boolean }>(null);
  const lastInteraction = React.useRef(0);
  const environment = React.useRef({ visible: true, hover: false, focus: false, reduced: false });

  const select = React.useCallback((index: number, manual = true) => {
    const next = clamp(index, 0, Math.max(0, count - 1));
    simulation.current.target = next * simulation.current.spacing;
    if (environment.current.reduced) {
      simulation.current.offset = simulation.current.target;
      repaint.current?.();
    }
    setSelected(next);
    if (manual) {
      lastInteraction.current = performance.now();
      setAnnouncement(copyPtBr.gallery.position(next + 1, count));
    }
  }, [count]);

  React.useEffect(() => { onChange?.(active); }, [active, onChange]);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const state = simulation.current;
    let width = 1;
    let height = 440;
    let cardWidth = 240;
    let frameId = 0;
    let previousTime = performance.now();

    const paint = (now: number, dt: number) => {
      const reducedMotion = environment.current.reduced;
      const before = state.offset;
      if (!gesture.current?.moved) {
        if (reducedMotion || count < 2) {
          state.offset = state.target;
          state.velocity = 0;
        } else {
          [state.offset, state.velocity] = springStep(state.offset, state.velocity, state.target, dt);
        }
      }
      const lineVelocity = gesture.current?.moved ? gesture.current.velocity * 1000 : -(state.offset - before) / Math.max(dt, 0.001);
      const y0 = Math.max(22, height * 0.1);
      const sag = Math.min(46, height * 0.09);
      pathRef.current?.setAttribute("d", `M0 ${y0} Q${width / 2} ${y0 + 2 * sag} ${width} ${y0}`);
      for (let i = 0; i < count; i++) {
        const card = cards.current[i];
        if (!card) continue;
        const x = width / 2 + i * state.spacing - state.offset;
        card.style.visibility = x < -cardWidth || x > width + cardWidth ? "hidden" : "visible";
        let angle = 0;
        if (!reducedMotion && count > 1) {
          [angle, state.swings[i]] = swingStep(state.angles[i] || 0, state.swings[i] || 0, lineVelocity, dt, 1);
          angle += Math.sin(now / 1300 + i * 1.7) * 0.0009;
        }
        state.angles[i] = angle;
        const y = stringY(x, width, y0, sag) - 6;
        card.style.transform = `translate(${(x - cardWidth / 2).toFixed(1)}px,${y.toFixed(1)}px) rotate(${angle.toFixed(4)}rad)`;
      }
    };
    const frame = (now: number) => {
      frameId = 0;
      if (!environment.current.visible || document.hidden) return;
      paint(now, Math.min(0.033, Math.max(0, now - previousTime) / 1000));
      previousTime = now;
      if (!environment.current.reduced && count > 1) frameId = requestAnimationFrame(frame);
    };
    repaint.current = () => paint(performance.now(), 0);
    const resume = () => {
      cancelAnimationFrame(frameId);
      frameId = 0;
      previousTime = performance.now();
      if (environment.current.visible && !document.hidden) frameId = requestAnimationFrame(frame);
    };
    const measure = () => {
      const bounds = root.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = bounds.height;
      // Reserve room for the cord, the print footer, controls and swing.
      cardWidth = Math.max(60, Math.min(360, width * 0.72, (height - 155) / 1.14));
      const index = nearestAt(state.target, state.spacing, count);
      setSelected(index);
      state.spacing = cardWidth * 1.08;
      state.target = state.offset = index * state.spacing;
      state.velocity = 0;
      root.style.setProperty("--pl-card-width", `${cardWidth}px`);
      paint(performance.now(), 0);
    };
    const updateMotion = () => {
      environment.current.reduced = media.matches;
      setReduced(media.matches);
      if (media.matches) {
        state.offset = state.target;
        state.velocity = 0;
      }
      resume();
    };
    const observer = new ResizeObserver(measure);
    const intersection = new IntersectionObserver(([entry]) => {
      environment.current.visible = entry.isIntersecting;
      resume();
    });
    observer.observe(root);
    intersection.observe(root);
    media.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", resume);
    updateMotion();
    measure();
    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      intersection.disconnect();
      media.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", resume);
      gesture.current = null;
      repaint.current = null;
    };
  }, [count]);

  React.useEffect(() => {
    if (reduced) repaint.current?.();
  }, [active, reduced, slides]);

  React.useEffect(() => {
    if (paused || suspended || reduced || count < 2) return;
    const timer = window.setInterval(() => {
      const env = environment.current;
      if (document.hidden || !env.visible || env.hover || env.focus || gesture.current || performance.now() - lastInteraction.current < AUTOPLAY) return;
      select((nearestAt(simulation.current.target, simulation.current.spacing, count) + 1) % count, false);
    }, AUTOPLAY);
    return () => window.clearInterval(timer);
  }, [paused, suspended, reduced, count, select]);

  const step = (direction: number) => select(nearestAt(simulation.current.target, simulation.current.spacing, count) + direction);
  const finishGesture = (event: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    gesture.current = null;
    rootRef.current?.removeAttribute("data-dragging");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (current.moved) {
      simulation.current.velocity = cancelled || environment.current.reduced ? 0 : -current.velocity * 1000;
      select(nearestAt(simulation.current.offset - (cancelled ? 0 : current.velocity * 180), simulation.current.spacing, count));
    } else if (!cancelled && event.target instanceof Element) {
      const card = event.target.closest<HTMLElement>("[data-slide]");
      if (card) select(Number(card.dataset.slide));
    }
  };

  if (!count) return null;

  return (
    <div
      ref={rootRef}
      className={styles.root}
      role="region"
      aria-roledescription="carrossel"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        step(event.key === "ArrowRight" ? 1 : -1);
      }}
      onMouseEnter={() => { environment.current.hover = true; }}
      onMouseLeave={() => { environment.current.hover = false; }}
      onFocusCapture={() => { environment.current.focus = true; }}
      onBlurCapture={(event) => { environment.current.focus = event.currentTarget.contains(event.relatedTarget); }}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0 || count < 2 || (event.target instanceof Element && event.target.closest("button"))) return;
        lastInteraction.current = performance.now();
        gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, offset: simulation.current.offset, lastX: event.clientX, time: event.timeStamp, velocity: 0, moved: false };
      }}
      onPointerMove={(event) => {
        const current = gesture.current;
        if (!current || current.id !== event.pointerId) return;
        const dx = event.clientX - current.x;
        if (!current.moved) {
          if (Math.abs(event.clientY - current.y) > Math.abs(dx) && Math.abs(event.clientY - current.y) > 5) { gesture.current = null; return; }
          if (Math.abs(dx) <= 5) return;
          current.moved = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.setAttribute("data-dragging", "true");
        }
        current.velocity = 0.7 * (event.clientX - current.lastX) / Math.max(1, event.timeStamp - current.time) + 0.3 * current.velocity;
        current.lastX = event.clientX;
        current.time = event.timeStamp;
        const max = (count - 1) * simulation.current.spacing;
        const offset = current.offset - dx;
        simulation.current.offset = offset < 0 ? offset * 0.35 : offset > max ? max + (offset - max) * 0.35 : offset;
        if (environment.current.reduced) repaint.current?.();
      }}
      onPointerUp={(event) => finishGesture(event)}
      onPointerCancel={(event) => finishGesture(event, true)}
      onLostPointerCapture={(event) => {
        if (event.target === event.currentTarget) finishGesture(event, true);
      }}
      onPointerLeave={(event) => { if (!gesture.current?.moved) finishGesture(event, true); }}
    >
      <svg className={styles.string} aria-hidden="true"><path ref={pathRef} fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
      {slides.map((slide, index) => (
        <div
          key={`${index}:${slide.image}`}
          ref={(element) => { cards.current[index] = element; }}
          className={styles.card}
          data-slide={index}
          data-active={index === active}
          aria-hidden={index !== active}
          style={{ "--pl-index": index, "--pl-active": active } as React.CSSProperties}
        >
          <div className={styles.print}>
            <div className={styles.shot}>
              <Image src={slide.image} alt={slide.alt} fill sizes="(max-width: 639px) 72vw, 360px" loading={index === 0 ? "eager" : "lazy"} fetchPriority={index === 0 ? "high" : undefined} draggable={false} />
            </div>
            <div className={styles.note}>{slide.title || copyPtBr.gallery.photo(index + 1)}</div>
          </div>
          <div className={styles.peg} />
        </div>
      ))}
      <div className={styles.bar}>
        <span className={styles.count} aria-hidden="true"><b>{String(active + 1).padStart(2, "0")}</b> / {String(count).padStart(2, "0")}</span>
        <div className={styles.controls}>
          {count > 1 && <>
            <button type="button" onClick={() => step(-1)} disabled={active === 0} aria-label={copyPtBr.gallery.previous}><ArrowLeft aria-hidden="true" /></button>
            <button type="button" onClick={() => step(1)} disabled={active === count - 1} aria-label={copyPtBr.gallery.next}><ArrowRight aria-hidden="true" /></button>
            {!reduced && <button type="button" onClick={() => setPaused(!paused)} aria-label={paused ? copyPtBr.gallery.resume : copyPtBr.gallery.pause}>{paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}</button>}
          </>}
          {children}
        </div>
      </div>
      <div className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</div>
    </div>
  );
}
