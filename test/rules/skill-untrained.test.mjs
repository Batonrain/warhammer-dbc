// test/rules/skill-untrained.test.mjs — Sahara task-8f82: гейт «нельзя неизученным» вне листа.
import { describe, it, expect, vi } from "vitest";
import { skillBlockedUntrained, warnSkillBlockedUntrained } from "../../module/rules/skill-untrained.mjs";

const actor = (skills) => ({ name: "Орда", system: { skills } });

describe("Навыки, недоступные неизученными, вне листа персонажа", () => {
  it("Psyniscience и Forbidden Lore без изучения — нельзя", () => {
    expect(skillBlockedUntrained(actor({ psyniscience: { rank: "untrained" } }), "psyniscience")).toBe(true);
    expect(skillBlockedUntrained(actor({}), "psyniscience")).toBe(true);
  });
  it("изученный — можно", () => {
    expect(skillBlockedUntrained(actor({ psyniscience: { rank: "known" } }), "psyniscience")).toBe(false);
  });
  it("обычный Навык неизученным — можно (−20 считает лист)", () => {
    expect(skillBlockedUntrained(actor({ dodge: { rank: "untrained" } }), "dodge")).toBe(false);
  });
  it("предупреждает и отменяет бросок", () => {
    const warn = vi.fn();
    globalThis.ui = { notifications: { warn } };
    expect(warnSkillBlockedUntrained(actor({}), "psyniscience")).toBe(true);
    expect(warn).toHaveBeenCalledOnce();
    delete globalThis.ui;
  });
});
