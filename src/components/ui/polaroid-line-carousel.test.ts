import { describe, expect, it } from "vitest";
import { clamp, nearestAt, stringY, springStep, swingStep } from "./polaroid-line-carousel";

describe("geometria e movimento da galeria Polaroid", () => {
  it("limita a seleção inclusive com galeria vazia", () => {
    expect(nearestAt(-200, 200, 3)).toBe(0);
    expect(nearestAt(900, 200, 3)).toBe(2);
    expect(nearestAt(0, 200, 0)).toBe(0);
    expect(clamp(4, 0, 2)).toBe(2);
  });

  it("mantém as pontas e a curva da corda", () => {
    expect(stringY(0, 100, 40, 46)).toBe(40);
    expect(stringY(50, 100, 40, 46)).toBe(86);
    expect(stringY(100, 100, 40, 46)).toBe(40);
  });

  it("acomoda a mola e limita o balanço", () => {
    let position = 0;
    let velocity = 0;
    for (let i = 0; i < 240; i++) {
      [position, velocity] = springStep(position, velocity, 300, 1 / 60);
    }
    expect(position).toBeCloseTo(300, 3);
    expect(velocity).toBeCloseTo(0, 3);
    let angle = 0;
    let angularVelocity = 0;
    for (let i = 0; i < 120; i++) {
      [angle, angularVelocity] = swingStep(angle, angularVelocity, 100_000, 1 / 60, 1);
      expect(Math.abs(angle)).toBeLessThanOrEqual(0.6);
    }
  });
});
