// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PolaroidLineCarousel, { type Slide } from "./polaroid-line-carousel";

vi.mock("next/image", () => ({
  default: ({ fill: _fill, fetchPriority: _priority, ...props }: Record<string, unknown>) => {
    void _fill; void _priority;
    return React.createElement("img", props);
  },
}));

let host: HTMLDivElement;
let root: Root;
let reduced = false;
let mediaListeners: Set<() => void>;
let visibility: (visible: boolean) => void;
let resize: () => void;
let rafCallbacks: Map<number, FrameRequestCallback>;
let rafId: number;
let hidden = false;
const disconnect = vi.fn();
const slides: Slide[] = [1, 2, 3].map((i) => ({ image: `/photo-${i}.webp`, alt: `Foto ${i}` }));
const render = (items = slides, suspended = false) => act(() => { root.render(React.createElement(PolaroidLineCarousel, { slides: items, ariaLabel: "Galeria", suspended })); });
const selected = () => host.querySelector<HTMLElement>('[data-active="true"]')?.dataset.slide;
const button = (label: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
const click = (label: string) => act(() => { button(label).click(); });
const advance = (milliseconds = 5000) => act(() => { vi.advanceTimersByTime(milliseconds); });
const motion = (value: boolean) => act(() => { reduced = value; mediaListeners.forEach((callback) => callback()); });
const frame = () => act(() => {
  const callbacks = [...rafCallbacks.values()];
  rafCallbacks.clear();
  callbacks.forEach((callback) => callback(performance.now() + 16));
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  reduced = false;
  hidden = false;
  mediaListeners = new Set();
  rafCallbacks = new Map();
  rafId = 0;
  disconnect.mockClear();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { rafCallbacks.set(++rafId, callback); return rafId; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => rafCallbacks.delete(id));
  vi.stubGlobal("ResizeObserver", class { constructor(callback: () => void) { resize = callback; } observe() {} disconnect = disconnect; });
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { visibility = (visible) => callback([{ isIntersecting: visible } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
    observe() {} disconnect = disconnect;
  });
  vi.stubGlobal("matchMedia", () => ({ get matches() { return reduced; }, addEventListener: (_: string, callback: () => void) => mediaListeners.add(callback), removeEventListener: (_: string, callback: () => void) => mediaListeners.delete(callback) }));
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 900, height: 540 } as DOMRect);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("comportamento da galeria", () => {
  it("suspende o autoplay durante a ampliação sem cancelar a pausa manual", () => {
    render();
    render(slides, true);
    advance(20_000); expect(selected()).toBe("0");
    render(slides, false);
    advance(); expect(selected()).toBe("1");
    click("Pausar apresentação");
    render(slides, true); render(slides, false);
    advance(20_000); expect(selected()).toBe("1");
  });

  it("acompanha o arraste diretamente com movimento reduzido", () => {
    render(); motion(true); frame();
    const region = host.querySelector<HTMLElement>('[role="region"]')!;
    region.setPointerCapture = vi.fn();
    const card = host.querySelector<HTMLElement>('[data-slide="0"]')!;
    const before = card.style.transform;
    const pointer = (type: string, x: number) => act(() => {
      const event = new Event(type, { bubbles: true });
      Object.assign(event, { pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: 100 });
      region.dispatchEvent(event);
    });
    pointer("pointerdown", 300); pointer("pointermove", 200);
    expect(card.style.transform).not.toBe(before);
    expect(rafCallbacks.size).toBe(0);
  });

  it.each(["pointerup", "pointercancel"])("centraliza arraste curto com %s mesmo sem trocar o índice", (ending) => {
    render(); motion(true); frame();
    const region = host.querySelector<HTMLElement>('[role="region"]')!;
    region.setPointerCapture = vi.fn();
    region.hasPointerCapture = () => true;
    region.releasePointerCapture = vi.fn();
    const card = host.querySelector<HTMLElement>('[data-slide="0"]')!;
    const before = card.style.transform;
    let time = 0;
    const pointer = (type: string, x: number) => act(() => {
      const event = new Event(type, { bubbles: true });
      Object.assign(event, { pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: 100 });
      Object.defineProperty(event, "timeStamp", { value: time += 1000 });
      region.dispatchEvent(event);
    });
    pointer("pointerdown", 300); pointer("pointermove", 280);
    expect(card.style.transform).not.toBe(before);
    pointer(ending, 280);
    expect(selected()).toBe("0");
    expect(card.style.transform).toBe(before);
    expect(rafCallbacks.size).toBe(0);
  });

  it("trata zero e uma foto sem contador inválido ou navegação", () => {
    render([]);
    expect(host.textContent).toBe("");
    render(slides.slice(0, 1));
    expect(host.textContent).toContain("01 / 01");
    expect(host.querySelectorAll("button")).toHaveLength(0);
    advance(20_000);
    expect(selected()).toBe("0");
  });

  it("avança automaticamente e volta à primeira sem anúncios live", () => {
    render();
    advance(); expect(selected()).toBe("1");
    advance(); expect(selected()).toBe("2");
    advance(); expect(selected()).toBe("0");
    expect(host.querySelector('[aria-live]')?.textContent).toBe("");
  });

  it("preserva pausa manual após hover e foco", () => {
    render();
    click("Pausar apresentação");
    const region = host.querySelector<HTMLElement>('[role="region"]')!;
    act(() => { region.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); region.focus(); });
    advance(20_000);
    act(() => { region.dispatchEvent(new MouseEvent("mouseout", { bubbles: true })); region.blur(); });
    advance(20_000);
    expect(selected()).toBe("0");
    click("Retomar apresentação");
    advance(); expect(selected()).toBe("1");
  });

  it("pausa temporariamente com hover, foco, aba oculta e fora da tela", () => {
    render();
    const region = host.querySelector<HTMLElement>('[role="region"]')!;
    act(() => region.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    advance(); expect(selected()).toBe("0");
    act(() => { region.dispatchEvent(new MouseEvent("mouseout", { bubbles: true })); region.focus(); });
    advance(); expect(selected()).toBe("0");
    act(() => region.blur());
    act(() => visibility(false));
    advance(); expect(selected()).toBe("0");
    act(() => { visibility(true); hidden = true; document.dispatchEvent(new Event("visibilitychange")); });
    advance(); expect(selected()).toBe("0");
    act(() => { hidden = false; document.dispatchEvent(new Event("visibilitychange")); });
    advance(); expect(selected()).toBe("1");
  });

  it("responde à redução de movimento e limpa frames e timers ao desmontar", () => {
    render();
    frame();
    motion(true); frame();
    expect(rafCallbacks.size).toBe(0);
    expect(button("Pausar apresentação")).toBeNull();
    advance(20_000); expect(selected()).toBe("0");
    click("Próxima imagem"); expect(selected()).toBe("1");
    motion(false); frame();
    expect(rafCallbacks.size).toBe(1);
    act(() => root.unmount());
    root = createRoot(host);
    expect(rafCallbacks.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(mediaListeners.size).toBe(0);
    expect(disconnect).toHaveBeenCalled();
  });

  it("mantém índice válido ao redimensionar e reduzir/aumentar a galeria", () => {
    render();
    click("Próxima imagem"); click("Próxima imagem");
    act(() => resize());
    expect(selected()).toBe("2");
    render(slides.slice(0, 1));
    expect(selected()).toBe("0");
    render();
    expect(selected()).toBe("0");
  });

  it("cancelamento horizontal libera o gesto e não impede navegação", () => {
    render();
    const region = host.querySelector<HTMLElement>('[role="region"]')!;
    region.setPointerCapture = vi.fn();
    region.hasPointerCapture = () => true;
    region.releasePointerCapture = vi.fn();
    const pointer = (type: string, x: number) => act(() => {
      const event = new Event(type, { bubbles: true });
      Object.assign(event, { pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: 100 });
      region.dispatchEvent(event);
    });
    pointer("pointerdown", 300);
    pointer("pointermove", 280);
    expect(region.dataset.dragging).toBe("true");
    pointer("pointercancel", 280);
    expect(region.dataset.dragging).toBeUndefined();
    expect(region.releasePointerCapture).toHaveBeenCalledWith(1);
    click("Próxima imagem"); expect(selected()).toBe("1");
  });
});
