// Мейстер: Вирус Жизни, Культивация, Прожектор, Стадии Пакта (21.11.2026).
import { describe, it, expect } from "vitest";
import {
  maesterStage, lifeVirusRow, admitPatient, injectionAblative, projectorContribution, overchargeDecay, projectedRecently,
  lifeVirusLossPatch, cultivationSpoiled, harvestCultivation, reviveWindowOk, reviveCost, auraHordeDamage, lifeVirusActive
} from "../../module/rules/maester-talents.mjs";

const stage = n => ({ name: `Maester Pact Stage ${n} / Стадия Пакта ${n} (Мейстер)`, type: "talent" });

describe("Мейстер", () => {
  it("Стадия — старшая из купленных", () => {
    expect(maesterStage({ items: [stage(1), stage(2), stage(3)] })).toBe(3);
    expect(maesterStage({ items: [] })).toBe(0);
  });
  it("таблица книги по Стадиям", () => {
    expect(lifeVirusRow(0)).toMatchObject({ patients: 3, ablative: 7, overcharge: 0, doses: 7, cultivation: 3 });
    expect(lifeVirusRow(5)).toMatchObject({ patients: 7, ablative: 12, overcharge: 22, regen: 3, doses: 14, cultivation: 7 });
  });
  it("список пациентов: давний вылетает", () => {
    expect(admitPatient(["a", "b", "c"], "d", 3)).toEqual({ list: ["b", "c", "d"], dropped: ["a"] });
    expect(admitPatient(["a", "b"], "a", 3)).toEqual({ list: ["b", "a"], dropped: [] });
  });
  it("инъекция и Прожектор: +3 до Сверхукрепления, спад −3 до обычного", () => {
    expect(injectionAblative(2)).toBe(9);
    expect(injectionAblative(2, { foreign: true })).toBe(3);
    expect(projectorContribution(8, 1)).toBe(11);
    expect(projectorContribution(13, 1)).toBe(14);
    expect(projectorContribution(9, 2, 3)).toBe(16);
    expect(overchargeDecay(14, 1)).toBe(11);
    expect(overchargeDecay(9, 1)).toBe(8);
    expect(overchargeDecay(7, 1)).toBe(7);
    expect(projectedRecently({ projected: { combat: "c", round: 3 } }, "c", 4)).toBe(true);
    expect(projectedRecently({ projected: { combat: "c", round: 2 } }, "c", 4)).toBe(false);
  });
  it("потеря Аблативных Ран вируса: +1 Культивации (до 3), вклад сжимается", () => {
    const sys = { wounds: { ablative: 8, ablativeMax: 8 } };
    const p = lifeVirusLossPatch(sys, { by: "M", contribution: 8, cultivation: 2 }, 5, 100);
    expect(p["flags.warhammer-dbc.lifeVirus.cultivation"]).toBe(3);
    expect(p["flags.warhammer-dbc.lifeVirus.contribution"]).toBe(5);
    expect(p["system.wounds.ablativeMax"]).toBe(5);
    expect(lifeVirusLossPatch(sys, { by: "M", contribution: 8, cultivation: 3 }, 9, 100)).toBeNull();
    expect(lifeVirusLossPatch(sys, null, 5)).toBeNull();
  });
  it("порча, сбор, оживление, аура", () => {
    expect(cultivationSpoiled({ cultivation: 1, cultivationSince: 10 }, 10 + 7 * 3600)).toBe(true);
    expect(cultivationSpoiled({ cultivation: 1, cultivationSince: 10 }, 20)).toBe(false);
    expect(harvestCultivation(3, 5).take).toBe(3);
    expect(harvestCultivation(3, 5, { capOne: true }).take).toBe(1);
    expect(harvestCultivation(3, 2).take).toBe(2);
    expect(reviveWindowOk(12)).toBe(true);
    expect(reviveWindowOk(13)).toBe(false);
    expect(reviveCost(3, { selectiveKill: true })).toMatchObject({ cultivation: 1, ap: 0 });
    expect(reviveCost(2, { selectiveKill: true })).toMatchObject({ cultivation: 2, ap: 1 });
    expect(auraHordeDamage(37)).toBe(3);
    expect(lifeVirusActive({ flags: { "warhammer-dbc": { lifeVirus: { by: "M", contribution: 7, expiresAt: 50 } } } }, 10)).toBe(true);
  });
});
