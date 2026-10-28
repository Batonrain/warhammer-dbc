// test/combat/speed-consumers-multipliers.test.mjs
//
// Множители дальности от Черт (Почитатели Танца, Акробатическое Мастерство — Sahara task-bbe1) поднимают
// system.movement.halfMove до SPD×2. Но Отскок, Полушаг, Вольт, Карабканье, Перебежка, Давление и Пересилить
// в книге считаются от САМОГО SPD — они читают system.movement.spdNow (rules/character/movement.mjs).
// Тест на НАСТОЯЩЕЙ схеме персонажа и настоящем пересчёте листа.

import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { spdMeters } from "../../module/combat/recoil-pool.mjs";
import { vaultHalfMove, duckAndCoverMeters } from "../../module/combat/movement-actions.mjs";
import { spdOfMovement } from "../../module/rules/speed-multipliers.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
function packDoc(dir, idTail) {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(f => {
    const p = path.join(d, f.name);
    return f.isDirectory() ? walk(p) : (f.name.endsWith(`_${idTail}.json`) ? [p] : []);
  });
  const [file] = walk(path.join(ROOT, "packs-src", dir));
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
const WORSHIPPERS = () => packDoc("aeldari-traits", "zvrmidxuc39LFSIg");

function characterWith(docs = [], mutate = () => {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.ag.base = 40; // SPD 4
  mutate(system);
  const items = docs.map((d, i) => ({ id: `i${i}`, name: d.name, type: d.type, system: d.system, flags: d.flags ?? {}, getFlag: () => undefined }));
  items.get = () => null;
  const actor = { type: "character", name: "Арлекин", system, items, getFlag: () => undefined };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return actor;
}

describe("потребители SPD не получают множитель Полудвижения", () => {
  const plain = characterWith([]);
  const dancer = characterWith([WORSHIPPERS()]);

  it("лист: у носителя halfMove = SPD×2, а spdNow остался SPD (иначе тест ниже ничего не доказывает)", () => {
    expect(plain.system.movement.halfMove).toBe(4);
    expect(dancer.system.movement.halfMove).toBe(8);
    expect(dancer.system.movement.spdNow).toBe(4);
  });

  it("пул Отскока, Давление и Пересилить (spdMeters) — SPD, а не Полудвижение с множителем", () => {
    expect(spdMeters(plain)).toBe(4);
    expect(spdMeters(dancer)).toBe(4);
    expect(spdMeters({ system: {} })).toBe(0);
    expect(spdMeters(null)).toBe(0);
  });

  it("spdOfMovement: spdNow, а нет его — halfMove (старые данные и фикстуры)", () => {
    expect(spdOfMovement({ halfMove: 5 })).toBe(5);
    expect(spdOfMovement({ halfMove: 8, spdNow: 4 })).toBe(4);
    expect(spdOfMovement(undefined)).toBe(0);
  });

  it("Перебежка «SPD×2» — от SPD, а не от Полного Движения с множителем (SPD×3)", () => {
    expect(duckAndCoverMeters(plain)).toBe(8);
    expect(duckAndCoverMeters(dancer)).toBe(8);
    expect(dancer.system.movement.move).toBe(12); // Полное у Почитателей ×3 — Перебежку это не касается
  });

  it("Вольт в Пружинящей Стойке: SPD+2 считается от SPD, не от удвоенного Полудвижения", () => {
    const springing = characterWith([WORSHIPPERS()], s => { s.meleeStance = "springing"; });
    // SPD 4 − 2 (Стойка) = 2; Вольту нужно SPD+2 = 4 = 2 + 2 (снять −2, добавить +2) с учётом спрятанного SPD
    expect(vaultHalfMove(springing)).toBe(springing.system.movement.spdNow + 4);
    // без Черты — прежнее поведение: halfMove + 4
    const plainSpringing = characterWith([], s => { s.meleeStance = "springing"; });
    expect(vaultHalfMove(plainSpringing)).toBe(plainSpringing.system.movement.halfMove + 4);
  });
});

describe("подсказка SPD на листе", () => {
  it("строка «Множители Черт» читается как пояснение, а не как «−0»", async () => {
    const { charTotalTooltip } = await import("../../module/sheets/character-context.mjs");
    const tip = charTotalTooltip(characterWith([WORSHIPPERS()]).system.movement.spdNow, characterWith([WORSHIPPERS()]).system.movement.spdBreakdown);
    expect(tip).toContain("Множители Черт: Почитатели Танца");
    expect(tip).toContain("SPD × множитель");
    expect(tip).not.toMatch(/−0/);
  });
});
