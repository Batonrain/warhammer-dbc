// dbc-114 / 55-15 (14.11.2026): Аморфный — SPD ÷2 вверх и авто-высвобождение из Борьбы;
// Не От Мира Сего — Подавление, Паника, психосилы на разум. Фикстуры — настоящие JSON из packs-src.

import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { amorphousSpd, amorphousNextShift, amorphousSizeAvailable, amorphousSizeShiftOf } from "../../module/rules/amorphous.mjs";
import { PSY_DISCIPLINES } from "../../module/constants/disciplines.mjs";
import { isMindPower } from "../../module/rules/mind-immunity.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

const dir = path.resolve("packs-src/traits");
const load = prefix => JSON.parse(fs.readFileSync(path.join(dir, fs.readdirSync(dir).find(x => x.startsWith(prefix))), "utf8"));
const capsOf = d => d.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).filter(e => e.kind === "capability").map(e => e.capabilityKey);

describe("SPD Аморфного", () => {
  it("вдвое, округление вверх", () => {
    expect(amorphousSpd(4)).toBe(2);
    expect(amorphousSpd(3)).toBe(2);
    expect(amorphousSpd(5)).toBe(3);
    expect(amorphousSpd(1)).toBe(1);
  });
  it("не ниже 0.5", () => {
    expect(amorphousSpd(0)).toBe(0.5);
    expect(amorphousSpd(0.5)).toBe(1);
  });
});

describe("психосилы на разум", () => {
  it("Телепатия: Мезмеризм и Иллюзионизм — да", () => {
    expect(isMindPower("telepathy", "Мезмеризм")).toBe(true);
    expect(isMindPower("telepathy", "Иллюзионизм")).toBe(true);
  });
  it("Тзинч и Слаанеш: только с подтипом «Влияющие на разум»; подтип заведён в дисциплинах", () => {
    expect(isMindPower("tzeentch", "Влияющие на разум")).toBe(true);
    expect(isMindPower("slaanesh", "Влияющие на разум")).toBe(true);
    expect(isMindPower("tzeentch", "")).toBe(false);
    expect(isMindPower("nurgle", "Влияющие на разум")).toBe(false);
    expect(PSY_DISCIPLINES.tzeentch.subtypes).toContain("Влияющие на разум");
    expect(PSY_DISCIPLINES.slaanesh.subtypes).toContain("Влияющие на разум");
  });
  it("другие подтипы и дисциплины — нет", () => {
    expect(isMindPower("telepathy", "Чтение мыслей")).toBe(false);
    expect(isMindPower("biomancy", "Мезмеризм")).toBe(false);
    expect(isMindPower("", "")).toBe(false);
  });
  it("в паке есть силы Телепатии с этими подтипами", () => {
    const root = path.resolve("packs-src/psychic-powers");
    const found = [];
    const w = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
      const q = path.join(d, e.name);
      if (e.isDirectory()) return w(q);
      if (!e.name.endsWith(".json") || e.name.startsWith("_")) return;
      const j = JSON.parse(fs.readFileSync(q, "utf8"));
      if (j.type === "psychicPower" && isMindPower(j.system.discipline, j.system.subtype)) found.push(j.name);
    });
    w(root);
    expect(found.length).toBeGreaterThan(10);
  });
});

describe("данные Трейтов выдают способности, у каждой есть читатель", () => {
  const cases = [
    ["Amorphous___", ["weaponPropertyImmunity.snare", "movement.walkHalved", "grapple.autoEscape", "size.amorphousShift"]],
    ["From_Beyond___Не_От", ["fear.immune", "suppression.immune", "panic.immune", "psychic.mindImmune"]]
  ];
  for (const [prefix, keys] of cases) {
    it(prefix, () => {
      const caps = capsOf(load(prefix));
      for (const k of keys) {
        expect(caps, k).toContain(k);
        expect(CAPABILITIES[k]?.reader, k).toBeTruthy();
      }
    });
  }
});

describe("смена Размера Аморфного", () => {
  it("шаги только ±1 и ±2, смещение копится", () => {
    expect(amorphousNextShift(0, 2)).toBe(2);
    expect(amorphousNextShift(2, -1)).toBe(1);
    expect(amorphousNextShift(0, 3)).toBeNull();
    expect(amorphousNextShift(0, 0)).toBeNull();
    expect(amorphousNextShift(0, "cancel")).toBeNull();
  });
  it("раз за Раунд боя; вне боя — без ограничения", () => {
    const flags = { "warhammer-dbc": { amorphousSizeRound: "c1:3" } };
    expect(amorphousSizeAvailable({ flags }, { id: "c1", round: 3 })).toBe(false);
    expect(amorphousSizeAvailable({ flags }, { id: "c1", round: 4 })).toBe(true);
    expect(amorphousSizeAvailable({ flags }, null)).toBe(true);
  });
  it("смещение читается из флага актора", () => {
    expect(amorphousSizeShiftOf({ flags: { "warhammer-dbc": { amorphousSizeShift: -2 } } })).toBe(-2);
    expect(amorphousSizeShiftOf({})).toBe(0);
  });
  it("на Черте есть кнопка-скрипт, зовущая shiftAmorphousSize", () => {
    const e = load("Amorphous___").flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).find(x => x.kind === "script");
    expect(e?.code).toContain("shiftAmorphousSize(actor)");
  });
});
