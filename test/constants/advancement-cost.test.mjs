// test/constants/advancement-cost.test.mjs
//
// ТЕСТ ДО ПРАВКИ (приём проекта, скилл dbc-workflow) под wdbc-1pvq.
//
// Цена Продвижения не была закреплена ничем: ни charCostXP, ни skillCostXP не
// упоминались в тестах вовсе. А следующий шаг — переезд «какие две Склонности
// у объекта» с прибитой таблицы на переопределяемую, то есть правка ровно того
// входа, из которого цена и считается.
//
// Поэтому сперва фиксируются НЫНЕШНИЕ числа, через нынешнюю точку входа.
// Ожидания этого файла после переезда не трогаются: их совпадение до и после и
// есть доказательство, что переезд ничего не поменял.
//
// Числа — таблицы книги (Black Crusade, стр. 23): Характеристика
// 100/250/500/750/1000 у Дружественной, Навык 100/200/350/550.

import { describe, it, expect } from "vitest";

import { charCostXP, skillCostXP, aptitudeCat, charAptitudeSet,
         CHAR_APTITUDES, CHAR_COST, SKILL_COST }
  from "../../module/constants/advancement.mjs";
import { SKILLS_DEF } from "../../module/constants/skills.mjs";

// Склонности объекта сейчас собираются ДВУМЯ разными способами, и это как раз
// то, что переезд сводит в одно: у Характеристики — таблицей CHAR_APTITUDES
// внутри resolveCharCat, у Навыка — парой [char, apt2], которую собирает
// КАЖДЫЙ вызывающий сам (их пять по коду).
const WS_APTS    = CHAR_APTITUDES.ws;                              // ["ws", "offence"]
const DODGE_APTS = [SKILLS_DEF.dodge.char, SKILLS_DEF.dodge.apt2];  // ["ag", "defence"]

describe("aptitudeCat: две совпавшие Склонности — Дружественная (стр. 23-24)", () => {
  it("оба совпадения — ally", () => {
    expect(aptitudeCat(charAptitudeSet(["ws", "offence"]), WS_APTS)).toBe("ally");
  });

  it("одно совпадение — neutral", () => {
    expect(aptitudeCat(charAptitudeSet(["ws"]), WS_APTS)).toBe("neutral");
  });

  it("ни одного — enemy", () => {
    expect(aptitudeCat(charAptitudeSet(["fel"]), WS_APTS)).toBe("enemy");
  });

  it("«Общая» есть у всех и всегда участвует в совпадениях", () => {
    // charAptitudeSet сама добавляет general — Навык с apt2 "general"
    // получает совпадение даже у персонажа, который его не выбирал.
    const apts = charAptitudeSet([]);
    expect(aptitudeCat(apts, ["s", "general"])).toBe("neutral");
  });
});

describe("charCostXP: цена Характеристики по нынешней таблице (wdbc-1pvq)", () => {
  it("Дружественная WS у персонажа со Склонностями WS+Нападение — вся лестница", () => {
    const apts = charAptitudeSet(["ws", "offence"]);
    const ladder = [0, 1, 2, 3, 4].map(step => charCostXP(step, "ws", apts));
    expect(ladder).toEqual(CHAR_COST.ally);
    expect(ladder).toEqual([100, 250, 500, 750, 1000]);
  });

  it("Нейтральная — одно совпадение из двух", () => {
    const apts = charAptitudeSet(["ws"]);
    expect([0, 1, 2, 3, 4].map(s => charCostXP(s, "ws", apts))).toEqual(CHAR_COST.neutral);
  });

  it("Враждебная — ни одного совпадения", () => {
    const apts = charAptitudeSet(["fel", "social"]);
    expect([0, 1, 2, 3, 4].map(s => charCostXP(s, "ws", apts))).toEqual(CHAR_COST.enemy);
  });

  it("ступень за пределами лестницы прижимается к краю, а не падает", () => {
    const apts = charAptitudeSet(["ws", "offence"]);
    expect(charCostXP(99, "ws", apts)).toBe(CHAR_COST.ally[4]);
    expect(charCostXP(-3, "ws", apts)).toBe(CHAR_COST.ally[0]);
  });
});

