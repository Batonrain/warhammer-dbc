// test/rules/speed-multipliers.test.mjs
//
// Множители дальности Движения на листе (Sahara task-bbe1, решение владельца 27.10.2026):
// Почитатели Танца (Полудвижение SPD×2, Полное ×3, Натиск ×6, Бег ×12), Акробатическое Мастерство
// (×2/×4/×8/×14, со Спринтом Бег ×28), Разящее Представление (Полное ×3, Натиск ×6, Бег ×12).
// Тест — на НАСТОЯЩЕЙ схеме персонажа, настоящем prepareDerivedData и документах пака. База листа:
// Полудвижение = SPD, Полное = SPD×2, Натиск = SPD×3, Бег = SPD×6 (rules/movement.mjs).

import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { SPEED_MULTIPLIER_TRAITS, speedMultipliersFor } from "../../module/rules/speed-multipliers.mjs";

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
const ACROBATIC = () => packDoc("traits", "Wlip2fVM1XQHPVPS");
const STRIKING = () => packDoc("traits", "Qmqoc0J5AaOAtjAA");

function findByName(dirs, re) {
  const out = [];
  const walk = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p);
    else if (f.name.endsWith(".json") && f.name !== "_Folder.json") { const j = JSON.parse(fs.readFileSync(p, "utf8")); if (re.test(j.name)) out.push(j); }
  } };
  for (const d of dirs) walk(path.join(ROOT, "packs-src", d));
  return out;
}
const sprintDoc = () => findByName(["talents"], /^Sprint \/ Спринт$/)[0];

/** Персонаж из настоящей схемы + настоящий пересчёт листа. */
function characterWith(docs = [], mutate = () => {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.ag.base = 40; // Ag.b 4 → SPD 4
  mutate(system);
  const items = docs.map((d, i) => ({ id: `i${i}`, name: d.name, type: d.type, system: d.system, flags: d.flags ?? {}, getFlag: () => undefined }));
  items.get = () => null;
  const actor = { type: "character", name: "Танцор", system, items, getFlag: () => undefined };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return actor.system.movement;
}

describe("таблица множителей — привязка к пакам", () => {
  it("каждая запись находит ровно один предмет-Черту в паке; числа таблицы = числа в тексте Черты", () => {
    const items = findByName(["traits", "aeldari-traits"], /./);
    for (const def of SPEED_MULTIPLIER_TRAITS) {
      const hits = items.filter(i => i.type === "trait" && def.match.test(i.name));
      expect(hits.length, `${def.id}: ${hits.map(h => h.name).join(" | ")}`).toBe(1);
      // в тексте Черты каждое число: «SPD×N»
      for (const n of Object.values(def.mult)) expect(hits[0].system.benefit).toContain(`SPD×${n}`);
    }
  });
});

describe("лист считает дистанции Движения по множителям", () => {
  const base = characterWith([]);
  const spd = base.halfMove;

  it("без Черты — база: SPD / ×2 / ×3 / ×6 (иначе тест ниже ничего не доказывает)", () => {
    expect(spd).toBeGreaterThan(0);
    expect([base.halfMove, base.move, base.charge, base.run]).toEqual([spd, spd * 2, spd * 3, spd * 6]);
  });

  it("Почитатели Танца: Полудвижение ×2, Полное ×3, Натиск ×6, Бег ×12", () => {
    const m = characterWith([WORSHIPPERS()]);
    expect([m.halfMove, m.move, m.charge, m.run]).toEqual([spd * 2, spd * 3, spd * 6, spd * 12]);
  });

  it("Акробатическое Мастерство: ×2 / ×4 / ×8 / ×14; со Спринтом Бег удваивается (×28)", () => {
    const m = characterWith([ACROBATIC()]);
    expect([m.halfMove, m.move, m.charge, m.run]).toEqual([spd * 2, spd * 4, spd * 8, spd * 14]);
    const withSprint = characterWith([ACROBATIC(), sprintDoc()]);
    expect(withSprint.sprintRun).toBe(spd * 28);
    expect(withSprint.run).toBe(spd * 14); // сам Бег не удваивается — «в отношении других механик»
  });

  it("Разящее Представление: Полудвижение остаётся SPD, Полное ×3, Натиск ×6, Бег ×12", () => {
    const m = characterWith([STRIKING()]);
    expect([m.halfMove, m.move, m.charge, m.run]).toEqual([spd, spd * 3, spd * 6, spd * 12]);
  });

  it("несколько Черт — берётся лучший множитель каждой дистанции, не сумма", () => {
    const m = characterWith([WORSHIPPERS(), ACROBATIC()]);
    expect([m.halfMove, m.move, m.charge, m.run]).toEqual([spd * 2, spd * 4, spd * 8, spd * 14]);
  });

  it("Повален (SPD вдвое) и потеря ног: множитель берётся от УЖЕ урезанного SPD, ноль остаётся нулём", () => {
    const prone = characterWith([WORSHIPPERS()], s => { s.conditions.prone = true; });
    const proneBase = characterWith([], s => { s.conditions.prone = true; });
    expect(prone.halfMove).toBe(proneBase.halfMove * 2);
    expect(prone.run).toBe(proneBase.halfMove * 12);
    const legless = characterWith([WORSHIPPERS()], s => { s.uselessLimbs.rightLeg = { state: true }; s.uselessLimbs.leftLeg = { state: true }; });
    expect([legless.halfMove, legless.move, legless.charge, legless.run]).toEqual([0, 0, 0, 0]);
  });

  it("разбор SPD на листе не ломается: «Минимум SPD» не добавляется из-за множителя", () => {
    const m = characterWith([WORSHIPPERS()]);
    expect(m.spdBreakdown.some(b => b.floor)).toBe(false);
    expect(m.spdBreakdown.some(b => /Множители Черт/.test(b.label))).toBe(true); // строка-пояснение с источником
  });
});

describe("speedMultipliersFor", () => {
  it("по имени предмета нужного типа; Талант-тёзка не считается", () => {
    const a = items => ({ items });
    expect(speedMultipliersFor(a([{ type: "trait", name: "Worshippers of Dance / Почитатели Танца" }]))).toMatchObject({ half: 2, move: 3, charge: 6, run: 12 });
    expect(speedMultipliersFor(a([{ type: "talent", name: "Worshippers of Dance / Почитатели Танца" }]))).toEqual({});
    expect(speedMultipliersFor(a([]))).toEqual({});
  });
});
