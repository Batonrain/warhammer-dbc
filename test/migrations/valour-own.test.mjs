// test/migrations/valour-own.test.mjs
//
// Приёмка #597: Соглашение Доблести считает чужим оружие/броню без метки
// valourOwn, а метку ставит только галочка в окне Черты. Уже играющий Кузнец
// Крови на первой атаке своим клинком терял Архетип на 8 дней. Миграция
// отмечает своим всё, что уже на листе.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { valourOwnPending } from "../../module/migrations/valour-own.mjs";
import { valourViolation } from "../../module/rules/archetype-suppression.mjs";

const NS = "warhammer-dbc";
const item = (id, type, name, flags = {}) => ({ id, type, name, system: {}, flags: { [NS]: flags },
  getFlag: (ns, k) => flags[k] });
const accord = () => item("t", "trait", "Valourous Accord / Соглашение Доблести");
const actorWith = (...items) => ({ items });

describe("Соглашение Доблести: своё снаряжение у уже играющих", () => {
  it("до миграции атака своим клинком — нарушение (так было)", () => {
    const sword = item("w", "weapon", "Цепной Меч");
    expect(valourViolation(actorWith(accord(), sword), "attack", sword)).not.toBe("");
  });

  it("с Чертой — всё оружие и броня без метки", () => {
    const sword = item("w", "weapon", "Цепной Меч"), plate = item("a", "armor", "Силовая Броня");
    const gear = item("g", "gear", "Ауспик");
    expect(valourOwnPending(actorWith(accord(), sword, plate, gear)).map(i => i.id)).toEqual(["w", "a"]);
  });

  it("идемпотентно: отмеченное не трогается", () => {
    const sword = item("w", "weapon", "Цепной Меч", { valourOwn: true });
    expect(valourOwnPending(actorWith(accord(), sword))).toEqual([]);
  });

  it("без Черты — ничего", () => {
    expect(valourOwnPending(actorWith(item("w", "weapon", "Цепной Меч")))).toEqual([]);
  });

  it("после отметки атака тем же клинком — не нарушение", () => {
    const sword = item("w", "weapon", "Цепной Меч", { valourOwn: true });
    expect(valourViolation(actorWith(accord(), sword), "attack", sword)).toBe("");
  });
});

describe("проводка (приёмка #597)", () => {
  const read = rel => fs.readFileSync(path.resolve(import.meta.dirname, "../..", rel), "utf8");
  it("обе миграции зарегистрированы и стоят в гейте ready с проверкой activeGM", () => {
    const src = read("warhammer-dbc.mjs");
    for (const k of ["valourOwn", "warpGiftedRating"]) {
      expect(src).toContain(`game.settings.register("warhammer-dbc", "${k}Version"`);
      expect(src).toContain(`"${k}TokensVersion",`);
      expect(src).toContain(`key: "${k}Version", tokensKey: "${k}TokensVersion"`);
    }
    const h = src.split('Hooks.once("ready"').find(x => x.includes('key: "valourOwnVersion"'));
    expect(h.indexOf("activeGM?.isSelf")).toBeLessThan(h.indexOf('key: "valourOwnVersion"'));
  });
  it("истечение срока обходит и несвязанные токены", () => {
    expect(read("module/combat/valourous-accord.mjs")).toMatch(/for \(const actor of worldAndTokenActors\(\)\)/);
  });
});
