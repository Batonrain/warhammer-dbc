import { describe, it, expect } from "vitest";
import { buildBodyState } from "../../module/constants/body-map.mjs";

// Фигура на вкладке ТЕЛО нарисована анфас (лицом к зрителю) — анатомическая
// сторона персонажа зеркальна экранной. Имплант с bodySide:"right" (правая
// рука персонажа) обязан красить регион armL (левая половина полотна), иначе
// силуэт показывает имплант не на той стороне.
describe("buildBodyState — сторона имплантации зеркалится под фигуру анфас", () => {
  it("правая рука персонажа красит экранный регион armL, не armR", () => {
    const state = buildBodyState([{ name: "Bionic Arm", installed: "arm", category: "bionic", side: "right" }]);
    expect(state.regions.armL).toBe("bionic");
    expect(state.regions.armR).toBe("flesh");
  });

  it("левая рука персонажа красит экранный регион armR, не armL", () => {
    const state = buildBodyState([{ name: "Bionic Arm", installed: "arm", category: "bionic", side: "left" }]);
    expect(state.regions.armR).toBe("bionic");
    expect(state.regions.armL).toBe("flesh");
  });

  it("правый глаз персонажа красит экранный оверлей eyeL, не eyeR", () => {
    const state = buildBodyState([{ name: "Ocular Implant", installed: "eye", category: "bionic", side: "right" }]);
    expect(state.overlays.eyeL).toBe("bionic");
    expect(state.overlays.eyeR).toBeNull();
  });

  it("левая нога персонажа красит экранный регион legR, не legL", () => {
    const state = buildBodyState([{ name: "Bionic Leg", installed: "leg", category: "bionic", side: "left" }]);
    expect(state.regions.legR).toBe("bionic");
    expect(state.regions.legL).toBe("flesh");
  });
});
