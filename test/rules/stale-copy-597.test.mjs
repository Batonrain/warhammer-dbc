// test/rules/stale-copy-597.test.mjs
//
// Приёмка #597. Стопка дописала записи Конструктора kind:"capability" в уже
// существовавшие файлы паков (Рубрикант, Каменное Сердце, Латы Чародея,
// Закалённые Варпом Латы, Огневая Мощь, Глаза-Стебельки, Глаза Хаоса, Зрящие
// Рога). Копия у персонажа, взявшего предмет раньше, этих записей не несёт до
// «Обновить мир», и читатель, спрашивающий только ключ, молчит. Читатели
// поэтому опознают и по имени (rules/ability-by-key.mjs::hasAbility,
// rules/vision-aids.mjs::BY_NAME).
//
// Здесь — привязка имён к пакам (носитель ключа в паке носит это имя) и
// поведение там, где читатель зовётся без Foundry. Урон — в
// test/combat/warp-weapon.test.mjs, хват винтовки — в test/rules/hands.test.mjs.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { hasAbility } from "../../module/rules/ability-by-key.mjs";
import { itemHasName } from "../../module/rules/predicates.mjs";
import { CORRUPTION_IMMUNE_CAP, NO_RUN_CAP, CRUMBLE_CAP, RUBRICAE } from "../../module/rules/rubricae.mjs";
import {
  visionAidsBlocked, retinalDisplayBlocked, hornSightActive,
  VISION_AIDS_BLOCKED_CAP, RETINAL_DISPLAY_BLOCKED_CAP, HORN_SIGHT_CAP
} from "../../module/rules/vision-aids.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const read = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");
const packDoc = (dir, prefix) => {
  const d = path.join(ROOT, "packs-src", dir);
  const f = fs.readdirSync(d).find(x => x.startsWith(prefix));
  return JSON.parse(fs.readFileSync(path.join(d, f), "utf8"));
};
const capEntries = doc => (doc.flags?.["warhammer-dbc"]?.mechanics ?? [])
  .flatMap(g => g.entries).filter(e => e.kind === "capability");
/** Копия у старого персонажа: имя и субмутация те же, записей Конструктора нет. */
const stale = (doc, sub = "") => ({ ...doc, flags: {}, system: { ...doc.system, submutation: { label: sub } } });
const actorWith = (...items) => ({ items });

describe("Черты и Таланты: носитель ключа в паке носит имя, по которому опознаётся копия", () => {
  const CASES = [
    ["traits/Элитные_архетипы/Колдун_Рубрики", "Rubricae___", "trait", RUBRICAE, [CORRUPTION_IMMUNE_CAP, NO_RUN_CAP, CRUMBLE_CAP]],
    ["traits/Элитные_архетипы/Когитор", "Heart_of_Stone___", "trait", "Heart of Stone", ["damageImmunity.warpWeapon"]],
    ["talents/Элитные_архетипы/Броненосец", "Sorcerer_s_Plate___", "talent", "Sorcerer's Plate", ["armor.apVsWarpFull"]],
    ["talents/Элитные_архетипы/Моритат", "Outgun___", "talent", "Outgun", ["weapon.oneHandedRifle"]]
  ];
  for (const [dir, prefix, type, name, keys] of CASES) {
    it(`${name}: ${keys.join(", ")}`, () => {
      const doc = packDoc(dir, prefix);
      expect(doc.type).toBe(type);
      expect(itemHasName(doc, name)).toBe(true);
      expect(capEntries(doc).map(e => e.capabilityKey)).toEqual(expect.arrayContaining(keys));
      for (const k of keys) expect(hasAbility(actorWith(stale(doc)), k, name, type), k).toBe(true);
    });
  }
});

describe("Рубрикант: все три читателя опознают Черту и по имени", () => {
  it("Порча (warhammer-dbc.mjs), Бег (movement-actions.mjs), рассыпание (damage.mjs)", () => {
    expect(read("warhammer-dbc.mjs")).toContain("hasAbility(doc, CORRUPTION_IMMUNE_CAP, RUBRICAE, \"trait\")");
    expect(read("module/combat/movement-actions.mjs")).toContain("hasAbility(actor, NO_RUN_CAP, RUBRICAE, \"trait\")");
    expect(read("module/combat/damage.mjs")).toContain("hasAbility(actor, CRUMBLE_CAP, RUBRICAE, \"trait\")");
  });
});

describe("Огневая Мощь: окно атаки и бюджет рук опознают одинаково", () => {
  it("attack-dialog.mjs и hands.mjs — hasAbility(… \"Outgun\", \"talent\")", () => {
    const call = "hasAbility(actor, \"weapon.oneHandedRifle\", \"Outgun\", \"talent\")";
    expect(read("module/sheets/attack-dialog.mjs")).toContain(call);
    expect(read("module/rules/hands.mjs")).toContain(call);
  });
});

describe("Мутации зрения: копия без записи опознаётся по имени и субмутации", () => {
  const stalks = packDoc("mutations/Общие_мутации", "Eye_Stalks___");
  const eyes = packDoc("mutations/Общие_мутации", "Eyes_of_Chaos___");
  const horns = packDoc("mutations/Общие_мутации", "Majestic_Horns___");

  it("записи пака совпадают с запасной таблицей (ключ и субмутация)", () => {
    const subsOf = (doc, key) => capEntries(doc).filter(e => e.capabilityKey === key).map(e => e.when?.submutations ?? []);
    expect(subsOf(stalks, VISION_AIDS_BLOCKED_CAP)).toEqual([[]]);
    expect(subsOf(stalks, RETINAL_DISPLAY_BLOCKED_CAP)).toEqual([[]]);
    expect(subsOf(eyes, VISION_AIDS_BLOCKED_CAP)).toEqual([["1"]]);
    expect(subsOf(eyes, RETINAL_DISPLAY_BLOCKED_CAP)).toEqual([["1"]]);
    expect(subsOf(horns, HORN_SIGHT_CAP)).toEqual([["9"]]);
  });

  it("Глаза-Стебельки — запрет визоров и ретинального дисплея", () => {
    const a = actorWith(stale(stalks));
    expect(visionAidsBlocked(a)).toBe(true);
    expect(retinalDisplayBlocked(a)).toBe(true);
  });

  it("Глаза Хаоса — только при субмутации 1", () => {
    expect(retinalDisplayBlocked(actorWith(stale(eyes, "1")))).toBe(true);
    expect(visionAidsBlocked(actorWith(stale(eyes, "1")))).toBe(true);
    expect(retinalDisplayBlocked(actorWith(stale(eyes, "4")))).toBe(false);
  });

  it("Величественные Рога — обзор сквозь рога только при субмутации 9", () => {
    expect(hornSightActive(actorWith(stale(horns, "9")))).toBe(true);
    expect(hornSightActive(actorWith(stale(horns, "2-3")))).toBe(false);
  });

  it("подавленная мутация не действует и по имени", () => {
    const m = { ...stale(stalks), getFlag: (ns, k) => k === "suppressed" };
    expect(retinalDisplayBlocked(actorWith(m))).toBe(false);
  });
});
