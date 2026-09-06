// test/rules/gear-worn-mechanics.test.mjs
//
// wdbc-9h7g: снаряжение отдаёт свою Механику только надетым. Общий рубильник
// проверен в test/apps/effects.test.mjs; здесь — сцепка целиком, на РЕАЛЬНЫХ
// данных пака: предмет из packs-src → isItemActive → живые правила броска
// (rulesFromItemMechanics, тот же путь, которым модификатор доезжает до
// диалога теста). Синтетическая фикстура этого не поймала бы: сломаться может
// как раз связка «данные пака ↔ рубильник».
//
// Противогаз выбран не случайно — это пример из самого тикета: «противогаз
// защищает от газа, лёжа в рюкзаке».

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { isItemActive } from "../../module/apps/effects.mjs";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const GAS_MASK_PATH = path.join(ROOT,
  "packs-src/gear/Головное/Gas_Mask___Противогаз_AQLQSuvuH2LWm1sU.json");

const gasMask = JSON.parse(fs.readFileSync(GAS_MASK_PATH, "utf8"));

const maskItem = equipped => ({
  id: "mask", name: gasMask.name, type: gasMask.type,
  system: { ...gasMask.system, equipped },
  flags: gasMask.flags
});

const actor = { system: { geneSeed: {}, bio: { age: 0 } }, items: [] };
const rulesOf = item => rulesFromItemMechanics([item], isItemActive, actor);

describe("Противогаз: механика только надетым (wdbc-9h7g)", () => {
  it("данные пака: книга сказала, куда он надевается — значит он носимый", () => {
    expect(gasMask.system.worn.trim()).not.toBe("");
  });

  it("надет — даёт свой модификатор теста (+30 к Стойкости против газа)", () => {
    const effects = rulesOf(maskItem(true)).flatMap(r => r.effects || []);
    expect(effects).toContainEqual({ kind: "rollBonus", target: "char:t", value: 30 });
  });

  it("лежит в рюкзаке — не даёт ничего", () => {
    expect(rulesOf(maskItem(false))).toEqual([]);
  });

  it("снаряжение без пометки «Носится» работает и без тумблера", () => {
    // Хим-лаборатория и анализатор химии применяются, а не носятся: требовать
    // от них «надеть» бессмысленно, и тумблер им не показывается.
    const lab = { ...maskItem(false), system: { ...gasMask.system, worn: "", equipped: false } };
    expect(rulesOf(lab).length).toBeGreaterThan(0);
  });
});
