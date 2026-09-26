// test/rules/starting-characteristics.test.mjs
//
// Стартовые Характеристики (корбук, глава I, стр. 3–4): Сборка, Смещения,
// «Рядовые» и числа рас Основной книги в паке.

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  allowedMethods, effectiveBonusRolls, pointBuyPool, effectiveShifts,
  pointBuyCost, defaultPointBuy, checkPointBuy, canStepPointBuy,
  applyShifts, BONUS_CHARS
} from "../../module/rules/starting-characteristics.mjs";

describe("метод по настройке мира", () => {
  it("Генерация / Сборка / оба", () => {
    expect(allowedMethods("generation")).toEqual(["generation"]);
    expect(allowedMethods("pointbuy")).toEqual(["pointbuy"]);
    expect(allowedMethods("both")).toEqual(["generation", "pointbuy"]);
    expect(allowedMethods(undefined)).toEqual(["generation"]);
  });
});

describe("Рядовые", () => {
  const human = { bonusRolls: 3, bonusPoints: 11, charShift: 2 };
  it("чемпион получает всё", () => {
    expect(effectiveBonusRolls(human)).toBe(3);
    expect(pointBuyPool(human)).toBe(111);
    expect(effectiveShifts(human)).toBe(2);
  });
  it("рядовой теряет Бонусные Броски, Бонусные Очки и Смещения", () => {
    expect(effectiveBonusRolls(human, true)).toBe(0);
    expect(pointBuyPool(human, true)).toBe(100);
    expect(effectiveShifts(human, true)).toBe(0);
  });
});

describe("Сборка", () => {
  it("до +18 по очку, +19 ещё 2, +20 ещё 3", () => {
    expect(pointBuyCost(2)).toBe(2);
    expect(pointBuyCost(18)).toBe(18);
    expect(pointBuyCost(19)).toBe(20);
    expect(pointBuyCost(20)).toBe(23);
  });

  it("минимум +2 в каждую — раскладка по умолчанию стоит 18", () => {
    const a = defaultPointBuy();
    expect(Object.keys(a)).toEqual(BONUS_CHARS);
    expect(checkPointBuy(a, 100)).toMatchObject({ spent: 18, left: 82, ok: true });
  });

  it("меньше +2 и перерасход — ошибка", () => {
    expect(checkPointBuy({ ...defaultPointBuy(), ws: 1 }, 100).ok).toBe(false);
    const heavy = { ...defaultPointBuy(), ws: 20, bs: 20, s: 20, t: 20 };
    const r = checkPointBuy(heavy, 100);
    expect(r.spent).toBe(4 * 23 + 5 * 2);
    expect(r.ok).toBe(false);
  });

  it("шаг вверх упирается в запас и потолок +20, вниз — в +2", () => {
    const a = { ...defaultPointBuy(), ws: 18 };            // потрачено 34
    expect(canStepPointBuy(a, 35, "ws", 1)).toBe(false);   // +19 стоит ещё 2
    expect(canStepPointBuy(a, 36, "ws", 1)).toBe(true);
    expect(canStepPointBuy({ ...a, ws: 20 }, 999, "ws", 1)).toBe(false);
    expect(canStepPointBuy(a, 100, "bs", -1)).toBe(false);
  });
});

describe("Смещение Характеристик", () => {
  const base = { ws: 30, bs: 30, s: 30 };
  it("+5 одной за счёт −5 другой, одну можно сместить дважды", () => {
    expect(applyShifts(base, [{ up: "ws", down: "bs" }, { up: "ws", down: "s" }], 2))
      .toEqual({ ws: 40, bs: 25, s: 25 });
  });
  it("сверх лимита и незаполненные — не применяются", () => {
    expect(applyShifts(base, [{ up: "ws", down: "bs" }, { up: "ws", down: "s" }], 1))
      .toEqual({ ws: 35, bs: 25, s: 30 });
    expect(applyShifts(base, [{ up: "ws", down: "ws" }, { up: "ws" }, { up: "inf", down: "s" }], 3))
      .toEqual(base);
  });
});

// Числа рас Основной книги (глава I) — пак обязан им соответствовать:
// Мастер берёт их из компендиума, а не из module/constants/races.mjs.
describe("Бонусные Броски / Очки / Смещения рас Основной книги в паке", () => {
  const BOOK = {
    human: [3, 11, 2], astartes: [2, 7, 0], ogryn: [1, 4, 1], ratling: [1, 4, 1],
    squat: [1, 4, 1], beastman: [2, 7, 2], harpy: [2, 7, 2], naga: [2, 7, 2],
    splice: [2, 7, 2], replicant: [2, 7, 2], yigori: [3, 11, 2]
  };
  const root = join(fileURLToPath(new URL("../..", import.meta.url)), "packs-src", "races");
  const docs = {};
  for (const dir of readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory())) {
    for (const f of readdirSync(join(root, dir.name)).filter(f => f.endsWith(".json"))) {
      const j = JSON.parse(readFileSync(join(root, dir.name, f), "utf8"));
      if (j.type === "race") docs[j.system?.key] = j.system;
    }
  }
  for (const [key, [rolls, points, shift]] of Object.entries(BOOK)) {
    it(key, () => {
      expect(docs[key], `нет расы ${key} в паке`).toBeTruthy();
      expect([docs[key].bonusRolls, docs[key].bonusPoints, docs[key].charShift]).toEqual([rolls, points, shift]);
    });
  }
});

// Человек: «Рядовые персонажи не имеют этих Трейтов» — The Quick and The Dead
// и Fast Learner (25). Записи Механики расы гейтятся предикатом rankAndFile.
describe("чемпионские Черты Человека не выдаются Рядовому", () => {
  const file = join(fileURLToPath(new URL("../..", import.meta.url)),
    "packs-src", "races", "Люди", "Human___Человек_Djzn7Nxy3LAdq951.json");
  const human = JSON.parse(readFileSync(file, "utf8"));
  const entries = human.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
  for (const name of ["The Quick and The Dead", "Fast Learner"]) {
    it(name, () => {
      const e = entries.find(x => x.kind === "trait" && x.sourceName.startsWith(name));
      expect(e, `нет записи ${name}`).toBeTruthy();
      expect(e.when?.predicates?.rankAndFile).toBe(false);
    });
  }
});
