// test/rules/volunteer-actor.test.mjs
import { describe, it, expect } from "vitest";
import {
  isHarlequinsKissItem, scheduleMimicWireSurgery, isMimicWireSurgeryReady,
  MIMIC_WIRE_SURGERY_DURATION
} from "../../module/rules/volunteer-actor.mjs";

describe("isHarlequinsKissItem", () => {
  it("опознаёт по русской половине бинома имени", () => {
    expect(isHarlequinsKissItem({ type: "weapon", name: "Harlequin’s Kiss (Brathu-Angua) / Поцелуй Арлекина" })).toBe(true);
  });
  it("не путает с другим оружием", () => {
    expect(isHarlequinsKissItem({ type: "weapon", name: "Sword / Меч" })).toBe(false);
  });
  it("не мутация/талант с похожим именем — только type:weapon", () => {
    expect(isHarlequinsKissItem({ type: "mutation", name: "Поцелуй Арлекина" })).toBe(false);
  });
  it("null/undefined — false, не падает", () => {
    expect(isHarlequinsKissItem(null)).toBe(false);
    expect(isHarlequinsKissItem(undefined)).toBe(false);
  });
});

describe("scheduleMimicWireSurgery / isMimicWireSurgeryReady", () => {
  it("дедлайн — +16ч от текущего worldTime", () => {
    expect(scheduleMimicWireSurgery(1000)).toBe(1000 + MIMIC_WIRE_SURGERY_DURATION);
  });
  it("готово — ровно на дедлайне и позже", () => {
    expect(isMimicWireSurgeryReady(1000, 999)).toBe(false);
    expect(isMimicWireSurgeryReady(1000, 1000)).toBe(true);
    expect(isMimicWireSurgeryReady(1000, 2000)).toBe(true);
  });
  it("нет дедлайна — не готово, не падает", () => {
    expect(isMimicWireSurgeryReady(null, 999999)).toBe(false);
    expect(isMimicWireSurgeryReady(undefined, 999999)).toBe(false);
  });
});