describe("skillCostXP: цена Навыка по нынешней таблице (wdbc-1pvq)", () => {
  it("Уклонение (Ловкость + Защита) у персонажа с обеими — вся лестница", () => {
    const apts = charAptitudeSet(["ag", "defence"]);
    const ladder = [0, 1, 2, 3].map(r => skillCostXP(r, DODGE_APTS, apts));
    expect(ladder).toEqual(SKILL_COST.ally);
    expect(ladder).toEqual([100, 200, 350, 550]);
  });

  it("одна из двух — Нейтральная", () => {
    const apts = charAptitudeSet(["ag"]);
    expect([0, 1, 2, 3].map(r => skillCostXP(r, DODGE_APTS, apts))).toEqual(SKILL_COST.neutral);
  });

  it("ни одной — Враждебная", () => {
    const apts = charAptitudeSet(["int", "knowledge"]);
    expect([0, 1, 2, 3].map(r => skillCostXP(r, DODGE_APTS, apts))).toEqual(SKILL_COST.enemy);
  });
});

describe("привязка Склонностей к объекту — то, что переезжает (wdbc-1pvq)", () => {
  it("у Характеристики она берётся из таблицы CHAR_APTITUDES", () => {
    expect(CHAR_APTITUDES.ws).toEqual(["ws", "offence"]);
    expect(CHAR_APTITUDES.int).toEqual(["int", "knowledge"]);
  });

  it("у Навыка — из пары char + apt2 его определения", () => {
    expect(DODGE_APTS).toEqual(["ag", "defence"]);
    expect([SKILLS_DEF.awareness.char, SKILLS_DEF.awareness.apt2]).toEqual(["per", "fieldcraft"]);
  });

  it("смена привязки меняет цену — ради этого тикет и заведён", () => {
    // Персонаж со Склонностями Интеллект+Знание платит за Уклонение как за
    // Враждебный Навык. Если бы Уклонение было привязано к Int+Знание —
    // платил бы как за Дружественный. Сегодня такой привязки не задать
    // ничем, кроме правки кода; тест фиксирует, что цена от привязки
    // действительно зависит.
    const apts = charAptitudeSet(["int", "knowledge"]);
    expect(skillCostXP(0, DODGE_APTS, apts)).toBe(SKILL_COST.enemy[0]);
    expect(skillCostXP(0, ["int", "knowledge"], apts)).toBe(SKILL_COST.ally[0]);
  });
});

// ── Таланты Элитных Архетипов (Склонности, стр. 24) ─────────────────────────
// «Все Таланты Элитных Архетипов считаются нейтральными в системе Склонностей.»
// В паке у них пустой список Склонностей — без отдельного правила подсчёт
// совпадений давал 0 и делал их Враждебными (Талант 2 ступени — 750 вместо 500).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { talentCostXP, resolveTalentCat, TALENT_COST } from "../../module/constants/advancement.mjs";
import { isEliteTalent } from "../../module/constants/patronage.mjs";

describe("Таланты Элитных Архетипов нейтральны по Склонностям", () => {
  const apts = charAptitudeSet(["ws", "bs", "s", "t", "offence", "defence", "finesse", "fieldcraft"]);

  it("Талант Элитного Архетипа без своих Склонностей — Нейтральный, не Враждебный", () => {
    const spec = "Элитный архетип: Архимаг";
    expect(resolveTalentCat("Любой Талант", [], apts, null, { specialization: spec })).toBe("neutral");
    expect(talentCostXP(2, [], apts, null, { name: "Любой Талант", specialization: spec }))
      .toBe(TALENT_COST.neutral[1]);
  });

  it("обычный Талант с пустым списком Склонностей по-прежнему Враждебный", () => {
    expect(resolveTalentCat("Обычный Талант", [], apts, null)).toBe("enemy");
  });

  it("признак читается и из bilingual-названия архетипа", () => {
    expect(isEliteTalent("X", "Элитный архетип: Felarch / Феларх")).toBe(true);
    expect(isEliteTalent("X", "Melee, Ranged")).toBe(false);
    expect(isEliteTalent("X", "")).toBe(false);
  });

  it("каждый Талант папки «Элитные архетипы» в паке помечен — иначе станет Враждебным", () => {
    const root = join(fileURLToPath(new URL("../..", import.meta.url)), "packs-src/talents/Элитные_архетипы");
    const bad = [];
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith(".json") && e.name !== "_Folder.json") {
          const j = JSON.parse(readFileSync(p, "utf8"));
          if (!isEliteTalent(j.name, j.system?.specialization)) bad.push(j.name);
        }
      }
    };
    walk(root);
    expect(bad).toEqual([]);
  });
});
