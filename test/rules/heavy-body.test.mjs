// test/rules/heavy-body.test.mjs
//
// Тяжёлое тело (module/rules/heavy-body.mjs): Тело Из Плотеметалла
// (Облитератор) и Громыхающий Гигант (Секутор) — без Бега и Прыжков, Натиск
// не дальше Полного Движения, Облитератор не носит брони; Расчленитель снимает
// ограничение Бега и Натиска. Черты — настоящие документы packs-src.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import {
  heavyBodyOf, heavyBodyLimitsRun, heavyBodyMovementCap, heavyBodyMoveBan, heavyBodyArmourBan
} from "../../module/rules/heavy-body.mjs";
import { prepareMovementDerived } from "../../module/rules/character/movement.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { ACTIVATED_FLAG } from "../../module/rules/item-activation.mjs";
import fs from "node:fs";
import path from "node:path";

const NS = "warhammer-dbc";
const FLESHMETAL = packDocById("packs-src/traits/Элитные_архетипы/Облитератор", "IN7kanX4lipRnZ9J");
const LUMBERING = (() => {
  const dir = path.resolve(import.meta.dirname, "../../packs-src/traits/Элитные_архетипы/Секутор");
  const f = fs.readdirSync(dir).find(n => n.startsWith("Lumbering_Giant"));
  return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
})();

let seq = 0;
const itemOf = (doc, flags = {}) => {
  const fl = { ...(doc.flags ?? {}), [NS]: { ...(doc.flags?.[NS] ?? {}), ...flags } };
  return { id: `i${++seq}`, type: doc.type, name: doc.name, system: { ...(doc.system ?? {}) }, flags: fl,
    getFlag: (s, k) => fl[s]?.[k] };
};
const actorOf = items => ({ items });

describe("Черта тяжёлого тела", () => {
  it("опознаёт Облитератора и Секутора, Талант Fleshmetal — нет", () => {
    expect(heavyBodyOf(actorOf([itemOf(FLESHMETAL)]))?.label).toBe("Тело Из Плотеметалла");
    expect(heavyBodyOf(actorOf([itemOf(LUMBERING)]))?.label).toBe("Громыхающий Гигант");
    expect(heavyBodyOf(actorOf([itemOf({ type: "talent", name: "Fleshmetal / Плотеметалл" })]))).toBeNull();
  });

  it("Натиск и Бег урезаны до Полного Движения", () => {
    expect(heavyBodyMovementCap({ halfMove: 4, move: 8, charge: 12, run: 24 }))
      .toEqual({ halfMove: 4, move: 8, charge: 8, run: 8 });
  });

  it("Бег и Прыжок запрещены; Расчленитель снимает запрет Бега, но не Прыжков", () => {
    const obl = actorOf([itemOf(FLESHMETAL)]);
    expect(heavyBodyMoveBan(obl, "run")).toContain("Бег");
    expect(heavyBodyMoveBan(obl, "jump")).toContain("Прыжки");
    const mut = itemOf({ type: "talent", name: "Mutilator / Расчленитель" }, { [ACTIVATED_FLAG]: { label: "Расчленитель" } });
    const raging = actorOf([itemOf(FLESHMETAL), mut]);
    expect(heavyBodyLimitsRun(raging)).toBe(false);
    expect(heavyBodyMoveBan(raging, "run")).toBe("");
    expect(heavyBodyMoveBan(raging, "jump")).toContain("Прыжки");
    expect(heavyBodyMoveBan(actorOf([itemOf(LUMBERING)]), "run")).toContain("Громыхающий Гигант");
    expect(heavyBodyMoveBan(actorOf([]), "run")).toBe("");
  });

  it("Облитератор не надевает броню, кроме поглощённой Самоперековыванием; Секутор — надевает", () => {
    const armour = itemOf({ type: "armor", name: "Броня" });
    const absorbed = itemOf({ type: "armor", name: "Броня" }, { livingArsenal: true });
    expect(heavyBodyArmourBan(actorOf([itemOf(FLESHMETAL)]), armour)).toContain("броню носить нельзя");
    expect(heavyBodyArmourBan(actorOf([itemOf(FLESHMETAL)]), absorbed)).toBe("");
    expect(heavyBodyArmourBan(actorOf([itemOf(LUMBERING)]), armour)).toBe("");
  });

  it("лист: у Облитератора Натиск и Бег равны Полному Движению", () => {
    const run = items => {
      const system = new ACTOR_DATA_MODELS.character({}).toObject();
      const a = { items, system, flags: {}, getFlag: () => undefined };
      prepareMovementDerived(a, system, { chars: system.characteristics, agBonus: 4, traitSizeMod: 0, traitSizeModNoSpd: 0, traitSpeedMod: 0 });
      return system.movement;
    };
    const plain = run([]);
    expect(plain.charge).toBeGreaterThan(plain.move);
    const obl = run([itemOf(FLESHMETAL)]);
    expect(obl.charge).toBe(obl.move);
    expect(obl.run).toBe(obl.move);
  });
});
